import {
  loadDirtySet,
  loadEntities,
  loadL2Current,
  loadL2Psyche,
  loadNpcPool,
  removeL2Dir,
  saveDirtySet,
  saveEntities,
  saveL2Current,
  saveL2Psyche,
  saveNpcPool,
} from "./kb.ts";
import type {
  DirtySet,
  Entity,
  EventDraft,
  GmContext,
  GmOutput,
  L2Current,
  MemorySlice,
  NpcMemorySnippet,
  NpcPool,
  NpcPoolEntry,
  NpcPsyche,
  SceneState,
} from "./schema.ts";
import { emptyNpcPsyche, npcPsycheFields } from "./schema.ts";

export const TRIVIAL_ACTIONS = new Set([
  "greet",
  "welcome",
  "idle",
  "serve",
  "nod",
  "wave",
  "smalltalk",
]);

export const POOL_BODY_MAX = 600;
export const NEAR_CAP_MIN = 640;
export const L0_FORGET_GAP = 12;
export const L0_POOL_TOTAL_MAX = 4000;
export const LINE_ONLY_MAX = 16;
export const DIGEST_MAX = 80;

let promoteL2FailHook: (() => void) | null = null;

/** 測試入口：在 current.json 已寫、尚未改 entity.memory_tier 時呼叫。禁止接 HTTP。 */
export function setPromoteL2FailHook(hook: (() => void) | null): void {
  promoteL2FailHook = hook;
}

