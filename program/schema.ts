import { z } from "zod";

/** Player input — brainstorm §3.3; scene_id 缺則用已載入 scene，禁止預設 tavern。 */
export const PlayerInputSchema = z.object({
  player_text: z.string().min(1),
  scene_id: z.string().min(1).optional(),
});

export type PlayerInput = z.infer<typeof PlayerInputSchema>;

export const EventDraftSchema = z.object({
  actors: z.array(z.string()).min(1),
  action: z.string().min(1),
  result: z.string().min(1),
  summary: z.string().min(1),
  entity_ids: z.array(z.string()).min(1),
});

export type EventDraft = z.infer<typeof EventDraftSchema>;

export const NpcLineSchema = z.object({
  npc_id: z.string().min(1),
  name: z.string().min(1).optional(),
  text: z.string().min(1),
});

export const SceneStateSchema = z.object({
  scene_id: z.string(),
  present: z.array(z.string()),
  visible: z.array(z.string()),
});

export type SceneState = z.infer<typeof SceneStateSchema>;

export const KNOWN_NPC_NAMES: Record<string, string> = {
  bartender: "瑪拉",
  ash: "灰",
};

function speakerName(npcId: string, explicit?: string, fillKnown = true): string {
  const n = explicit?.trim();
  if (n) return n;
  if (fillKnown) return KNOWN_NPC_NAMES[npcId] ?? npcId;
  return npcId;
}

function pickNarration(o: Record<string, unknown>): string {
  for (const key of ["narration", "scene_narration", "scene_text", "description"]) {
    const v = o[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** GM output — program-validated; gm_note is a full overwrite. */
export const GmOutputSchema = z.object({
  narration: z.string().min(1),
  npc_lines: z.array(NpcLineSchema),
  events: z.array(EventDraftSchema),
  gm_note: z.string().min(1).max(800),
  scene: SceneStateSchema,
  ui: z.unknown().nullable().default(null),
  needs_image: z.boolean().default(false),
});

export type GmOutput = z.infer<typeof GmOutputSchema>;

function asList(value: unknown): unknown[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    if ("npc_id" in rec || "actors" in rec) return [value];
    return Object.entries(rec).map(([k, v]) =>
      typeof v === "string" ? { npc_id: k, text: v } : v,
    );
  }
  return [];
}

function asStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  }
  return ["player"];
}

function looksLikeSpokenEvent(event: { action: string; result: string; summary: string }): boolean {
  const told = `${event.result} ${event.summary}`;
  return /說|回應|請求|開口|自稱|告訴|指出|心靈/.test(told);
}

function speakerFromScene(scene: unknown, eventIds: string[]): string {
  const rec = scene && typeof scene === "object" ? (scene as Record<string, unknown>) : {};
  const present = asStrings(rec.present).filter((id) => id && id !== "player");
  if (present[0]) return present[0]!;
  const fromEvent = eventIds.find((id) => id && id !== "player");
  if (fromEvent) return fromEvent;
  const visible = asStrings(rec.visible).filter(
    (id) => id && id !== "player" && /entity|npc|spirit|mist|ghost|ash|bartender/.test(id),
  );
  if (visible[0]) return visible[0]!;
  return "unknown_npc";
}

function fillNpcLinesFromEvents(
  lines: { npc_id: string; name: string; text: string }[],
  events: { action: string; result: string; summary: string; entity_ids: string[] }[],
  scene: unknown,
  fillKnown: boolean,
): { npc_id: string; name: string; text: string }[] {
  if (lines.length > 0) return lines;
  const spoken = events.filter(looksLikeSpokenEvent);
  if (spoken.length === 0) return lines;
  return spoken
    .map((e) => {
      const text = (e.summary || e.result).trim();
      if (!text) return null;
      const npc_id = speakerFromScene(scene, e.entity_ids);
      return {
        npc_id,
        name: speakerName(npc_id, "", fillKnown),
        text,
      };
    })
    .filter((x) => x != null);
}

function coerceEvent(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const e = raw as Record<string, unknown>;
  return {
    actors: asStrings(e.actors),
    action: String(e.action ?? "act"),
    result: String(e.result ?? "ok"),
    summary: String(e.summary ?? e.action ?? "event"),
    entity_ids: asStrings(e.entity_ids ?? e.actors),
  };
}

