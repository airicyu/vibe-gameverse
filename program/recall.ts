import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { npcMemoryDir, sessionArchiveDir } from "./kb.ts";
import type { Entity, MemorySlice, SceneState } from "./schema.ts";
import { NpcArchiveEntrySchema, SessionArchiveIndexSchema, SessionSummarySchema } from "./schema.ts";

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
  summary: string;
  excerpts: string[];
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

type IndexHit = {
  kind: "session" | "npc";
  id: string;
  npcId?: string;
  title: string;
  summary: string;
  score: number;
};

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
  const entityInArchive = names.some((e) => {
    const inPlayer = hayHas(text, e.name) || hayHas(text, e.id);
    const inEpisodes = hayHas(episodeBlob, e.name) || hayHas(episodeBlob, e.id);
    if (!inPlayer || inEpisodes) return false;
    return indexHits.some((h) => hayHas(h.title, e.name) || hayHas(h.title, e.id) || hayHas(h.summary, e.name) || hayHas(h.summary, e.id));
  });
  if (!playerLooksLikePast(text) && !entityInArchive) return [];

  const presentL2 = opts.scene.present.filter((id) => {
    const e = opts.entities.find((x) => x.id === id);
    return e?.kind === "npc" && (e.memory_tier ?? 0) === 2 && (hayHas(text, e.name) || hayHas(text, id));
  });

  const ranked = [...indexHits].sort((a, b) => b.score - a.score);
  const picked: IndexHit[] = [];
  if (presentL2[0]) {
    const npcId = presentL2[0];
    const sess = ranked.find((h) => h.kind === "session");
    const npc = ranked.find((h) => h.kind === "npc" && h.npcId === npcId);
    if (sess) picked.push(sess);
    if (npc && picked.length < 2) picked.push(npc);
  }
  if (picked.length === 0) {
    picked.push(...ranked.filter((h) => h.kind === "session").slice(0, 2));
  }
  const open = picked.slice(0, 2);
  const out: RecallSnippet[] = [];
  for (const p of open) {
    out.push(await openDetails(p, text));
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
      const raw = JSON.parse(await readFile(join(npcMemoryDir, "l2", npcId, "archive", "index.json"), "utf8")) as {
        entries: { npc_archive_id: string; title: string }[];
      };
      for (const ent of raw.entries ?? []) {
        out.push({
          kind: "npc",
          id: ent.npc_archive_id,
          npcId,
          title: ent.title,
          summary: ent.title,
          score: overlapScore(playerText, ent.title, ent.title),
        });
      }
    } catch {
      /* skip */
    }
  }
  return out;
}

async function openDetails(hit: IndexHit, playerText: string): Promise<RecallSnippet> {
  if (hit.kind === "session") {
    let excerpts: string[] = [];
    try {
      const jsonl = await readFile(join(sessionArchiveDir, hit.id, "session.jsonl"), "utf8");
      excerpts = excerptJsonl(jsonl, playerText).map((t) => t.slice(0, 120));
    } catch {
      excerpts = [];
    }
    return { kind: "session", id: hit.id, summary: hit.summary, excerpts, score: hit.score };
  }
  let excerpts: string[] = [];
  let summary = hit.summary;
  if (hit.npcId) {
    try {
      const parsed = NpcArchiveEntrySchema.parse(
        JSON.parse(await readFile(join(npcMemoryDir, "l2", hit.npcId, "archive", `${hit.id}.json`), "utf8")),
      );
      summary = parsed.summary;
      excerpts = parsed.salient_quotes.slice(0, 3).map((q) => q.text.slice(0, 120));
    } catch {
      /* */
    }
  }
  return { kind: "npc", id: hit.id, npcId: hit.npcId, summary, excerpts, score: hit.score };
}

function excerptJsonl(jsonl: string, playerText: string): string[] {
  const hits: string[] = [];
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) continue;
    const tokens = playerText.split(/[\s，。]+/).filter((t) => t.length >= 2);
    if (!tokens.some((t) => hayHas(line, t)) && !PAST_HINTS.some((h) => hayHas(line, h))) continue;
    let text = line;
    try {
      const rec = JSON.parse(line) as Record<string, unknown>;
      const msg = (rec.message && typeof rec.message === "object" ? rec.message : rec) as Record<string, unknown>;
      if (typeof msg.content === "string") text = msg.content;
      else if (Array.isArray(msg.content)) {
        text = msg.content
          .map((c) => (c && typeof c === "object" && "text" in c ? String((c as { text?: string }).text ?? "") : ""))
          .join("");
      }
    } catch {
      /* keep */
    }
    const clip = text.trim().slice(0, 120);
    if (clip) hits.push(clip);
    if (hits.length >= 3) break;
  }
  return hits;
}

export function formatRecallForGm(snippets: RecallSnippet[]): string {
  if (snippets.length === 0) return "";
  return snippets
    .map((s) => {
      const extra = s.excerpts.map((x) => `- ${x}`).join("\n");
      return `[archive ${s.kind} ${s.id}]\n${s.summary}\n${extra}`;
    })
    .join("\n\n");
}
