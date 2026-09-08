import { mkdir, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRuntime,
  resolveCliModel,
  SessionManager,
  SettingsManager,
  type AgentSession,
} from "@earendil-works/pi-coding-agent";
import { HttpError } from "./errors.ts";
import { getNeedsSetup, getScreen, kbRuntimeDir, loadCompactState, loadCustomGmCanon, loadEntities, migratePlaySessionDir, playSessionsDir, syncWorldGate } from "./kb.ts";
import { parseGmOutput, type Entity, type GmContext, type GmOutput } from "./schema.ts";
import { debugEnabled, debugLog, turnLog } from "./log.ts";

const root = join(import.meta.dir, "..");

let session: AgentSession | undefined;
let boot: Promise<AgentSession> | undefined;
let turnLock: Promise<void> = Promise.resolve();

export function parseAssistantJson(raw: string, hint = "assistant"): unknown {
  if (debugEnabled()) debugLog("parse", `${hint} raw chars=${raw.length}\n${raw}`);
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = (fence?.[1] ?? raw).trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    debugLog("parse", `${hint} no JSON object\n${text}`);
    throw new Error(`GM (pi) did not return JSON: ${text.slice(0, 240)}`);
  }
  const slice = text.slice(start, end + 1);
  if (debugEnabled()) debugLog("parse", `${hint} slice chars=${slice.length}\n${slice}`);
  try {
    return JSON.parse(slice);
  } catch {
    const repaired = slice
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2018\u2019]/g, "'");
    try {
      return JSON.parse(repaired);
    } catch {
      debugLog("parse", `${hint} JSON.parse failed\n${slice}`);
      throw new Error(`JSON Parse error: ${slice.slice(0, 240)}`);
    }
  }
}

export function lastAssistantText(s: AgentSession): string {
  const msgs = s.messages;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (!m || m.role !== "assistant") continue;
    const parts = m.content;
    if (!Array.isArray(parts)) continue;
    const text = parts
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("");
    if (text.trim()) return text;
  }
  const err = s.agent.state.errorMessage;
  throw new Error(err ? `GM (pi) error: ${err}` : "GM (pi) empty assistant text");
}

function formatNpcPersonas(entities: Entity[]): string[] {
  return entities
    .filter((e) => e.kind === "npc" && (e.persona ?? "").trim().length > 0)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((e) => `## NPC ${e.id} (${e.name})\n${e.persona!.trim()}`);
}

export async function buildPlaySystemPrompt(): Promise<string> {
  const gate = await syncWorldGate();
  if (gate.needs_setup || !gate.world) {
    throw new HttpError(409, { needs_setup: true, error: "needs_setup" });
  }
  const world = gate.world;
  const contract = await readFile(join(root, "prompts", "gm-contract.md"), "utf8");
  const parts = [contract];
  if (world.source === "custom") {
    parts.push(await loadCustomGmCanon());
  } else {
    parts.push(await readFile(join(root, "prompts", "gm-default.md"), "utf8"));
  }
  parts.push(...formatNpcPersonas(await loadEntities()));
  return parts.join("\n\n");
}

export async function openPiSession(opts: {
  cwd: string;
  sessionDir: string;
  systemPrompt: string;
  fresh: boolean;
}): Promise<AgentSession> {
  turnLog("pi", opts.fresh ? "new session…" : "open/continue session…");
  const modelRuntime = await ModelRuntime.create();
  const key = process.env.OPENROUTER_API_KEY;
  if (key) {
    await modelRuntime.setRuntimeApiKey("openrouter", key);
  }

  const cliModel = resolveCliModel({
    cliModel: process.env.PI_MODEL ?? "openrouter/deepseek/deepseek-v4-flash:off",
    modelRuntime,
  });
  if (cliModel.error) throw new Error(`PI_MODEL: ${cliModel.error}`);
  if (!cliModel.model) throw new Error("PI_MODEL resolved to no model");

  const agentDir = getAgentDir();
  const loader = new DefaultResourceLoader({
    cwd: opts.cwd,
    agentDir,
    systemPromptOverride: () =>
      `${opts.systemPrompt}\n\nReply with a single JSON object only. No markdown, no tools.`,
    agentsFilesOverride: () => ({ agentsFiles: [] }),
    skillsOverride: (current) => ({ skills: [], diagnostics: current.diagnostics }),
  });
  await loader.reload();

  const settingsManager = SettingsManager.inMemory({
    retry: { enabled: true, maxRetries: 2 },
  });

  await mkdir(opts.sessionDir, { recursive: true });
  const sessionManager = opts.fresh
    ? SessionManager.create(opts.cwd, opts.sessionDir)
    : SessionManager.continueRecent(opts.cwd, opts.sessionDir);

  const { session: created, modelFallbackMessage } = await createAgentSession({
    cwd: opts.cwd,
    agentDir,
    model: cliModel.model,
    thinkingLevel: cliModel.thinkingLevel ?? "off",
    modelRuntime,
    noTools: "all",
    resourceLoader: loader,
    sessionManager,
    settingsManager,
  });
  if (modelFallbackMessage) console.warn("pi model fallback:", modelFallbackMessage);
  created.setThinkingLevel("off");
  let chars = 0;
  created.subscribe((event) => {
    if (event.type === "agent_start") {
      chars = 0;
      turnLog("pi", "model generating…");
    }
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      chars += event.assistantMessageEvent.delta.length;
    }
    if (event.type === "agent_end") turnLog("pi", `model done  chars≈${chars}`);
    if (event.type === "auto_retry_start") {
      turnLog("pi", `retry ${event.attempt}/${event.maxAttempts}  ${event.errorMessage.slice(0, 120)}`);
    }
  });
  turnLog("pi", `session ready  model=${cliModel.model.id}  id=${created.sessionId}`);
  return created;
}

