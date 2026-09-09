import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { HttpError } from "./errors.ts";
import { lastAssistantText, openPiSession, parseAssistantJson } from "./gm-pi.ts";
import {
  bumpAbandonGeneration,
  compactScratchDir,
  currentAbandonGeneration,
  deletePending,
  getScreen,
  loadPending,
  loadPlayerMemory,
  savePending,
} from "./kb.ts";
import { turnLog } from "./log.ts";
import {
  DeepAdjudicationSchema,
  LiteAdjudicationSchema,
  type AdjudicationPending,
} from "./schema.ts";

const OPENING_PLAYER_TEXT = "我環顧四周。";

export const HARD_REJECT_NOTICE = "此輸入無法進入本場。";
export const DEEP_DISCUSS_FALLBACK =
  "此行動超出本場合理範圍。你可以：(1) 補充為何角色做得到；(2) 只進行合理部分，越界當作沒辦到；(3) 重寫這句（也可在故事欄直接送出新句）。";

/** 驗收／mock 給人玩共用的過線子字串。 */
export const OVERREACH_FIXTURE = "我立刻殺死在場所有人";
export const META_ACCEPT_FIXTURE = "__ACCEPT__";
export const META_SPLIT_FIXTURE = "__SPLIT__";
export const META_REVISE_FIXTURE = "__REVISE__";

const CONTRACT_ATTACK = [
  /忽略以上指令/,
  /忽略(所有|全部)?(先前|之前|以上)?(的)?指令/,
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /ignore\s+the\s+system\s+prompt/i,
  /你必須輸出\s*events/,
  /規定\s*(gm\s*)?json/i,
  /override\s+gm\s+json/i,
  /system\s+prompt\s*[:：]/i,
];

const MINOR_HARM = [/未成年/, /\bminors?\b/i, /\bunderage\b/i, /child\s*porn/i, /\bcsam\b/i];

export function isHardRejectText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return CONTRACT_ATTACK.some((re) => re.test(t)) || MINOR_HARM.some((re) => re.test(t));
}

export function hardRejectPayload(): {
  hard_reject: true;
  adjudication: null;
  notice: string;
} {
  return { hard_reject: true, adjudication: null, notice: HARD_REJECT_NOTICE };
}

export type LiteDecision = "pass" | "escalate";
export type DeepDecision = { decision: "pass" | "discuss"; message: string };

export type OverreachTestHooks = {
  lite?: (text: string) => LiteDecision | Promise<LiteDecision>;
  deep?: (text: string) => DeepDecision | Promise<DeepDecision>;
};

let testHooks: OverreachTestHooks | null = null;

export function setOverreachTestHooks(hooks: OverreachTestHooks | null): void {
  testHooks = hooks;
}

function gmMode(): "pi" | "mock" {
  return process.env.GM_MODE === "mock" ? "mock" : "pi";
}

async function loadPrompt(name: string): Promise<string> {
  return readFile(join(import.meta.dir, "..", "prompts", name), "utf8");
}