function stripNpcSpeechFromNarration(narration: string, lines: { text: string }[]): string {
  const speeches = lines
    .map((l) => l.text.trim())
    .filter((t) => t.length >= 2)
    .sort((a, b) => b.length - a.length);
  let n = narration;
  for (const t of speeches) {
    if (n.includes(t)) n = n.split(t).join("");
  }
  n = n.replace(/[「『]\s*[」』]/g, "");
  n = n.replace(/說了兩個字：\s*/g, "");
  n = n.replace(/說了一句[^。]{0,30}：\s*/g, "");
  n = n.replace(/低聲說：\s*/g, "");
  n = n.replace(/[：:]\s*([。！？]|$)/g, "$1");
  n = n.replace(/[，、]{2,}/g, "，");
  n = n.replace(/。{2,}/g, "。");
  n = n.replace(/\s{2,}/g, " ").trim();
  if (n.length < 8) {
    const first = speeches.map((t) => narration.indexOf(t)).filter((i) => i >= 0);
    const cut = first.length ? Math.min(...first) : -1;
    if (cut > 8) return narration.slice(0, cut).trim();
    return narration.trim();
  }
  return n;
}

export type NormalizeGmOptions = {
  /** default 世界才用 KNOWN_NPC_NAMES 補顯示名。 */
  fillKnownNpcNames?: boolean;
};

/** Flash often returns one NPC line as an object; coerce before schema. */
export function normalizeGmPayload(raw: unknown, opts?: NormalizeGmOptions): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const fillKnown = opts?.fillKnownNpcNames !== false;
  const o = raw as Record<string, unknown>;
  const rawNote = o.gm_note ?? o.gmNote;
  const note = (typeof rawNote === "string" ? rawNote : "").trim().slice(0, 800);
  const events = asList(o.events).map(coerceEvent) as {
    action: string;
    result: string;
    summary: string;
    entity_ids: string[];
  }[];
  const parsedLines = asList(o.npc_lines)
    .map((line) => {
      if (!line || typeof line !== "object") return null;
      const L = line as Record<string, unknown>;
      const text = String(L.text ?? L.line ?? L.speech ?? "").trim();
      if (!text) return null;
      const rawId = L.npc_id ?? L.id;
      const npc_id =
        typeof rawId === "string" && rawId.trim() ? rawId.trim() : "unknown_npc";
      return {
        npc_id,
        name: speakerName(npc_id, String(L.name ?? L.speaker ?? ""), fillKnown),
        text,
      };
    })
    .filter((x) => x != null);
  const npc_lines = fillNpcLinesFromEvents(parsedLines, events, o.scene, fillKnown);
  return {
    narration: stripNpcSpeechFromNarration(pickNarration(o), npc_lines),
    npc_lines,
    events,
    gm_note: note || "本場進行中。",
    scene: o.scene,
    ui: o.ui ?? null,
    needs_image: o.needs_image === true,
  };
}

export function parseGmOutput(raw: unknown, opts?: NormalizeGmOptions): GmOutput {
  return GmOutputSchema.parse(normalizeGmPayload(raw, opts));
}

export const EpisodeSchema = z.object({
  id: z.string(),
  turn_id: z.string(),
  timestamp: z.string(),
  scene_id: z.string(),
  actors: z.array(z.string()),
  action: z.string(),
  result: z.string(),
  summary: z.string(),
  entity_ids: z.array(z.string()),
});

export type Episode = z.infer<typeof EpisodeSchema>;

const optionalPersona = z.preprocess((value) => {
  if (value == null) return undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().min(1).max(2000).optional());

export const MemoryTierSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);

export type MemoryTier = z.infer<typeof MemoryTierSchema>;

export const EntitySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(["npc", "place", "item", "player"]),
    summary: z.string(),
    private_notes: z.string().optional(),
    persona: optionalPersona,
    memory_tier: MemoryTierSchema.optional(),
  })
  .superRefine((e, ctx) => {
    if (e.kind !== "npc" && e.memory_tier !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "memory_tier is only valid on kind npc",
        path: ["memory_tier"],
      });
    }
  })
  .transform((e) => {
    if (e.kind === "npc" && e.memory_tier === undefined) {
      return { ...e, memory_tier: 0 as const };
    }
    return e;
  });

export type Entity = z.infer<typeof EntitySchema>;

export const NpcPoolEntrySchema = z.object({
  tier: z.literal(0).or(z.literal(1)),
  last_substantive_turn: z.number().int(),
  body: z.string().min(1).max(600),
});

export type NpcPoolEntry = z.infer<typeof NpcPoolEntrySchema>;

export const NpcPoolSchema = z.object({
  npcs: z.record(z.string(), NpcPoolEntrySchema),
});

export type NpcPool = z.infer<typeof NpcPoolSchema>;

export const EMPTY_NPC_POOL: NpcPool = { npcs: {} };

export const L2CurrentSchema = z.object({
  npc_id: z.string().min(1),
  body: z.string(),
  updated_turn: z.number().int(),
});

export type L2Current = z.infer<typeof L2CurrentSchema>;

export const DirtySetSchema = z.object({
  since_session_archive: z.string().nullable(),
  touched: z.array(z.string()),
  near_cap: z.array(z.string()),
});

