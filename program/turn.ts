import { HttpError } from "./errors.ts";
import { maybeCompactAfterTurn } from "./compact.ts";
import { mockGm } from "./gm-mock.ts";
import { piGm } from "./gm-pi.ts";
import {
  appendChatTail,
  buildMemorySlice,
  currentAbandonGeneration,
  getScreen,
  loadEntities,
  loadEpisodes,
  loadGmNote,
  loadNpcPool,
  loadPending,
  loadPlayerMemory,
  loadScene,
  nextTurnId,
  saveGmNote,
  syncWorldGate,
} from "./kb.ts";
import { turnLog } from "./log.ts";
import { buildGmContext, loadL2MapForPresent, loadL2PsycheMapForPresent } from "./npc-memory.ts";
import {
  adjudicateDeep,
  adjudicateLite,
  hardRejectPayload,
  isHardRejectText,
  openDiscussPending,
  pendingResponse,
} from "./overreach.ts";
import { formatRecallForGm, gatherRecallSnippets } from "./recall.ts";
import { parseGmOutput, PlayerInputSchema, type GmOutput, type PlayerInput } from "./schema.ts";
import { writeFromGm } from "./writer.ts";

/** 隱式開場舉動（寫進 KB，UI 不顯示玩家氣泡）。場景中性：不假設門／室內／特定地貌。 */
export const OPENING_PLAYER_TEXT = "我環顧四周。";

export type StoryTurnResult = {
  turn_id: string;
  gm: GmOutput;
  episodes_written: number;
  adjudication: null;
};

export type PendingTurnResult = {
  adjudication: { status: "pending" };
  gm_chat: { messages: { role: "gm" | "player"; text: string }[] };
};

export type HardRejectTurnResult = {
  hard_reject: true;
  adjudication: null;
  notice: string;
};

export type TurnResult = StoryTurnResult | PendingTurnResult | HardRejectTurnResult;

export type RunTurnOptions = {
  skipOverreach?: boolean;
  fromPending?: boolean;
  splitConstraint?: string;
  abandonGeneration?: number;
};

function gmMode(): "pi" | "mock" {
  return process.env.GM_MODE === "mock" ? "mock" : "pi";
}

export async function runTurn(raw: unknown, opts: RunTurnOptions = {}): Promise<TurnResult> {
  const t0 = Date.now();
  if ((await getScreen()) !== "playing") {
    throw new HttpError(409, { error: "not_playing", needs_setup: true });
  }
  const gate = await syncWorldGate();
  if (gate.needs_setup) {
    throw new HttpError(409, { needs_setup: true, error: "needs_setup" });
  }

  const input: PlayerInput = PlayerInputSchema.parse(raw);
  const scene = await loadScene();
  if (!scene) {
    throw new HttpError(409, { needs_setup: true, error: "no_scene" });
  }

  if (!opts.fromPending && (await loadPending())) {
    throw new HttpError(409, { error: "adjudication_pending" });
  }

  if (isHardRejectText(input.player_text)) {
    return hardRejectPayload();
  }

  if (!opts.skipOverreach) {
    const lite = await adjudicateLite(input.player_text);
    if (lite === "escalate") {
      const deep = await adjudicateDeep(input.player_text);
      if (deep.decision === "discuss") {
        const pending = await openDiscussPending(input.player_text, deep.message);
        return pendingResponse(pending);
      }
    }
  }

  if (opts.abandonGeneration != null && currentAbandonGeneration() !== opts.abandonGeneration) {
    throw new HttpError(409, { error: "not_playing" });
  }

  return runStoryGm(input, scene, gate, opts, t0);
}

