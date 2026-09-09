import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getAppConfig } from "./config.ts";
import { createPlaySession, disposePlaySession, lastAssistantText, openPiSession, parseAssistantJson, promptPlayOpening } from "./gm-pi.ts";
import {
  compactScratchDir,
  kbRuntimeDir,
  loadCompactState,
  loadDirtySet,
  loadEntities,
  loadEpisodes,
  loadGmNote,
  loadL2Current,
  loadL2Psyche,
  loadScene,
  peekTurnId,
  npcMemoryDir,
  playSessionsDir,
  saveCompactState,
  saveDirtySet,
  saveL2Current,
  saveL2Psyche,
  sessionArchiveDir,
} from "./kb.ts";
import { debugLog, turnLog } from "./log.ts";
import { isTrivialNpcTurn, NEAR_CAP_MIN, turnIdToN } from "./npc-memory.ts";
import {
  NpcArchiveEntrySchema,
  NpcArchiveIndexSchema,
  parseNpcArchiveModel,
  parseNpcPsycheModel,
  SESSION_ARCHIVE_ID_RE,
  SessionArchiveIndexSchema,
  SessionSummarySchema,
  type DirtySet,
  type Entity,
  type GmOutput,
  type SceneState,
  type SessionSummary,
} from "./schema.ts";

export type CompactTestHooks = {
  summary?: (input: unknown) => { title: string; body: string } | Promise<{ title: string; body: string }>;
  npcArchive?: (npcId: string) =>
    | { title: string; summary: string; distilled_body: string }
    | Promise<{ title: string; summary: string; distilled_body: string }>;
  npcPsyche?: (
    npcId: string,
    input: unknown,
  ) => Record<string, string> | Promise<Record<string, string>>;
  failAfterScratch?: () => void;
  failAfterApply?: () => void;
};

let testHooks: CompactTestHooks | null = null;

export function setCompactTestHooks(hooks: CompactTestHooks | null): void {
  testHooks = hooks;
}

export function presentSet(present: string[]): Set<string> {
  return new Set(present);
}

export function presentChanged(before: SceneState, after: SceneState): boolean {
  const a = [...presentSet(before.present)].sort().join("\0");
  const b = [...presentSet(after.present)].sort().join("\0");
  return a !== b;
}

export function sceneIdChanged(before: SceneState, after: SceneState): boolean {
  return before.scene_id.trim() !== after.scene_id.trim();
}

export function departedPresentIds(before: SceneState, after: SceneState): string[] {
  const afterSet = presentSet(after.present);
  return [...presentSet(before.present)].filter((id) => !afterSet.has(id));
}

export function formatTurnId(n: number): string {
  return `t${String(Math.max(0, n)).padStart(4, "0")}`;
}

