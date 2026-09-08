import { HttpError } from "./errors.ts";
import { maybeCompactAfterTurn } from "./compact.ts";
import { mockGm } from "./gm-mock.ts";
import { piGm } from "./gm-pi.ts";
import {
  appendChatTail,
  buildMemorySlice,
  getScreen,
  loadEntities,
  loadEpisodes,
  loadGmNote,
  loadNpcPool,
  loadScene,
  nextTurnId,
  saveGmNote,
  syncWorldGate,
} from "./kb.ts";
import { turnLog } from "./log.ts";
import { buildGmContext, loadL2MapForPresent } from "./npc-memory.ts";
import { formatRecallForGm, gatherRecallSnippets } from "./recall.ts";
import { parseGmOutput, PlayerInputSchema, type GmOutput, type PlayerInput } from "./schema.ts";
import { writeFromGm } from "./writer.ts";

/** 隱式開場舉動（寫進 KB，UI 不顯示玩家氣泡）。場景中性：不假設門／室內／特定地貌。 */
export const OPENING_PLAYER_TEXT = "我環顧四周。";

export type TurnResult = {
  turn_id: string;
  gm: GmOutput;
  episodes_written: number;
};

function gmMode(): "pi" | "mock" {
  return process.env.GM_MODE === "mock" ? "mock" : "pi";
}

export async function runTurn(raw: unknown): Promise<TurnResult> {
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
  const scene_id = input.scene_id ?? scene.scene_id;

  const turn_id = await nextTurnId();
  const preview = input.player_text.replace(/\s+/g, " ").slice(0, 80);
  turnLog(turn_id, `in  ${preview}${input.player_text.length > 80 ? "…" : ""}`);

  const timestamp = new Date().toISOString();
  const gm_note = await loadGmNote();
  const memory_slice = await buildMemorySlice();
  const entities = await loadEntities();
  const ctx = buildGmContext({
    player_text: input.player_text,
    gm_note,
    scene,
    memory_slice,
    turn_id,
    timestamp,
    entities,
    pool: await loadNpcPool(),
    l2ById: await loadL2MapForPresent(scene, entities),
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

  return { turn_id, gm, episodes_written: episodes.length };
}

/**
 * 尚無 episode 時自動跑一回合開場引子。
 * 失敗不拋（避免擋 setup／load）；回 null 讓 UI 退回短系統句。
 */
export async function runOpeningTurnIfNeeded(): Promise<TurnResult | null> {
  if ((await getScreen()) !== "playing") return null;
  const episodes = await loadEpisodes();
  if (episodes.length > 0) return null;
  try {
    turnLog("open", "auto opening turn");
    return await runTurn({ player_text: OPENING_PLAYER_TEXT });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    turnLog("open", `opening failed  ${msg}`);
    return null;
  }
}
