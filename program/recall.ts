import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { npcMemoryDir, sessionArchiveDir } from "./kb.ts";
import type { Entity, MemorySlice, SceneState } from "./schema.ts";
import {
  NpcArchiveEntrySchema,
  NpcArchiveIndexSchema,
  SessionArchiveIndexSchema,
  SessionSummarySchema,
} from "./schema.ts";

const PAST_HINTS = [
  "當時",
  "那天",
  "上回",
  "上次",
  "你說過",
  "他說過",
  "她說過",
  "記得嗎",
  "那時候",
  "先前記",
];

export type RecallSnippet = {
  kind: "session" | "npc";
  id: string;
  npcId?: string;
  locator: string;
  summary: string;
  score: number;
};

function hayHas(hay: string, needle: string): boolean {
  if (!needle) return false;
  return hay.toLowerCase().includes(needle.toLowerCase());
}

export function playerLooksLikePast(playerText: string): boolean {
  const t = playerText.trim();
  return PAST_HINTS.some((h) => t.includes(h));
}

function overlapScore(playerText: string, title: string, summary: string): number {
  const hay = `${title}\n${summary}`;
  const tokens = playerText
    .split(/[\s，。！？、]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
  let n = 0;
  for (const tok of tokens) {
    if (hayHas(hay, tok)) n += 1;
  }
  return n;
}

function firstIndex(hay: string, needle: string): number {
  if (!needle) return -1;
  return hay.toLowerCase().indexOf(needle.toLowerCase());
}

type IndexHit = {
  kind: "session" | "npc";
  id: string;
  npcId?: string;
  title: string;
  summary: string;
  turnFrom: string;
  turnTo: string;
  sessionArchiveId?: string;
  score: number;
};

function namedL2WithArchive(playerText: string, entities: Entity[], indexHits: IndexHit[]): string[] {
  const l2 = entities.filter((e) => e.kind === "npc" && (e.memory_tier ?? 0) === 2);
  const named = l2
    .map((e) => {
      const nameIdx = firstIndex(playerText, e.name);
      const idIdx = firstIndex(playerText, e.id);
      const idxs = [nameIdx, idIdx].filter((i) => i >= 0);
      if (idxs.length === 0) return null;
      const hasArchive = indexHits.some((h) => h.kind === "npc" && h.npcId === e.id);
      if (!hasArchive) return null;
      return { id: e.id, at: Math.min(...idxs) };
    })
    .filter((x): x is { id: string; at: number } => !!x)
    .sort((a, b) => a.at - b.at);
  return named.map((n) => n.id);
}

export async function gatherRecallSnippets(opts: {
  playerText: string;
  scene: SceneState;
  entities: Entity[];
  memorySlice: MemorySlice;
}): Promise<RecallSnippet[]> {
  const text = opts.playerText;
  const episodeBlob = opts.memorySlice.episodes.map((e) => e.summary).join("\n");
  const names = opts.entities.map((e) => ({ id: e.id, name: e.name }));

  const indexHits = await loadIndexHits(text);

  const gateI = playerLooksLikePast(text);
  const gateIi = names.some((e) => {
    const inPlayer = hayHas(text, e.name) || hayHas(text, e.id);
    const inEpisodes = hayHas(episodeBlob, e.name) || hayHas(episodeBlob, e.id);
    if (!inPlayer || inEpisodes) return false;
    return indexHits.some(
      (h) => hayHas(h.title, e.name) || hayHas(h.title, e.id) || hayHas(h.summary, e.name) || hayHas(h.summary, e.id),
    );
  });
  const namedL2 = namedL2WithArchive(text, opts.entities, indexHits);
  const gateIii = namedL2.length > 0;

  if (!gateI && !gateIi && !gateIii) return [];

  const ranked = [...indexHits].sort((a, b) => b.score - a.score);
  const sessionHits = ranked.filter((h) => h.kind === "session");
  const hasSessionCandidate = sessionHits.length > 0;

  const picked: IndexHit[] = [];

  if (namedL2.length > 0) {
    const npcId = namedL2[0]!;
    const npc = ranked.find((h) => h.kind === "npc" && h.npcId === npcId);
    if (npc) picked.push(npc);
    if (hasSessionCandidate) {
      const sess = sessionHits[0];
      if (sess && picked.length < 2) picked.push(sess);
    } else {
      const otherNpc = ranked.find((h) => h.kind === "npc" && h.npcId !== npcId);
      if (otherNpc && picked.length < 2) picked.push(otherNpc);
    }
  } else {
    picked.push(...sessionHits.slice(0, 2));
  }

  const out: RecallSnippet[] = [];
  for (const p of picked.slice(0, 2)) {
    out.push(await openDetails(p));
  }
  return out;
}

async function loadIndexHits(playerText: string): Promise<IndexHit[]> {
  const out: IndexHit[] = [];
  try {
    const index = SessionArchiveIndexSchema.parse(
      JSON.parse(await readFile(join(sessionArchiveDir, "index.json"), "utf8")),
    );
    for (const e of index.entries) {
      let summary = e.title;
      try {
        const sum = SessionSummarySchema.parse(
          JSON.parse(await readFile(join(sessionArchiveDir, e.archive_id, "summary.json"), "utf8")),
        );
        summary = sum.body;
      } catch {
        /* title only */
      }
      out.push({
        kind: "session",
        id: e.archive_id,
        title: e.title,
        summary,
        turnFrom: e.turn_from,
        turnTo: e.turn_to,
        score: overlapScore(playerText, e.title, summary),
      });
    }
  } catch {
    /* no session archive */
  }

  let ids: string[] = [];
  try {
    ids = await readdir(join(npcMemoryDir, "l2"));
  } catch {
    return out;
  }
  for (const npcId of ids) {
    try {
      const idx = NpcArchiveIndexSchema.parse(
        JSON.parse(await readFile(join(npcMemoryDir, "l2", npcId, "archive", "index.json"), "utf8")),
      );
      for (const ent of idx.entries) {
        out.push({
          kind: "npc",
          id: ent.npc_archive_id,
          npcId,
          title: ent.title,
          summary: ent.summary,
          turnFrom: ent.turn_from,
          turnTo: ent.turn_to,
          sessionArchiveId: ent.session_archive_id,
          score: overlapScore(playerText, ent.title, ent.summary),
        });
      }
    } catch {
      /* skip */
    }
  }
  return out;
}

async function openDetails(hit: IndexHit): Promise<RecallSnippet> {
  if (hit.kind === "session") {
    let summary = hit.summary;
    try {
      const sum = SessionSummarySchema.parse(
        JSON.parse(await readFile(join(sessionArchiveDir, hit.id, "summary.json"), "utf8")),
      );
      summary = sum.body;
    } catch {
      /* keep */
    }
    return {
      kind: "session",
      id: hit.id,
      locator: `${hit.turnFrom}–${hit.turnTo}`,
      summary,
      score: hit.score,
    };
  }

  let summary = hit.summary;
  let turnFrom = hit.turnFrom;
  let turnTo = hit.turnTo;
  let sessionArchiveId = hit.sessionArchiveId;
  let npcId = hit.npcId;
  if (hit.npcId) {
    try {
      const parsed = NpcArchiveEntrySchema.parse(
        JSON.parse(await readFile(join(npcMemoryDir, "l2", hit.npcId, "archive", `${hit.id}.json`), "utf8")),
      );
      summary = parsed.summary;
      turnFrom = parsed.turn_from;
      turnTo = parsed.turn_to;
      sessionArchiveId = parsed.session_archive_id;
      npcId = parsed.npc_id;
    } catch {
      /* index fields */
    }
  }
  const locator = sessionArchiveId
    ? `${npcId} · ${turnFrom}–${turnTo} · ${sessionArchiveId}`
    : `${npcId} · ${turnFrom}–${turnTo}`;
  return {
    kind: "npc",
    id: hit.id,
    npcId,
    locator,
    summary,
    score: hit.score,
  };
}

export function formatRecallForGm(snippets: RecallSnippet[]): string {
  if (snippets.length === 0) return "";
  return snippets
    .map((s) => {
      if (s.kind === "npc") {
        return `[archive npc ${s.id}] ${s.locator}\n${s.summary}`;
      }
      return `[archive session ${s.id}] ${s.locator}\n${s.summary}`;
    })
    .join("\n\n");
}