export type DirtySet = z.infer<typeof DirtySetSchema>;

export const EMPTY_DIRTY_SET: DirtySet = {
  since_session_archive: null,
  touched: [],
  near_cap: [],
};

export const NPC_ARCHIVE_ID_RE = /^na_[a-z][a-z0-9_]*_[0-9]{3,}$/;

export const NpcArchiveQuoteSchema = z.object({
  turn_id: z.string().min(1),
  speaker: z.string().min(1),
  text: z.string().min(1).max(120),
});

export const NpcArchiveEntrySchema = z
  .object({
    npc_archive_id: z.string().regex(NPC_ARCHIVE_ID_RE),
    npc_id: z.string().min(1),
    session_archive_id: z.string().min(1).optional(),
    turn_from: z.string().min(1),
    turn_to: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1).max(800),
    salient_quotes: z.array(NpcArchiveQuoteSchema).max(3),
  })
  .superRefine((entry, ctx) => {
    for (const [i, q] of entry.salient_quotes.entries()) {
      if (q.speaker !== entry.npc_id && q.speaker !== "player") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "salient_quotes.speaker must be this npc_id or player",
          path: ["salient_quotes", i, "speaker"],
        });
      }
    }
  });

export type NpcArchiveEntry = z.infer<typeof NpcArchiveEntrySchema>;

export const NpcArchiveIndexSchema = z.object({
  npc_id: z.string().min(1),
  entries: z.array(
    z.object({
      npc_archive_id: z.string().regex(NPC_ARCHIVE_ID_RE),
      session_archive_id: z.string().min(1).optional(),
      turn_from: z.string().min(1),
      turn_to: z.string().min(1),
      title: z.string().min(1),
      body_chars: z.number().int(),
      quote_count: z.number().int(),
    }),
  ),
});

export type NpcArchiveIndex = z.infer<typeof NpcArchiveIndexSchema>;

export type NpcMemorySnippet = {
  npc_id: string;
  tier: MemoryTier;
  body: string;
};

export const RelationSchema = z.object({
  a: z.string(),
  b: z.string(),
  kind: z.string(),
  strength: z.number().min(-1).max(1),
  reason: z.string(),
});

export type Relation = z.infer<typeof RelationSchema>;

export type MemorySlice = {
  episodes: Pick<Episode, "id" | "summary" | "timestamp">[];
  entities: Pick<Entity, "id" | "name" | "summary">[];
  relations: Relation[];
};

export type GmContext = {
  player_text: string;
  gm_note: string;
  scene: SceneState;
  memory_slice: MemorySlice;
  turn_id: string;
  timestamp: string;
  npc_memories: NpcMemorySnippet[];
  archive_excerpts?: string;
};

export const ENTITY_ID_RE = /^[a-z][a-z0-9_]*$/;

export const WorldSchema = z.object({
  source: z.enum(["default", "custom"]),
  title: z.string().min(1).max(40),
  created_at: z.string().min(1),
});

export type World = z.infer<typeof WorldSchema>;

export const DEFAULT_WORLD_TITLE = "鏽燈酒館";

function trimField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** 四欄 primer；缺鍵當 ""。長度一律 trim 後的 UTF-16 length。 */
export const PrimerSchema = z
  .object({
    worldview: z.string().optional().default(""),
    protagonist: z.string().optional().default(""),
    extras: z.string().optional().default(""),
    starting_point: z.string().optional().default(""),
  })
  .transform((v) => ({
    worldview: trimField(v.worldview),
    protagonist: trimField(v.protagonist),
    extras: trimField(v.extras),
    starting_point: trimField(v.starting_point),
  }))
  .superRefine((v, ctx) => {
    const check = (key: keyof typeof v, min: number) => {
      const n = v[key].length;
      if (n > 4000) {
        ctx.addIssue({ code: z.ZodIssueCode.too_big, maximum: 4000, type: "string", inclusive: true, path: [key], message: `${key} too long` });
      }
      if (n < min) {
        ctx.addIssue({ code: z.ZodIssueCode.too_small, minimum: min, type: "string", inclusive: true, path: [key], message: `${key} too short` });
      }
    };
    check("worldview", 8);
    check("starting_point", 8);
    check("protagonist", 0);
    check("extras", 0);
  });

export type Primer = z.infer<typeof PrimerSchema>;

export function primerLeakFields(primer: Primer): string[] {
  return [primer.worldview, primer.protagonist, primer.extras, primer.starting_point].filter((s) => s.length >= 8);
}

export function entityLeaksPrimer(entities: Entity[], primer: Primer): boolean {
  const fields = primerLeakFields(primer);
  for (const e of entities) {
    const texts = [e.summary, e.private_notes ?? "", e.persona ?? ""];
    for (const field of fields) {
      for (const t of texts) {
        if (t === field || t.includes(field)) return true;
      }
    }
  }
  return false;
}