export async function nextSessionArchiveId(): Promise<string> {
  const index = await loadSessionArchiveIndex();
  let max = 0;
  for (const e of index.entries) {
    const n = Number.parseInt(e.archive_id.replace(/^sa_/, ""), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `sa_${String(max + 1).padStart(3, "0")}`;
}

export async function loadSessionArchiveIndex(): Promise<{ entries: zEntries }> {
  try {
    const raw = JSON.parse(await readFile(join(sessionArchiveDir, "index.json"), "utf8"));
    return SessionArchiveIndexSchema.parse(raw);
  } catch {
    return { entries: [] };
  }
}

type zEntries = ReturnType<typeof SessionArchiveIndexSchema.parse>["entries"];

export async function findLiveJsonl(): Promise<string | null> {
  try {
    const names = (await readdir(playSessionsDir)).filter((n) => n.endsWith(".jsonl"));
    if (names.length === 0) return null;
    names.sort();
    let best = join(playSessionsDir, names[names.length - 1]!);
    let bestM = 0;
    for (const n of names) {
      const p = join(playSessionsDir, n);
      const s = await stat(p);
      if (s.mtimeMs >= bestM) {
        bestM = s.mtimeMs;
        best = p;
      }
    }
    return best;
  } catch {
    return null;
  }
}

type ChatTurn = { role: "user" | "assistant"; text: string; inputTokens?: number };

export function parseJsonlChat(text: string): ChatTurn[] {
  const out: ChatTurn[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    const msg = (rec.message && typeof rec.message === "object" ? rec.message : rec) as Record<string, unknown>;
    const role = msg.role;
    if (role !== "user" && role !== "assistant") continue;
    let textOut = "";
    const content = msg.content;
    if (typeof content === "string") textOut = content;
    else if (Array.isArray(content)) {
      textOut = content
        .filter((c): c is { type: string; text?: string } => !!c && typeof c === "object")
        .map((c) => (typeof c.text === "string" ? c.text : ""))
        .join("");
    }
    const usage = msg.usage && typeof msg.usage === "object" ? (msg.usage as Record<string, unknown>) : null;
    const inputTokens = typeof usage?.input === "number" ? usage.input : undefined;
    out.push({ role, text: textOut, inputTokens });
  }
  return out;
}

export function recentDialoguePairs(chat: ChatTurn[], keep: number): { user: string; assistant: string }[] {
  const pairs: { user: string; assistant: string }[] = [];
  for (let i = 0; i < chat.length - 1; i++) {
    const a = chat[i];
    const b = chat[i + 1];
    if (a?.role === "user" && b?.role === "assistant") {
      pairs.push({ user: a.text, assistant: b.text });
    }
  }
  return pairs.slice(-keep);
}

export async function lastAssistantInputTokens(jsonlPath: string): Promise<number | null> {
  const chat = parseJsonlChat(await readFile(jsonlPath, "utf8"));
  for (let i = chat.length - 1; i >= 0; i--) {
    if (chat[i]?.role === "assistant") return chat[i]!.inputTokens ?? null;
  }
  return null;
}

export async function forceCompactNeeded(jsonlPath: string | null): Promise<boolean> {
  const cfg = getAppConfig().compact;
  if (!jsonlPath) return false;
  const tokens = await lastAssistantInputTokens(jsonlPath);
  if (tokens != null) return tokens >= cfg.force_after_input_tokens;
  const size = (await stat(jsonlPath)).size;
  return size >= cfg.force_after_jsonl_bytes;
}

async function runScratchJson(systemPrompt: string, user: string, hint: string): Promise<unknown> {
  const jobDir = join(compactScratchDir, `call-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const session = await openPiSession({
    cwd: jobDir,
    sessionDir: join(jobDir, "generate-sessions"),
    systemPrompt,
    fresh: true,
  });
  try {
    await session.prompt(user);
    await session.agent.waitForIdle();
    const firstText = lastAssistantText(session);
    debugLog("compact", `${hint} assistant chars=${firstText.length}\n${firstText}`);
    try {
      return parseAssistantJson(firstText, hint);
    } catch (first) {
      await session.prompt("Previous reply was not valid JSON. Resend ONE JSON object only. No markdown.");
      await session.agent.waitForIdle();
      const secondText = lastAssistantText(session);
      debugLog("compact", `${hint} retry assistant chars=${secondText.length}\n${secondText}`);
      try {
        return parseAssistantJson(secondText, `${hint}-retry`);
      } catch (second) {
        const hintErr = second instanceof Error ? second.message : String(second);
        throw new Error(`scratch JSON failed after retry (${first instanceof Error ? first.message : first}) / ${hintErr}`);
      }
    }
  } finally {
    session.dispose();
    await rm(jobDir, { recursive: true, force: true });
  }
}

async function modelSummary(input: unknown, truncated: boolean, fallbackTitle: string | undefined): Promise<{ title: string; body: string }> {
  if (testHooks?.summary) return await testHooks.summary(input);
  if (process.env.GM_MODE === "mock") {
    return {
      title: fallbackTitle || (truncated ? "非自然換幕（強制封存）" : "段落結束"),
      body: truncated ? "非自然換幕。活對局因大小強制封存。" : "本段對局已封存。",
    };
  }
  const system = await readFile(join(import.meta.dir, "..", "prompts", "compact-summary.md"), "utf8");
  const raw = await runScratchJson(system, JSON.stringify(input), "compact-summary");
  const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return { title: String(rec.title ?? fallbackTitle ?? "段落"), body: String(rec.body ?? "") };
}

async function modelNpcArchive(npcId: string, payload: unknown): Promise<ReturnType<typeof parseNpcArchiveModel>> {
  if (testHooks?.npcArchive) {
    return parseNpcArchiveModel(await testHooks.npcArchive(npcId));
  }
  if (process.env.GM_MODE === "mock") {
    return parseNpcArchiveModel({
      title: `${npcId} 本段`,
      summary: "本段知情已收進主觀檔。",
      distilled_body: "剛封存過一幕。",
    });
  }
  const system = await readFile(join(import.meta.dir, "..", "prompts", "compact-npc-archive.md"), "utf8");
  try {
    return parseNpcArchiveModel(await runScratchJson(system, JSON.stringify(payload), `compact-npc-archive:${npcId}`));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`npc-archive ${npcId}: ${msg}`);
  }
}

async function modelNpcPsyche(npcId: string, payload: unknown): Promise<ReturnType<typeof parseNpcPsycheModel>> {
  if (testHooks?.npcPsyche) {
    return parseNpcPsycheModel(await testHooks.npcPsyche(npcId, payload), npcId);
  }
  const priorRaw =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>).prior_psyche : undefined;
  const prior = priorRaw && typeof priorRaw === "object" ? (priorRaw as Record<string, unknown>) : {};
  const passthrough = () =>
    parseNpcPsycheModel(
      {
        npc_id: npcId,
        disposition: typeof prior.disposition === "string" ? prior.disposition : "",
        life_goal: typeof prior.life_goal === "string" ? prior.life_goal : "",
        mid_goal: typeof prior.mid_goal === "string" ? prior.mid_goal : "",
        short_goal: typeof prior.short_goal === "string" ? prior.short_goal : "",
        likes: typeof prior.likes === "string" ? prior.likes : "",
        dislikes: typeof prior.dislikes === "string" ? prior.dislikes : "",
      },
      npcId,
    );
  if (process.env.GM_MODE === "mock" || testHooks?.npcArchive) {
    if (process.env.GM_MODE === "mock" && !testHooks?.npcArchive) {
      return parseNpcPsycheModel(
        {
          npc_id: npcId,
          disposition: typeof prior.disposition === "string" ? prior.disposition : "",
          life_goal: typeof prior.life_goal === "string" ? prior.life_goal : "",
          mid_goal: "mock 中期",
          short_goal: "mock 短期",
          likes: typeof prior.likes === "string" ? prior.likes : "",
          dislikes: typeof prior.dislikes === "string" ? prior.dislikes : "",
        },
        npcId,
      );
    }
    return passthrough();
  }
  const system = await readFile(join(import.meta.dir, "..", "prompts", "compact-npc-psyche.md"), "utf8");
  try {
    return parseNpcPsycheModel(await runScratchJson(system, JSON.stringify(payload), `compact-npc-psyche:${npcId}`), npcId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`npc-psyche ${npcId}: ${msg}`);
  }
}

async function distillDepartedNpcPsyche(w: NpcWrite, entities: Entity[]): Promise<void> {
  const ent = entities.find((e) => e.id === w.id);
  const prior = await loadL2Psyche(w.id);
  const persona = ent?.kind === "npc" ? (ent.persona ?? "").trim() : "";
  const payload = {
    npc_id: w.id,
    name: ent?.name ?? w.id,
    prior_psyche: {
      disposition: prior.disposition,
      life_goal: prior.life_goal,
      mid_goal: prior.mid_goal,
      short_goal: prior.short_goal,
      likes: prior.likes,
      dislikes: prior.dislikes,
    },
    archive_title: w.entry.title,
    archive_summary: w.entry.summary,
    distilled_body: w.distilled,
    persona_excerpt: persona.slice(0, 400),
  };
  const next = await modelNpcPsyche(w.id, payload);
  await saveL2Psyche(next);
}

function nextNpcArchiveId(npcId: string, existing: string[]): string {
  let max = 0;
  const prefix = `na_${npcId}_`;
  for (const id of existing) {
    if (!id.startsWith(prefix)) continue;
    const n = Number.parseInt(id.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

async function loadNpcArchiveIndex(npcId: string) {
  const path = join(npcMemoryDir, "l2", npcId, "archive", "index.json");
  try {
    return NpcArchiveIndexSchema.parse(JSON.parse(await readFile(path, "utf8")));
  } catch {
    return { npc_id: npcId, entries: [] as { npc_archive_id: string; session_archive_id?: string; turn_from: string; turn_to: string; title: string; summary: string; body_chars: number }[] };
  }
}

export function formatOpeningMessage(opts: {
  archiveId: string;
  summary: SessionSummary;
  gmNote: string;
  scene: SceneState;
  l2Currents: { npc_id: string; body: string }[];
  pairs: { user: string; assistant: string }[];
}): string {
  const lines = [
    `Previous play session archived as ${opts.archiveId}. Do not treat the old jsonl as live history.`,
    `Summary: ${opts.summary.body}`,
    `gm_note: ${opts.gmNote}`,
    `scene: ${JSON.stringify(opts.scene)}`,
    `present L2 current after distill: ${JSON.stringify(opts.l2Currents)}`,
  ];
  if (opts.pairs.length > 0) {
    lines.push("Recent dialogue (tail):");
    for (const p of opts.pairs) {
      lines.push(`Player: ${p.user}`);
      lines.push(`GM: ${p.assistant}`);
    }
  }
  return lines.join("\n");
}


type NpcWrite = {
  id: string;
  entry: ReturnType<typeof NpcArchiveEntrySchema.parse>;
  distilled: string;
  index: ReturnType<typeof NpcArchiveIndexSchema.parse>;
};

function mockPlaySkipsAutoCompact(mock: boolean): boolean {
  if (testHooks?.summary || testHooks?.npcArchive || testHooks?.failAfterScratch || testHooks?.failAfterApply) return false;
  return mock || process.env.GM_MODE === "mock";
}

function npcTouchedThisTurn(id: string, gm: GmOutput): boolean {
  if (gm.npc_lines.some((l) => l.npc_id === id)) return true;
  return gm.events.some((e) => e.actors.includes(id));
}

function writerNpcIdsThisTurn(gm: GmOutput, entities: Entity[]): string[] {
  const npcIds = new Set(entities.filter((e) => e.kind === "npc").map((e) => e.id));
  const written = new Set<string>();
  for (const e of gm.events) for (const a of e.actors) written.add(a);
  for (const l of gm.npc_lines) written.add(l.npc_id);
  return [...written].filter((id) => npcIds.has(id));
}

async function lastArchiveTurnToN(npcId: string): Promise<number> {
  const idx = await loadNpcArchiveIndex(npcId);
  let max = 0;
  for (const e of idx.entries) {
    const n = turnIdToN(e.turn_to);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

export function npcSegmentTurnFrom(lastToN: number): string {
  return lastToN <= 0 ? "t0001" : formatTurnId(lastToN + 1);
}

export async function qualifiesDepartedNpc(id: string, gm: GmOutput, entities: Entity[]): Promise<boolean> {
  const ent = entities.find((e) => e.id === id);
  if (!ent || ent.kind !== "npc" || (ent.memory_tier ?? 0) !== 2) return false;
  const current = await loadL2Current(id);
  if (!current) return false;
  const lastTo = await lastArchiveTurnToN(id);
  const wroteSegment = current.updated_turn > lastTo || npcTouchedThisTurn(id, gm);
  if (!wroteSegment) return false;
  if (isTrivialNpcTurn(id, gm) && current.updated_turn <= lastTo) return false;
  return true;
}

async function draftNpcWrite(id: string, turnTo: string): Promise<NpcWrite> {
  const current = await loadL2Current(id);
  if (!current) throw new Error(`no current for ${id}`);
  const lastTo = await lastArchiveTurnToN(id);
  const turnFrom = npcSegmentTurnFrom(lastTo);
  const modeled = await modelNpcArchive(id, { npc_id: id, current: current.body, turn_from: turnFrom, turn_to: turnTo });
  if (modeled.distilled_body.length >= NEAR_CAP_MIN) throw new Error(`distill still >=640 for ${id}`);
  const idx = await loadNpcArchiveIndex(id);
  const npc_archive_id = nextNpcArchiveId(id, idx.entries.map((e) => e.npc_archive_id));
  const entry = NpcArchiveEntrySchema.parse({
    npc_archive_id,
    npc_id: id,
    turn_from: turnFrom,
    turn_to: turnTo,
    title: modeled.title,
    summary: modeled.summary,
  });
  const index = NpcArchiveIndexSchema.parse({
    npc_id: id,
    entries: [
      ...idx.entries,
      {
        npc_archive_id,
        turn_from: turnFrom,
        turn_to: turnTo,
        title: modeled.title,
        summary: modeled.summary,
        body_chars: modeled.summary.length,
      },
    ],
  });
  return { id, entry, distilled: modeled.distilled_body, index };
}

async function commitNpcWrite(w: NpcWrite, turnId: string): Promise<void> {
  const dir = join(npcMemoryDir, "l2", w.id, "archive");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${w.entry.npc_archive_id}.json`), JSON.stringify(w.entry, null, 2));
  await writeFile(join(dir, "index.json"), JSON.stringify(w.index, null, 2));
  await saveL2Current({ npc_id: w.id, body: w.distilled, updated_turn: turnIdToN(turnId) });
}

async function patchNpcSessionArchiveId(w: NpcWrite, archiveId: string): Promise<void> {
  const dir = join(npcMemoryDir, "l2", w.id, "archive");
  const patchedEntry = NpcArchiveEntrySchema.parse({ ...w.entry, session_archive_id: archiveId });
  const patchedIndex = NpcArchiveIndexSchema.parse({
    npc_id: w.id,
    entries: w.index.entries.map((e) =>
      e.npc_archive_id === w.entry.npc_archive_id ? { ...e, session_archive_id: archiveId } : e,
    ),
  });
  await writeFile(join(dir, `${w.entry.npc_archive_id}.json`), JSON.stringify(patchedEntry, null, 2));
  await writeFile(join(dir, "index.json"), JSON.stringify(patchedIndex, null, 2));
}

async function computeNearCap(entities: Entity[]): Promise<string[]> {
  const near_cap: string[] = [];
  for (const e of entities) {
    if (e.kind !== "npc" || (e.memory_tier ?? 0) !== 2) continue;
    const cur = await loadL2Current(e.id);
    if (cur && cur.body.length >= NEAR_CAP_MIN) near_cap.push(e.id);
  }
  return near_cap;
}

async function saveMergedDirty(opts: {
  gm: GmOutput;
  entities: Entity[];
  dirty: DirtySet;
  departedSuccess: string[];
  sessionOk: boolean;
  archiveId?: string;
  sessionDistillIds: string[];
}): Promise<void> {
  let touched = new Set(opts.dirty.touched);
  for (const id of opts.departedSuccess) touched.delete(id);
  let since = opts.dirty.since_session_archive;
  if (opts.sessionOk && opts.archiveId) {
    since = opts.archiveId;
    touched = new Set(writerNpcIdsThisTurn(opts.gm, opts.entities));
    for (const id of opts.departedSuccess) touched.delete(id);
    for (const id of opts.sessionDistillIds) touched.delete(id);
  }
  await saveDirtySet({
    since_session_archive: since,
    touched: [...touched],
    near_cap: await computeNearCap(opts.entities),
  });
}

async function onStageNearCapIds(gm: GmOutput, entities: Entity[], skip: Set<string>): Promise<string[]> {
  const out: string[] = [];
  for (const id of gm.scene.present) {
    if (skip.has(id)) continue;
    const ent = entities.find((e) => e.id === id);
    if (!ent || ent.kind !== "npc" || (ent.memory_tier ?? 0) !== 2) continue;
    const cur = await loadL2Current(id);
    if (cur && cur.body.length >= NEAR_CAP_MIN) out.push(id);
  }
  return out;
}

type JobOk =
  | { kind: "departed"; write: NpcWrite }
  | { kind: "sessionNpc"; write: NpcWrite }
  | { kind: "summary"; drafted: { title: string; body: string }; jsonlText: string };

/** Uses current turn id and disk scene. Does not increment the turn counter. */
export async function debugRunCompact(): Promise<{ compacted: boolean; archiveId?: string; turn_id: string }> {
  const scene = await loadScene();
  const gmNote = (await loadGmNote()) || "本場進行中。";
  const turn_id = await peekTurnId();
  const gm: GmOutput = {
    narration: "debug compact",
    npc_lines: [],
    events: [],
    gm_note: gmNote,
    scene: scene ?? { scene_id: "unknown", present: ["player"], visible: [] },
    ui: null,
    needs_image: false,
  };
  const jsonlPath = await findLiveJsonl();
  const did = await runCompactAfterTurn({ turnId: turn_id, gm, sceneBefore: gm.scene, mock: false, forceSession: true, jsonlPath });
  return { ...did, turn_id };
}

export async function maybeCompactAfterTurn(opts: {
  turnId: string;
  gm: GmOutput;
  sceneBefore: SceneState;
  mock: boolean;
}): Promise<{ compacted: boolean; archiveId?: string }> {
  const jsonlPath = await findLiveJsonl();
  return runCompactAfterTurn({ ...opts, jsonlPath, forceSession: false });
}

async function runCompactAfterTurn(opts: {
  turnId: string;
  gm: GmOutput;
  sceneBefore: SceneState;
  mock: boolean;
  jsonlPath: string | null;
  forceSession: boolean;
}): Promise<{ compacted: boolean; archiveId?: string }> {
  if (!opts.forceSession && mockPlaySkipsAutoCompact(opts.mock)) return { compacted: false };

  const cfg = getAppConfig().compact;
  const forced = await forceCompactNeeded(opts.jsonlPath);
  const state = await loadCompactState();
  const n = turnIdToN(opts.turnId);
  const dueN = n - state.anchor_turn_n >= cfg.max_turns_without_compact;
  const wantSession = opts.forceSession || forced || sceneIdChanged(opts.sceneBefore, opts.gm.scene) || dueN;

  const entities = await loadEntities();
  const dirty = await loadDirtySet();
  const departed = departedPresentIds(opts.sceneBefore, opts.gm.scene);
  const departedCandidates: string[] = [];
  for (const id of departed) {
    if (await qualifiesDepartedNpc(id, opts.gm, entities)) departedCandidates.push(id);
  }
  if (!wantSession && departedCandidates.length === 0) return { compacted: false };

  const skip = new Set(departedCandidates);
  const nearCapIds = wantSession ? await onStageNearCapIds(opts.gm, entities, skip) : [];

  const jobs: Promise<JobOk>[] = [];
  const jobKinds: Array<"departed" | "sessionNpc" | "summary"> = [];
  for (const id of departedCandidates) {
    jobKinds.push("departed");
    jobs.push(draftNpcWrite(id, opts.turnId).then((write) => ({ kind: "departed" as const, write })));
  }
  if (wantSession) {
    jobKinds.push("summary");
    jobs.push(
      (async () => {
        const jsonlText = opts.jsonlPath ? await readFile(opts.jsonlPath, "utf8") : "";
        const episodes = (await loadEpisodes()).slice(-8);
        const gmNote = await loadGmNote();
        const drafted = await modelSummary(
          { gm_note: gmNote, episodes: episodes.map((e) => e.summary), jsonl_tail: jsonlText.slice(-8000), truncated: forced },
          forced,
          opts.forceSession ? "debug compact" : undefined,
        );
        return { kind: "summary" as const, drafted, jsonlText };
      })(),
    );
    for (const id of nearCapIds) {
      jobKinds.push("sessionNpc");
      jobs.push(draftNpcWrite(id, opts.turnId).then((write) => ({ kind: "sessionNpc" as const, write })));
    }
  }

  const settled = await Promise.allSettled(jobs);
  const departedWrites: NpcWrite[] = [];
  const sessionNpcWrites: NpcWrite[] = [];
  let summaryJob: Extract<JobOk, { kind: "summary" }> | null = null;
  let sessionJobFailed = false;
  for (let i = 0; i < settled.length; i++) {
    const item = settled[i]!;
    const kind = jobKinds[i]!;
    if (item.status === "rejected") {
      const msg = item.reason instanceof Error ? item.reason.message : String(item.reason);
      turnLog("compact", `parallel fail  ${msg}`);
      if (kind === "sessionNpc" || kind === "summary") sessionJobFailed = true;
      continue;
    }
    const v = item.value;
    if (v.kind === "departed") departedWrites.push(v.write);
    else if (v.kind === "sessionNpc") sessionNpcWrites.push(v.write);
    else summaryJob = v;
  }
  if (wantSession && (sessionJobFailed || !summaryJob || sessionNpcWrites.length !== nearCapIds.length)) {
    sessionJobFailed = true;
  }

  for (const w of departedWrites) {
    await commitNpcWrite(w, opts.turnId);
    try {
      await distillDepartedNpcPsyche(w, entities);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      turnLog("compact", `psyche distill fail ${w.id}: ${msg}`);
    }
  }

  let sessionOk = false;
  let archiveId: string | undefined;
  if (wantSession && !sessionJobFailed && summaryJob) {
    const applied = await applySessionCompact({
      turnId: opts.turnId,
      gm: opts.gm,
      forced,
      jsonlPath: opts.jsonlPath,
      jsonlText: summaryJob.jsonlText,
      drafted: summaryJob.drafted,
      sessionNpcWrites,
      entities,
      fallbackTitle: opts.forceSession ? "debug compact" : undefined,
    });
    sessionOk = applied.compacted;
    archiveId = applied.archiveId;
    if (sessionOk && archiveId) {
      for (const w of departedWrites) await patchNpcSessionArchiveId(w, archiveId);
      for (const w of sessionNpcWrites) await patchNpcSessionArchiveId(w, archiveId);
    }
  }

  await saveMergedDirty({
    gm: opts.gm,
    entities,
    dirty,
    departedSuccess: departedWrites.map((w) => w.id),
    sessionOk,
    archiveId,
    sessionDistillIds: sessionOk ? sessionNpcWrites.map((w) => w.id) : [],
  });
  return { compacted: sessionOk, archiveId };
}

async function applySessionCompact(opts: {
  turnId: string;
  gm: GmOutput;
  forced: boolean;
  jsonlPath: string | null;
  jsonlText: string;
  drafted: { title: string; body: string };
  sessionNpcWrites: NpcWrite[];
  entities: Entity[];
  fallbackTitle?: string;
}): Promise<{ compacted: boolean; archiveId?: string }> {
  const scratch = join(compactScratchDir, `job-${opts.turnId}`);
  await rm(scratch, { recursive: true, force: true });
  await mkdir(scratch, { recursive: true });
  const backupDir = join(scratch, "backup");
  await mkdir(backupDir, { recursive: true });
  const index = await loadSessionArchiveIndex();
  const archiveId = await nextSessionArchiveId();
  const lastTo = index.entries[index.entries.length - 1]?.turn_to;
  const turnFrom = lastTo ? formatTurnId(turnIdToN(lastTo) + 1) : "t0001";
  let jsonlText = opts.jsonlText;
  try {
    if (!SESSION_ARCHIVE_ID_RE.test(archiveId)) throw new Error("bad archive id");
    if (opts.jsonlPath) {
      await copyFile(opts.jsonlPath, join(scratch, "session.jsonl"));
      await copyFile(opts.jsonlPath, join(backupDir, "live.jsonl"));
      jsonlText = await readFile(opts.jsonlPath, "utf8");
    } else {
      await writeFile(join(scratch, "session.jsonl"), jsonlText);
    }

    let title = opts.drafted.title;
    let body = opts.drafted.body;
    if (opts.forced) {
      if (!title.includes("非自然")) title = `非自然換幕：${title}`;
      if (!body.includes("非自然")) body = `非自然換幕。${body}`;
    } else if (opts.fallbackTitle?.trim()) {
      title = opts.fallbackTitle.trim();
    }
    const summary = SessionSummarySchema.parse({
      archive_id: archiveId,
      turn_from: turnFrom,
      turn_to: opts.turnId,
      title,
      body,
      truncated: opts.forced,
    });
    await writeFile(join(scratch, "summary.json"), JSON.stringify(summary, null, 2));

    for (const w of opts.sessionNpcWrites) {
      const curPath = join(npcMemoryDir, "l2", w.id, "current.json");
      try {
        await copyFile(curPath, join(backupDir, `${w.id}.current.json`));
      } catch {
        /* */
      }
      const idxPath = join(npcMemoryDir, "l2", w.id, "archive", "index.json");
      try {
        await copyFile(idxPath, join(backupDir, `${w.id}.archive-index.json`));
      } catch {
        /* */
      }
    }

    testHooks?.failAfterScratch?.();

    const dirtyBackup = join(backupDir, "dirty-set.json");
    try {
      await copyFile(join(npcMemoryDir, "dirty-set.json"), dirtyBackup);
    } catch {
      /* */
    }
    const stateBackup = join(backupDir, "compact-state.json");
    try {
      await copyFile(join(kbRuntimeDir, "compact-state.json"), stateBackup);
    } catch {
      /* */
    }

    try {
      await mkdir(join(sessionArchiveDir, archiveId), { recursive: true });
      await copyFile(join(scratch, "session.jsonl"), join(sessionArchiveDir, archiveId, "session.jsonl"));
      await copyFile(join(scratch, "summary.json"), join(sessionArchiveDir, archiveId, "summary.json"));
      const nextIndex = SessionArchiveIndexSchema.parse({
        entries: [
          ...index.entries,
          {
            archive_id: archiveId,
            turn_from: turnFrom,
            turn_to: opts.turnId,
            title: summary.title,
            truncated: summary.truncated,
          },
        ],
      });
      await mkdir(sessionArchiveDir, { recursive: true });
      await writeFile(join(sessionArchiveDir, "index.json"), JSON.stringify(nextIndex, null, 2));

      for (const w of opts.sessionNpcWrites) await commitNpcWrite(w, opts.turnId);

      await saveCompactState({ anchor_turn_n: turnIdToN(opts.turnId) });
      if (opts.jsonlPath) await rm(opts.jsonlPath, { force: true });
      testHooks?.failAfterApply?.();
      await disposePlaySession();
      await createPlaySession();

      const scene = (await loadScene()) ?? opts.gm.scene;
      const l2Currents = [];
      for (const id of scene.present) {
        const ent = opts.entities.find((e) => e.id === id);
        if (!ent || ent.kind !== "npc" || (ent.memory_tier ?? 0) !== 2) continue;
        const cur = await loadL2Current(id);
        if (cur) l2Currents.push({ npc_id: id, body: cur.body });
      }
      const keep = getAppConfig().compact.recent_turns_to_keep;
      const pairs = recentDialoguePairs(parseJsonlChat(jsonlText), keep);
      await promptPlayOpening(
        formatOpeningMessage({
          archiveId,
          summary,
          gmNote: await loadGmNote(),
          scene,
          l2Currents,
          pairs,
        }),
      );
    } catch (err) {
      await rollbackSessionApply({
        archiveId,
        previousIndex: index,
        npcWrites: opts.sessionNpcWrites,
        backupDir,
        jsonlPath: opts.jsonlPath,
        jsonlText,
        dirtyBackup,
        stateBackup,
      });
      throw err;
    }
    return { compacted: true, archiveId };
  } catch (err) {
    turnLog("compact", `session failed  ${err instanceof Error ? err.message : String(err)}`);
    return { compacted: false };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

async function rollbackSessionApply(opts: {
  archiveId: string;
  previousIndex: ReturnType<typeof SessionArchiveIndexSchema.parse>;
  npcWrites: NpcWrite[];
  backupDir: string;
  jsonlPath: string | null;
  jsonlText: string;
  dirtyBackup: string;
  stateBackup: string;
}): Promise<void> {
  await rm(join(sessionArchiveDir, opts.archiveId), { recursive: true, force: true });
  if (opts.previousIndex.entries.length === 0) {
    await rm(join(sessionArchiveDir, "index.json"), { force: true });
  } else {
    await writeFile(join(sessionArchiveDir, "index.json"), JSON.stringify(opts.previousIndex, null, 2));
  }
  for (const w of opts.npcWrites) {
    const dir = join(npcMemoryDir, "l2", w.id, "archive");
    await rm(join(dir, `${w.entry.npc_archive_id}.json`), { force: true });
    const bakIdx = join(opts.backupDir, `${w.id}.archive-index.json`);
    try {
      await copyFile(bakIdx, join(dir, "index.json"));
    } catch {
      await rm(join(dir, "index.json"), { force: true });
    }
    const bakCur = join(opts.backupDir, `${w.id}.current.json`);
    try {
      await copyFile(bakCur, join(npcMemoryDir, "l2", w.id, "current.json"));
    } catch {
      /* */
    }
  }
  try {
    await copyFile(opts.dirtyBackup, join(npcMemoryDir, "dirty-set.json"));
  } catch {
    /* */
  }
  try {
    await copyFile(opts.stateBackup, join(kbRuntimeDir, "compact-state.json"));
  } catch {
    /* */
  }
  if (opts.jsonlPath) {
    await mkdir(dirname(opts.jsonlPath), { recursive: true });
    await writeFile(opts.jsonlPath, opts.jsonlText);
  }
}
