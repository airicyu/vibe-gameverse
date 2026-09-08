import { randomUUID } from "node:crypto";
import {
  loadEntities,
  loadEpisodes,
  loadRelations,
  saveEntities,
  saveEpisodes,
  saveRelations,
} from "./kb.ts";
import type { Entity, EventDraft, Episode, GmOutput } from "./schema.ts";
import { updateNpcMemories } from "./npc-memory.ts";

function upsertRelation(
  relations: Awaited<ReturnType<typeof loadRelations>>,
  event: EventDraft,
): void {
  const pair = event.actors.filter((id) => id !== "player");
  const other = pair[0];
  if (!other) return;

  const kind =
    event.result.includes("trust") || event.action.includes("kind")
      ? "trust"
      : event.result.includes("wary") || event.result.includes("evasive")
        ? "wariness"
        : "impression";

  const delta = kind === "trust" ? 0.15 : kind === "wariness" ? -0.1 : 0.05;

  const existing = relations.find(
    (r) =>
      (r.a === "player" && r.b === other) ||
      (r.a === other && r.b === "player"),
  );
  if (existing) {
    existing.strength = Math.max(-1, Math.min(1, existing.strength + delta));
    existing.reason = event.summary;
    existing.kind = kind;
  } else {
    relations.push({
      a: "player",
      b: other,
      kind,
      strength: delta,
      reason: event.summary,
    });
  }
}

function ensureEntity(entities: Entity[], id: string, name: string, summary: string): void {
  if (id === "player" || !id) return;
  const existing = entities.find((e) => e.id === id);
  if (existing) {
    if (summary && existing.summary !== summary) existing.summary = summary;
    if (name && name !== id) existing.name = name;
    return;
  }
  const kind: Entity["kind"] =
    id === "tavern" || id.endsWith("_site") ? "place" : id.includes("note") || id.includes("item") ? "item" : "npc";
  entities.push({
    id,
    name: name || id,
    kind,
    summary: summary || name || id,
    ...(kind === "npc" ? { memory_tier: 0 as const } : {}),
  });
}

/** Writer: persist this turn's events + any newly speaking NPCs into kb/runtime. */
export async function writeFromGm(
  gm: GmOutput,
  turnId: string,
  timestamp: string,
  sceneId: string,
): Promise<Episode[]> {
  const episodes = await loadEpisodes();
  const entities = await loadEntities();
  const relations = await loadRelations();
  const written: Episode[] = [];

  for (const line of gm.npc_lines) {
    ensureEntity(entities, line.npc_id, line.name ?? line.npc_id, line.text.slice(0, 120));
  }

  for (const event of gm.events) {
    const episode: Episode = {
      id: randomUUID(),
      turn_id: turnId,
      timestamp,
      scene_id: sceneId,
      actors: event.actors,
      action: event.action,
      result: event.result,
      summary: event.summary,
      entity_ids: event.entity_ids,
    };
    episodes.push(episode);
    written.push(episode);
    upsertRelation(relations, event);
    for (const id of event.entity_ids) {
      ensureEntity(entities, id, id, event.summary);
    }
    if (event.entity_ids.includes("sealed_note") && event.result.includes("obtained")) {
      const note = entities.find((e) => e.id === "sealed_note");
      if (note) note.summary = "玩家已拿到／讀過蠟封紙條。";
    }
  }

  await saveEpisodes(episodes);
  await saveRelations(relations);
  await saveEntities(entities);
  await updateNpcMemories(gm, turnId);
  return written;
}