export const GeneratedWorldSchema = z.object({
  title: z.string().min(1).max(40),
  gm_note: z.string().min(1).max(800),
  gm_canon: z.string().min(1).max(8000),
  entities: z.array(EntitySchema).min(2),
  scene: SceneStateSchema,
  relations: z.array(RelationSchema).optional().default([]),
});

export type GeneratedWorld = z.infer<typeof GeneratedWorldSchema>;

export function parseGeneratedWorld(raw: unknown, primer: Primer): GeneratedWorld {
  const parsed: GeneratedWorld = GeneratedWorldSchema.parse(raw);
  const ids = parsed.entities.map((e) => e.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("generated entities: duplicate id");
  }
  for (const id of ids) {
    if (!ENTITY_ID_RE.test(id)) throw new Error(`generated entity id invalid: ${id}`);
  }
  const players = parsed.entities.filter((e) => e.kind === "player");
  if (players.length !== 1 || players[0]?.id !== "player") {
    throw new Error("generated world must have exactly one player with id player");
  }
  const npcs = parsed.entities.filter((e) => e.kind === "npc");
  if (npcs.length < 1) throw new Error("generated world needs at least one npc");
  const places = parsed.entities.filter((e) => e.kind === "place");
  if (places.length < 1) throw new Error("generated world needs at least one place");
  if (!places.some((p) => p.id === parsed.scene.scene_id)) {
    throw new Error("scene.scene_id must be a place entity id");
  }
  const idSet = new Set(ids);
  if (!parsed.scene.present.includes("player")) {
    throw new Error("scene.present must include player");
  }
  if (!parsed.scene.present.some((id) => npcs.some((n) => n.id === id))) {
    throw new Error("scene.present must include at least one npc");
  }
  for (const id of parsed.scene.present) {
    if (!idSet.has(id)) throw new Error(`scene.present unknown id: ${id}`);
  }
  for (const r of parsed.relations) {
    if (!idSet.has(r.a) || !idSet.has(r.b)) {
      throw new Error("relation endpoint missing from entities");
    }
  }
  if (entityLeaksPrimer(parsed.entities, primer)) {
    throw new Error("generated entities leak primer text");
  }
  parsed.entities = parsed.entities.map((e) =>
    e.kind === "npc" ? { ...e, memory_tier: 0 as const } : e,
  );
  return parsed;
}

export const AppConfigSchema = z.object({
  debug: z.boolean().default(false),
  compact: z.object({
    max_turns_without_compact: z.number().int().positive(),
    recent_turns_to_keep: z.number().int().min(1).max(10),
    force_after_input_tokens: z.number().int().positive(),
    force_after_jsonl_bytes: z.number().int().positive(),
  }),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export const SESSION_ARCHIVE_ID_RE = /^sa_[0-9]{3,}$/;

export const CompactStateSchema = z.object({
  anchor_turn_n: z.number().int().min(0),
});

export type CompactState = z.infer<typeof CompactStateSchema>;

export const SessionArchiveIndexEntrySchema = z.object({
  archive_id: z.string().regex(SESSION_ARCHIVE_ID_RE),
  turn_from: z.string().min(1),
  turn_to: z.string().min(1),
  title: z.string().min(1),
  truncated: z.boolean(),
});

export const SessionArchiveIndexSchema = z.object({
  entries: z.array(SessionArchiveIndexEntrySchema),
});

export type SessionArchiveIndex = z.infer<typeof SessionArchiveIndexSchema>;

export const SessionSummarySchema = z.object({
  archive_id: z.string().regex(SESSION_ARCHIVE_ID_RE),
  turn_from: z.string().min(1),
  turn_to: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1).max(800),
  truncated: z.boolean(),
});

export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const NpcArchiveModelSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1).max(800),
  salient_quotes: z.array(NpcArchiveQuoteSchema).max(3),
  distilled_body: z.string(),
});

export type NpcArchiveModel = z.infer<typeof NpcArchiveModelSchema>;

/** Flash often overshoots 0–3 quotes. Cap list/text only; never clip distilled_body. */
export function parseNpcArchiveModel(raw: unknown): NpcArchiveModel {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const quotes = asList(o.salient_quotes)
    .filter((q): q is Record<string, unknown> => !!q && typeof q === "object")
    .slice(0, 3)
    .map((q) => ({
      turn_id: String(q.turn_id ?? "").trim(),
      speaker: String(q.speaker ?? "").trim(),
      text: String(q.text ?? "").trim().slice(0, 120),
    }));
  return NpcArchiveModelSchema.parse({
    title: o.title,
    summary: o.summary,
    salient_quotes: quotes,
    distilled_body: o.distilled_body,
  });
}