async function scratchJson(systemPrompt: string, user: string, hint: string): Promise<unknown> {
  const jobDir = join(compactScratchDir, `adj-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(jobDir, { recursive: true });
  const session = await openPiSession({
    cwd: jobDir,
    sessionDir: join(jobDir, "generate-sessions"),
    systemPrompt,
    fresh: true,
  });
  try {
    await session.prompt(user);
    await session.agent.waitForIdle();
    try {
      return parseAssistantJson(lastAssistantText(session), hint);
    } catch (first) {
      await session.prompt("Previous reply was not valid JSON. Resend ONE JSON object only. No markdown.");
      await session.agent.waitForIdle();
      return parseAssistantJson(lastAssistantText(session), `${hint}-retry`);
    }
  } finally {
    session.dispose();
    await rm(jobDir, { recursive: true, force: true });
  }
}

async function mockLite(text: string): Promise<LiteDecision> {
  if (text.includes(OVERREACH_FIXTURE)) {
    const mem = await loadPlayerMemory();
    if (mem.body.trim()) return "pass";
    return "escalate";
  }
  return "pass";
}

async function mockDeep(text: string): Promise<DeepDecision> {
  if (text.includes(OVERREACH_FIXTURE)) {
    const mem = await loadPlayerMemory();
    if (mem.body.trim()) return { decision: "pass", message: "" };
    return { decision: "discuss", message: DEEP_DISCUSS_FALLBACK };
  }
  return { decision: "pass", message: "" };
}

export async function adjudicateLite(playerText: string): Promise<LiteDecision> {
  if (playerText === OPENING_PLAYER_TEXT) return "pass";
  try {
    if (testHooks?.lite) return await testHooks.lite(playerText);
    if (gmMode() === "mock") return await mockLite(playerText);
    const memory = await loadPlayerMemory();
    const system = await loadPrompt("adjudicate-lite.md");
    const user = JSON.stringify({ player_text: playerText, player_memory: memory.body });
    const parsed = LiteAdjudicationSchema.safeParse(await scratchJson(system, user, "lite"));
    if (!parsed.success || parsed.data.decision !== "pass") return "escalate";
    return "pass";
  } catch (err) {
    turnLog("adj", `lite failed  ${err instanceof Error ? err.message : String(err)}`);
    return "escalate";
  }
}

export async function adjudicateDeep(playerText: string): Promise<DeepDecision> {
  try {
    if (testHooks?.deep) return await testHooks.deep(playerText);
    if (gmMode() === "mock") return await mockDeep(playerText);
    const { loadGmNote } = await import("./kb.ts");
    const memory = await loadPlayerMemory();
    const gmNote = (await loadGmNote()).slice(0, 400);
    const system = await loadPrompt("adjudicate-deep.md");
    const user = JSON.stringify({ player_text: playerText, player_memory: memory.body, gm_note: gmNote });
    const parsed = DeepAdjudicationSchema.safeParse(await scratchJson(system, user, "deep"));
    if (!parsed.success || parsed.data.decision !== "pass") {
      const message = parsed.success ? parsed.data.message.trim() : "";
      return { decision: "discuss", message: message || DEEP_DISCUSS_FALLBACK };
    }
    return { decision: "pass", message: parsed.data.message };
  } catch (err) {
    turnLog("adj", `deep failed  ${err instanceof Error ? err.message : String(err)}`);
    return { decision: "discuss", message: DEEP_DISCUSS_FALLBACK };
  }
}

export async function openDiscussPending(playerText: string, message: string): Promise<AdjudicationPending> {
  const { createMetaSession } = await import("./gm-meta.ts");
  const metaId = await createMetaSession();
  const pending: AdjudicationPending = {
    original_player_text: playerText,
    created_turn_id: "",
    meta_session_id: metaId,
    messages: [{ role: "gm", text: message.trim() || DEEP_DISCUSS_FALLBACK }],
  };
  await savePending(pending);
  return pending;
}

export function pendingResponse(pending: AdjudicationPending): {
  adjudication: { status: "pending" };
  gm_chat: { messages: AdjudicationPending["messages"] };
} {
  return {
    adjudication: { status: "pending" },
    gm_chat: { messages: pending.messages },
  };
}

export async function abandonPendingForNewTurn(): Promise<void> {
  if (!(await loadPending())) return;
  const { disposeMetaSession } = await import("./gm-meta.ts");
  await disposeMetaSession();
  bumpAbandonGeneration();
  await deletePending();
}

export async function assertNotAbandoned(gen: number): Promise<void> {
  if (currentAbandonGeneration() !== gen) {
    const screen = await getScreen();
    throw new HttpError(409, { error: screen === "playing" ? "not_pending" : "not_playing" });
  }
  if ((await getScreen()) !== "playing") {
    throw new HttpError(409, { error: "not_playing", needs_setup: true });
  }
  if (!(await loadPending())) {
    throw new HttpError(409, { error: "not_pending" });
  }
}