async function runStoryGm(
  input: PlayerInput,
  scene: NonNullable<Awaited<ReturnType<typeof loadScene>>>,
  gate: Awaited<ReturnType<typeof syncWorldGate>>,
  opts: RunTurnOptions,
  t0: number,
): Promise<StoryTurnResult> {
  const scene_id = input.scene_id ?? scene.scene_id;
  const turn_id = await nextTurnId();
  const preview = input.player_text.replace(/\s+/g, " ").slice(0, 80);
  turnLog(turn_id, `in  ${preview}${input.player_text.length > 80 ? "…" : ""}`);

  const timestamp = new Date().toISOString();
  const gm_note = await loadGmNote();
  const memory_slice = await buildMemorySlice();
  const entities = await loadEntities();
  const l2ById = await loadL2MapForPresent(scene, entities);
  const playerMemory = await loadPlayerMemory();
  const ctx = buildGmContext({
    player_text: input.player_text,
    gm_note,
    scene,
    memory_slice,
    turn_id,
    timestamp,
    entities,
    pool: await loadNpcPool(),
    l2ById,
    l2PsycheById: await loadL2PsycheMapForPresent(scene, entities),
    player_memory: playerMemory,
    split_constraint: opts.splitConstraint,
  });
  const recall = await gatherRecallSnippets({
    playerText: input.player_text,
    scene,
    entities,
    memorySlice: memory_slice,
  });
  ctx.archive_excerpts = formatRecallForGm(recall) || undefined;
  turnLog(
    turn_id,
    `ctx  episodes=${memory_slice.episodes.length} relations=${memory_slice.relations.length} gm_note=${gm_note.length}c memories=${ctx.npc_memories.length} recall=${recall.length}`,
  );

  const mode = gmMode();
  turnLog(turn_id, `gm   ${mode}`);
  const fillKnown = gate.world?.source !== "custom";
  const unvalidated = mode === "mock" ? mockGm(ctx, gate.world) : await piGm(ctx);
  turnLog(turn_id, "parse JSON");
  const gm =
    mode === "mock" ? parseGmOutput(unvalidated, { fillKnownNpcNames: fillKnown }) : unvalidated;

  if (!fillKnown) {
    const ents = await loadEntities();
    for (const line of gm.npc_lines) {
      if (line.name && line.name !== line.npc_id) continue;
      const ent = ents.find((e) => e.id === line.npc_id);
      if (ent) line.name = ent.name;
    }
  }

  if (opts.abandonGeneration != null && currentAbandonGeneration() !== opts.abandonGeneration) {
    throw new HttpError(409, { error: "not_playing" });
  }

  turnLog(turn_id, `write events=${gm.events.length} npc_lines=${gm.npc_lines.length}`);
  const episodes = await writeFromGm(gm, turn_id, timestamp, scene_id);
  await saveGmNote(gm.gm_note);
  await appendChatTail({
    turn_id,
    player_text: input.player_text,
    hide_player: input.player_text === OPENING_PLAYER_TEXT,
    narration: gm.narration,
    npc_lines: gm.npc_lines.map((l) => ({
      npc_id: l.npc_id,
      ...(l.name ? { name: l.name } : {}),
      text: l.text,
    })),
  });
  await maybeCompactAfterTurn({ turnId: turn_id, gm, sceneBefore: scene, mock: mode === "mock" });
  turnLog(turn_id, `ok   ${Date.now() - t0}ms  episodes_written=${episodes.length}`);

  return { turn_id, gm, episodes_written: episodes.length, adjudication: null };
}

/**
 * 尚無 episode 時自動跑一回合開場引子。
 * 失敗不拋（避免擋 setup／load）；回 null 讓 UI 退回短系統句。
 */
export async function runOpeningTurnIfNeeded(): Promise<StoryTurnResult | null> {
  if ((await getScreen()) !== "playing") return null;
  const episodes = await loadEpisodes();
  if (episodes.length > 0) return null;
  try {
    turnLog("open", "auto opening turn");
    const result = await runTurn({ player_text: OPENING_PLAYER_TEXT });
    if (!("gm" in result) || !result.gm) return null;
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    turnLog("open", `opening failed  ${msg}`);
    return null;
  }
}