async function hasPlayJsonl(): Promise<boolean> {
  await migratePlaySessionDir();
  const sessionDir = playSessionsDir;
  try {
    const names = await readdir(sessionDir);
    return names.some((n) => n.endsWith(".jsonl"));
  } catch {
    return false;
  }
}

async function openOrContinuePlaySession(): Promise<AgentSession> {
  await loadCompactState();
  const systemPrompt = await buildPlaySystemPrompt();
  const fresh = !(await hasPlayJsonl());
  return openPiSession({
    cwd: kbRuntimeDir,
    sessionDir: playSessionsDir,
    systemPrompt,
    fresh,
  });
}

async function getSession(): Promise<AgentSession> {
  if ((await getScreen()) !== "playing") {
    throw new HttpError(409, { error: "not_playing", needs_setup: true });
  }
  if (await getNeedsSetup()) {
    throw new HttpError(409, { needs_setup: true, error: "needs_setup" });
  }
  if (session) return session;
  boot ??= openOrContinuePlaySession().then((s) => {
    session = s;
    return s;
  });
  return boot;
}

export async function disposePlaySession(): Promise<void> {
  session?.dispose();
  session = undefined;
  boot = undefined;
}

export async function createPlaySession(): Promise<void> {
  if (process.env.GM_MODE === "mock") return;
  await disposePlaySession();
  const systemPrompt = await buildPlaySystemPrompt();
  session = await openPiSession({
    cwd: kbRuntimeDir,
    sessionDir: playSessionsDir,
    systemPrompt,
    fresh: true,
  });
  boot = Promise.resolve(session);
}

/** After load: continue jsonl if present, else fresh session. */
export async function openLoadedPlaySession(): Promise<void> {
  if (process.env.GM_MODE === "mock") return;
  await disposePlaySession();
  session = await openOrContinuePlaySession();
  boot = Promise.resolve(session);
}

export async function promptPlayOpening(text: string): Promise<void> {
  if (process.env.GM_MODE === "mock") return;
  const s = await getSession();
  await s.prompt(text);
  await s.agent.waitForIdle();
}

export async function piGm(ctx: GmContext): Promise<GmOutput> {
  let release!: () => void;
  const prev = turnLock;
  turnLock = new Promise<void>((r) => {
    release = r;
  });
  await prev;
  try {
    const s = await getSession();
    turnLog(ctx.turn_id, "pi   prompt()");
    const t0 = Date.now();
    const hb = setInterval(() => {
      turnLog(ctx.turn_id, `pi   waiting ${Math.round((Date.now() - t0) / 1000)}s`);
    }, 2000);
    const turnPrompt = [
      "This is one game turn. Do NOT echo the input JSON. Output GM keys only: narration, npc_lines, events, gm_note, scene, ui, needs_image.",
      "If anyone speaks, including telepathy or a voice in the player's head, npc_lines MUST be a non-empty array of {npc_id, name, text} with the actual words. Do not put those words only in events or gm_note.",
      JSON.stringify(ctx),
    ].join("\n");
    try {
      await s.prompt(turnPrompt);
      await s.agent.waitForIdle();
    } finally {
      clearInterval(hb);
    }
    turnLog(ctx.turn_id, `pi   idle  ${Date.now() - t0}ms`);
    try {
      return parseGmOutput(parseAssistantJson(lastAssistantText(s), ctx.turn_id));
    } catch (first) {
      turnLog(ctx.turn_id, `pi   JSON retry (${first instanceof Error ? first.message : first})`);
      const t1 = Date.now();
      const hb2 = setInterval(() => {
        turnLog(ctx.turn_id, `pi   retry waiting ${Math.round((Date.now() - t1) / 1000)}s`);
      }, 2000);
      try {
        await s.prompt(
          [
            "Previous JSON was invalid for the game contract.",
            "Resend ONE JSON object with non-empty narration (scene prose, not player_text).",
            "npc_lines[].npc_id must be the actual speaker; new characters need a new id and name.",
            "Keys: narration, npc_lines, events, gm_note, scene, ui, needs_image.",
          ].join(" "),
        );
        await s.agent.waitForIdle();
      } finally {
        clearInterval(hb2);
      }
      return parseGmOutput(parseAssistantJson(lastAssistantText(s), `${ctx.turn_id}-retry`));
    }
  } finally {
    release();
  }
}