export function turnIdToN(turnId: string): number {
  const n = Number.parseInt(turnId.replace(/^t/i, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function clipEnd(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max);
}

function eventIsTrivial(event: EventDraft): boolean {
  return TRIVIAL_ACTIONS.has(event.action.trim().toLowerCase());
}

function involvesPlayerAndId(event: EventDraft, id: string): boolean {
  const actors = event.actors;
  return actors.includes(id) && actors.includes("player") && actors.some((a) => a !== "player");
}

function canWriteBody(id: string, gm: GmOutput): boolean {
  if (gm.events.some((e) => e.actors.includes(id))) return true;
  if (gm.npc_lines.some((l) => l.npc_id === id)) return true;
  return false;
}

function linesFor(id: string, gm: GmOutput): string[] {
  return gm.npc_lines.filter((l) => l.npc_id === id).map((l) => l.text.trim());
}

function isDialogueOnlyTrivial(id: string, gm: GmOutput): boolean {
  if (gm.events.some((e) => e.actors.includes(id))) return false;
  const nonTrivialRelation = gm.events.some((e) => !eventIsTrivial(e) && involvesPlayerAndId(e, id));
  if (nonTrivialRelation) return false;
  const lines = linesFor(id, gm);
  if (lines.length === 0) return false;
  return lines.every((t) => t.length <= LINE_ONLY_MAX);
}

export function isTrivialNpcTurn(id: string, gm: GmOutput): boolean {
  const actorEvents = gm.events.filter((e) => e.actors.includes(id));
  const hasNonTrivialEvent = actorEvents.some((e) => !eventIsTrivial(e));
  if (hasNonTrivialEvent) return false;
  if (actorEvents.length > 0 && actorEvents.every(eventIsTrivial)) return true;
  return isDialogueOnlyTrivial(id, gm);
}

function qualifiesPromote0to1(id: string, gm: GmOutput, trivial: boolean): boolean {
  if (trivial) return false;
  if (!canWriteBody(id, gm)) return false;
  const hasNonTrivialActor = gm.events.some((e) => e.actors.includes(id) && !eventIsTrivial(e));
  const hasNonTrivialRelation = gm.events.some((e) => !eventIsTrivial(e) && involvesPlayerAndId(e, id));
  const lines = linesFor(id, gm);
  const longLine = lines.some((t) => t.length > LINE_ONLY_MAX);
  return hasNonTrivialActor || hasNonTrivialRelation || (lines.length > 0 && longLine);
}

function digestFor(id: string, gm: GmOutput): string {
  const hit =
    gm.events.find((e) => e.actors.includes(id) && !eventIsTrivial(e)) ??
    gm.events.find((e) => e.actors.includes(id));
  const raw = hit?.summary?.trim() || "知情有變";
  return clipEnd(raw, DIGEST_MAX);
}

function candidateBody(oldBody: string, turnId: string, digest: string): string {
  const line = `${turnId} ${clipEnd(digest, DIGEST_MAX)}`;
  const old = oldBody.trim();
  return old ? `${old}\n${line}` : line;
}

function npcTier(entity: Entity | undefined): 0 | 1 | 2 {
  if (!entity || entity.kind !== "npc") return 0;
  return entity.memory_tier ?? 0;
}

function setNpcTier(entities: Entity[], id: string, tier: 0 | 1 | 2): void {
  const e = entities.find((x) => x.id === id);
  if (e && e.kind === "npc") e.memory_tier = tier;
}

function forgetL0(pool: NpcPool, currentN: number): void {
  for (const [id, entry] of Object.entries(pool.npcs)) {
    if (entry.tier === 0 && currentN - entry.last_substantive_turn >= L0_FORGET_GAP) {
      delete pool.npcs[id];
    }
  }
  let total = Object.values(pool.npcs)
    .filter((e) => e.tier === 0)
    .reduce((n, e) => n + e.body.length, 0);
  if (total <= L0_POOL_TOTAL_MAX) return;
  const oldest = Object.entries(pool.npcs)
    .filter(([, e]) => e.tier === 0)
    .sort((a, b) => {
      const d = a[1].last_substantive_turn - b[1].last_substantive_turn;
      return d !== 0 ? d : a[0] < b[0] ? -1 : 1;
    });
  for (const [id, entry] of oldest) {
    if (total <= L0_POOL_TOTAL_MAX) break;
    total -= entry.body.length;
    delete pool.npcs[id];
  }
}

async function recountNearCap(entities: Entity[]): Promise<string[]> {
  const near: string[] = [];
  for (const e of entities) {
    if (e.kind !== "npc" || (e.memory_tier ?? 0) !== 2) continue;
    const cur = await loadL2Current(e.id);
    if (cur && cur.body.length >= NEAR_CAP_MIN) near.push(e.id);
  }
  return near;
}

async function promoteToL2(opts: {
  id: string;
  body: string;
  currentN: number;
  pool: NpcPool;
  entities: Entity[];
  written: Set<string>;
}): Promise<void> {
  const { id, body, currentN, pool, entities, written } = opts;
  const poolBackup = pool.npcs[id] ? { ...pool.npcs[id] } : undefined;
  const entityBackup = npcTier(entities.find((e) => e.id === id));
  delete pool.npcs[id];
  const current: L2Current = {
    npc_id: id,
    body: body.trim(),
    updated_turn: currentN,
  };
  try {
    await saveL2Current(current);
    await saveL2Psyche(emptyNpcPsyche(id));
    promoteL2FailHook?.();
    setNpcTier(entities, id, 2);
    written.add(id);
  } catch (err) {
    await removeL2Dir(id);
    if (poolBackup) pool.npcs[id] = poolBackup;
    setNpcTier(entities, id, entityBackup === 2 ? 1 : entityBackup);
    throw err;
  }
}

function writePoolEntry(
  pool: NpcPool,
  id: string,
  tier: 0 | 1,
  body: string,
  lastSubstantive: number,
): void {
  const clipped = clipEnd(body.trim(), POOL_BODY_MAX);
  if (!clipped) {
    delete pool.npcs[id];
    return;
  }
  pool.npcs[id] = { tier, last_substantive_turn: lastSubstantive, body: clipped };
}

export function assembleNpcMemories(input: {
  scene: SceneState;
  entities: Entity[];
  pool: NpcPool;
  l2ById: Map<string, L2Current | null>;
  l2PsycheById?: Map<string, NpcPsyche>;
}): NpcMemorySnippet[] {
  const byId = new Map(input.entities.map((e) => [e.id, e] as const));
  const out: NpcMemorySnippet[] = [];
  for (const id of input.scene.present) {
    const ent = byId.get(id);
    if (!ent || ent.kind !== "npc") continue;
    const tier = npcTier(ent);
    if (tier === 2) {
      const cur = input.l2ById.get(id);
      if (cur && cur.npc_id === id) {
        const psyche = input.l2PsycheById?.get(id) ?? emptyNpcPsyche(id);
        out.push({ npc_id: id, tier: 2, body: cur.body, psyche: npcPsycheFields(psyche) });
      }
      continue;
    }
    const entry = input.pool.npcs[id];
    if (!entry) continue;
    out.push({ npc_id: id, tier: entry.tier, body: entry.body });
  }
  return out;
}

export function buildGmContext(input: {
  player_text: string;
  gm_note: string;
  scene: SceneState;
  memory_slice: MemorySlice;
  turn_id: string;
  timestamp: string;
  entities: Entity[];
  pool: NpcPool;
  l2ById: Map<string, L2Current | null>;
  l2PsycheById?: Map<string, NpcPsyche>;
  player_memory?: { body: string };
  split_constraint?: string;
}): GmContext {
  const ctx: GmContext = {
    player_text: input.player_text,
    gm_note: input.gm_note,
    scene: input.scene,
    memory_slice: input.memory_slice,
    turn_id: input.turn_id,
    timestamp: input.timestamp,
    npc_memories: assembleNpcMemories(input),
    player_memory: { body: input.player_memory?.body ?? "" },
  };
  if (input.split_constraint?.trim()) ctx.split_constraint = input.split_constraint.trim();
  return ctx;
}

export async function loadL2MapForPresent(scene: SceneState, entities: Entity[]): Promise<Map<string, L2Current | null>> {
  const byId = new Map(entities.map((e) => [e.id, e] as const));
  const map = new Map<string, L2Current | null>();
  for (const id of scene.present) {
    const ent = byId.get(id);
    if (!ent || ent.kind !== "npc" || npcTier(ent) !== 2) continue;
    map.set(id, await loadL2Current(id));
  }
  return map;
}

export async function loadL2PsycheMapForPresent(scene: SceneState, entities: Entity[]): Promise<Map<string, NpcPsyche>> {
  const byId = new Map(entities.map((e) => [e.id, e] as const));
  const map = new Map<string, NpcPsyche>();
  for (const id of scene.present) {
    const ent = byId.get(id);
    if (!ent || ent.kind !== "npc" || npcTier(ent) !== 2) continue;
    map.set(id, await loadL2Psyche(id));
  }
  return map;
}

export async function updateNpcMemories(gm: GmOutput, turnId: string): Promise<void> {
  const currentN = turnIdToN(turnId);
  const entities = await loadEntities();
  const pool = await loadNpcPool();
  const dirty = await loadDirtySet();
  const written = new Set<string>();
  const startTier = new Map(entities.filter((e) => e.kind === "npc").map((e) => [e.id, npcTier(e)] as const));

  const ids = new Set<string>();
  for (const e of entities) {
    if (e.kind === "npc") ids.add(e.id);
  }
  for (const ev of gm.events) {
    for (const a of ev.actors) ids.add(a);
  }
  for (const line of gm.npc_lines) ids.add(line.npc_id);

  for (const id of ids) {
    const ent = entities.find((e) => e.id === id);
    if (!ent || ent.kind !== "npc") continue;
    const began = startTier.get(id) ?? npcTier(ent);
    const writable = canWriteBody(id, gm);
    if (!writable) continue;

    const trivial = isTrivialNpcTurn(id, gm);
    if (trivial && began === 2) continue;

    const oldPool: NpcPoolEntry | undefined = pool.npcs[id];
    const oldBody = began === 2 ? ((await loadL2Current(id))?.body ?? "") : (oldPool?.body ?? "");
    const candidate = candidateBody(oldBody, turnId, digestFor(id, gm));
    let workingTier: 0 | 1 | 2 = began;

    if (workingTier === 0 && qualifiesPromote0to1(id, gm, trivial)) {
      workingTier = 1;
      setNpcTier(entities, id, 1);
    }

    if (workingTier === 0 && candidate.trim().length > POOL_BODY_MAX && qualifiesPromote0to1(id, gm, trivial)) {
      workingTier = 1;
      setNpcTier(entities, id, 1);
    }

    if ((began === 1 || workingTier === 1) && workingTier !== 2 && candidate.trim().length > POOL_BODY_MAX) {
      await promoteToL2({ id, body: candidate, currentN, pool, entities, written });
      continue;
    }

    if (began === 2 && writable && !trivial) {
      await saveL2Current({
        npc_id: id,
        body: candidate.trim(),
        updated_turn: currentN,
      });
      written.add(id);
      continue;
    }

    if (workingTier === 2) continue;

    const poolTier: 0 | 1 = workingTier === 1 ? 1 : 0;
    const existing = pool.npcs[id];
    let last = existing?.last_substantive_turn ?? currentN;
    if (!existing) last = currentN;
    else if (!trivial) last = currentN;
    writePoolEntry(pool, id, poolTier, candidate, last);
    if (pool.npcs[id]) written.add(id);
  }

  forgetL0(pool, currentN);
  await saveNpcPool(pool);
  await saveEntities(entities);

  const touched = [...new Set([...dirty.touched, ...written])];
  const near_cap = await recountNearCap(entities);
  const next: DirtySet = { since_session_archive: dirty.since_session_archive, touched, near_cap };
  await saveDirtySet(next);
}
