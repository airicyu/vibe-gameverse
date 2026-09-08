import { HttpError } from "./errors.ts";
import { buildMemorySlice, loadEntities, loadGmNote, loadNpcPool, loadScene, nextTurnId, saveGmNote, syncWorldGate } from "./kb.ts";
import { mockGm } from "./gm-mock.ts";
import { turnLog } from "./log.ts";
import { piGm } from "./gm-pi.ts";
import { parseGmOutput, PlayerInputSchema, type GmOutput, type PlayerInput } from "./schema.ts";
import { writeFromGm } from "./writer.ts";
import { buildGmContext, loadL2MapForPresent } from "./npc-memory.ts";

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
  turnLog(
    turn_id,
    `ctx  episodes=${memory_slice.episodes.length} relations=${memory_slice.relations.length} gm_note=${gm_note.length}c memories=${ctx.npc_memories.length}`,
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
  turnLog(turn_id, `ok   ${Date.now() - t0}ms  episodes_written=${episodes.length}`);

  return { turn_id, gm, episodes_written: episodes.length };
}
