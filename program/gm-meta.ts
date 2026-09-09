import { mkdir, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { HttpError } from "./errors.ts";
import { lastAssistantText, openPiSession, parseAssistantJson } from "./gm-pi.ts";
import {
  appendPlayerMemoryPatchAt,
  currentAbandonGeneration,
  deletePending,
  getScreen,
  gmMetaSessionsDir,
  getActiveWorldId,
  loadGmNote,
  loadPending,
  loadPlayerMemory,
  savePending,
  savePlayerMemoryAt,
  syncWorldGate,
} from "./kb.ts";
import { turnLog } from "./log.ts";
import {
  assertNotAbandoned,
  DEEP_DISCUSS_FALLBACK,
  hardRejectPayload,
  HARD_REJECT_NOTICE,
  isHardRejectText,
  META_ACCEPT_FIXTURE,
  META_REVISE_FIXTURE,
  META_SPLIT_FIXTURE,
  pendingResponse,
} from "./overreach.ts";
import { GmChatBodySchema, GmMetaOutputSchema, type GmMetaOutput } from "./schema.ts";
import { runTurn, type TurnResult } from "./turn.ts";
import type { AgentSession } from "@earendil-works/pi-coding-agent";

const TALK_FALLBACK = "請再回覆一次，或選 (1) 補充能力依據、(2) 只進行合理部分、(3) 重寫這句。";
const EMPTY_PATCH_MESSAGE = "請補充角色為何做得到（會寫入本場已承認能力），或改選 (2)／(3)。";
const EMPTY_SPLIT_MESSAGE = "請說明哪些部分成立、哪些做不到，或改選 (1)／(3)。";
const STORY_FAIL_NOTICE = "故事尚未寫成，請稍後再試或改選 (3) 重寫。";

let metaSession: AgentSession | undefined;
let metaBoot: Promise<AgentSession> | undefined;
let metaBoundId: string | null = null;

export type OverreachMetaHooks = {
  meta?: (text: string) => GmMetaOutput | Promise<GmMetaOutput>;
  /** 測試用：本拍 patch 已 append、故事 GM 尚未跑。 */
  afterAppend?: () => void | Promise<void>;
};

let metaHooks: OverreachMetaHooks | null = null;

export function setMetaTestHooks(hooks: OverreachMetaHooks | null): void {
  metaHooks = hooks;
}

function gmMode(): "pi" | "mock" {
  return process.env.GM_MODE === "mock" ? "mock" : "pi";
}

function metaSessionDir(id: string): string {
  return join(gmMetaSessionsDir, id);
}

export async function disposeMetaSession(): Promise<void> {
  metaSession?.dispose();
  metaSession = undefined;
  metaBoot = undefined;
  metaBoundId = null;
}

export async function createMetaSession(): Promise<string> {
  await disposeMetaSession();
  const id = randomUUID();
  await mkdir(metaSessionDir(id), { recursive: true });
  if (gmMode() !== "mock") {
    const system = await readFile(join(import.meta.dir, "..", "prompts", "gm-meta.md"), "utf8");
    metaSession = await openPiSession({
      cwd: kbCwd(),
      sessionDir: metaSessionDir(id),
      systemPrompt: system,
      fresh: true,
    });
    metaBoot = Promise.resolve(metaSession);
    metaBoundId = id;
  } else {
    metaBoundId = id;
  }
  return id;
}

function kbCwd(): string {
  return join(gmMetaSessionsDir, "..");
}

async function continueMetaSession(id: string): Promise<AgentSession> {
  if (metaSession && metaBoundId === id) return metaSession;
  await disposeMetaSession();
  const system = await readFile(join(import.meta.dir, "..", "prompts", "gm-meta.md"), "utf8");
  const names = await readdir(metaSessionDir(id)).catch(() => [] as string[]);
  const fresh = !names.some((n) => n.endsWith(".jsonl"));
  metaSession = await openPiSession({
    cwd: kbCwd(),
    sessionDir: metaSessionDir(id),
    systemPrompt: system,
    fresh,
  });
  metaBoot = Promise.resolve(metaSession);
  metaBoundId = id;
  return metaSession;
}

function mockMeta(text: string): GmMetaOutput {
  if (text.includes(META_ACCEPT_FIXTURE)) {
    return {
      disposition: "pass_original",
      message: "本場承認你補充的能力。",
      player_memory_patch: "本場承認玩家具有所述能力。",
      split_constraint: "",
    };
  }
  if (text.includes(META_SPLIT_FIXTURE)) {
    return {
      disposition: "split",
      message: "只進行合理部分。",
      player_memory_patch: "",
      split_constraint: "越界段失敗，僅合理嘗試可成立。events 不得把過線寫成已發生。",
    };
  }
  if (text.includes(META_REVISE_FIXTURE)) {
    return {
      disposition: "revise",
      message: "請重寫這句故事輸入。",
      player_memory_patch: "",
      split_constraint: "",
    };
  }
  return { disposition: "talk", message: DEEP_DISCUSS_FALLBACK, player_memory_patch: "", split_constraint: "" };
}

async function callMeta(playerText: string, pending: NonNullable<Awaited<ReturnType<typeof loadPending>>>): Promise<GmMetaOutput> {
  if (metaHooks?.meta) return GmMetaOutputSchema.parse(await metaHooks.meta(playerText));
  if (gmMode() === "mock") return mockMeta(playerText);
  const memory = await loadPlayerMemory();
  const gmNote = (await loadGmNote()).slice(0, 400);
  const s = await continueMetaSession(pending.meta_session_id);
  const prompt = JSON.stringify({
    original_player_text: pending.original_player_text,
    player_reply: playerText,
    player_memory: memory.body,
    gm_note: gmNote,
  });
  await s.prompt(prompt);
  await s.agent.waitForIdle();
  const parsed = GmMetaOutputSchema.safeParse(parseAssistantJson(lastAssistantText(s), "gm-meta"));
  if (!parsed.success) {
    return { disposition: "talk", message: TALK_FALLBACK, player_memory_patch: "", split_constraint: "" };
  }
  return parsed.data;
}

function coerceTalk(out: GmMetaOutput, message: string): GmMetaOutput {
  return { ...out, disposition: "talk", message, player_memory_patch: "", split_constraint: "" };
}

export async function runGmChat(raw: unknown): Promise<Record<string, unknown>> {
  const gen = currentAbandonGeneration();
  if ((await getScreen()) !== "playing") {
    throw new HttpError(409, { error: "not_playing", needs_setup: true });
  }
  const worldId = getActiveWorldId();
  if (!worldId) {
    throw new HttpError(409, { error: "not_playing", needs_setup: true });
  }
  const gate = await syncWorldGate();
  if (gate.needs_setup) {
    throw new HttpError(409, { needs_setup: true, error: "needs_setup" });
  }
  const parsedBody = GmChatBodySchema.safeParse(raw);
  if (!parsedBody.success) {
    throw new HttpError(400, { error: "text_required" });
  }
  const text = parsedBody.data.text.trim();
  let pending = await loadPending();
  if (!pending) {
    throw new HttpError(409, { error: "not_pending" });
  }

  await assertNotAbandoned(gen);
  pending = {
    ...pending,
    messages: [...pending.messages, { role: "player", text }],
  };
  await savePending(pending);

  let out: GmMetaOutput;
  try {
    out = await callMeta(text, pending);
  } catch {
    out = { disposition: "talk", message: TALK_FALLBACK, player_memory_patch: "", split_constraint: "" };
  }

  await assertNotAbandoned(gen);

  if (isHardRejectText(text) || out.disposition === "hard_reject") {
    await deletePending();
    await disposeMetaSession();
    return { ...hardRejectPayload(), gm_chat: { messages: pending.messages } };
  }

  if (out.disposition === "pass_original" && !out.player_memory_patch.trim()) {
    out = coerceTalk(out, EMPTY_PATCH_MESSAGE);
  }
  if (out.disposition === "split" && !out.split_constraint.trim()) {
    out = coerceTalk(out, EMPTY_SPLIT_MESSAGE);
  }
  if (!out.message.trim() && out.disposition === "talk") {
    out = { ...out, message: TALK_FALLBACK };
  }

  pending = {
    ...pending,
    messages: [...pending.messages, { role: "gm", text: out.message.trim() || TALK_FALLBACK }],
  };
  await savePending(pending);

  if (out.disposition === "talk") {
    return { ...pendingResponse(pending) };
  }

  if (out.disposition === "revise") {
    await deletePending();
    await disposeMetaSession();
    return { adjudication: null, gm_chat: { messages: pending.messages } };
  }

  await assertNotAbandoned(gen);

  let prevBody: string | null = null;
  let storyLanded = false;
  try {
    if (isHardRejectText(pending.original_player_text)) {
      await deletePending();
      await disposeMetaSession();
      return { ...hardRejectPayload(), gm_chat: { messages: pending.messages } };
    }

    if (out.disposition === "pass_original") {
      prevBody = await appendPlayerMemoryPatchAt(worldId, out.player_memory_patch);
      if (metaHooks?.afterAppend) await metaHooks.afterAppend();
    }
    await assertNotAbandoned(gen);

    const story = (await runTurn(
      { player_text: pending.original_player_text },
      {
        skipOverreach: true,
        fromPending: true,
        splitConstraint: out.disposition === "split" ? out.split_constraint : undefined,
        abandonGeneration: gen,
      },
    )) as TurnResult;

    if ("hard_reject" in story && story.hard_reject) {
      if (prevBody != null) await savePlayerMemoryAt(worldId, { body: prevBody });
      await deletePending();
      await disposeMetaSession();
      return { ...hardRejectPayload(), gm_chat: { messages: pending.messages } };
    }

    if (!("gm" in story) || !story.gm) {
      if (prevBody != null) await savePlayerMemoryAt(worldId, { body: prevBody });
      return { ...pendingResponse(pending), notice: STORY_FAIL_NOTICE };
    }

    storyLanded = true;
    await assertNotAbandoned(gen);

    await deletePending();
    await disposeMetaSession();
    return {
      adjudication: null,
      gm_chat: { messages: pending.messages },
      turn_id: story.turn_id,
      gm: story.gm,
      episodes_written: story.episodes_written,
    };
  } catch (err) {
    if (prevBody != null && !storyLanded) {
      try {
        await savePlayerMemoryAt(worldId, { body: prevBody });
      } catch {
        /* keep pending */
      }
    }
    if (err instanceof HttpError && (err.body.error === "not_playing" || err.body.error === "not_pending")) {
      throw err;
    }
    turnLog("meta", `story failed  ${err instanceof Error ? err.message : String(err)}`);
    const still = await loadPending();
    if (!still) {
      throw err instanceof HttpError ? err : new HttpError(409, { error: "not_pending" });
    }
    return { ...pendingResponse(still), notice: STORY_FAIL_NOTICE };
  }
}

void metaBoot;
