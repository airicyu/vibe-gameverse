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

/** UI 載入／重整用：近期對局氣泡（非 GM 記憶切片）。 */
export const ChatTailEntrySchema = z.object({
  turn_id: z.string(),
  player_text: z.string(),
  /** 開場隱含句：寫入但不在 UI 顯示玩家氣泡。 */
  hide_player: z.boolean(),
  narration: z.string(),
  npc_lines: z.array(
    z.object({
      npc_id: z.string(),
      name: z.string().optional(),
      text: z.string(),
    }),
  ),
});

export type ChatTailEntry = z.infer<typeof ChatTailEntrySchema>;

export const CHAT_TAIL_KEEP = 12;

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

export const NPC_PSYCHE_FIELD_MAX = {
  disposition: 200,
  life_goal: 200,
  mid_goal: 200,
  short_goal: 120,
  likes: 200,
  dislikes: 200,
} as const;

export const NpcPsycheSchema = z.object({
  npc_id: z.string().min(1),
  disposition: z.string().max(NPC_PSYCHE_FIELD_MAX.disposition),
  life_goal: z.string().max(NPC_PSYCHE_FIELD_MAX.life_goal),
  mid_goal: z.string().max(NPC_PSYCHE_FIELD_MAX.mid_goal),
  short_goal: z.string().max(NPC_PSYCHE_FIELD_MAX.short_goal),
  likes: z.string().max(NPC_PSYCHE_FIELD_MAX.likes),
  dislikes: z.string().max(NPC_PSYCHE_FIELD_MAX.dislikes),
});

export type NpcPsyche = z.infer<typeof NpcPsycheSchema>;

export type NpcPsycheFields = Omit<NpcPsyche, "npc_id">;

export function emptyNpcPsyche(npcId: string): NpcPsyche {
  return {
    npc_id: npcId,
    disposition: "",
    life_goal: "",
    mid_goal: "",
    short_goal: "",
    likes: "",
    dislikes: "",
  };
}

function clipField(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max);
}

export function clipNpcPsyche(psyche: NpcPsyche): NpcPsyche {
  return {
    npc_id: psyche.npc_id,
    disposition: clipField(psyche.disposition, NPC_PSYCHE_FIELD_MAX.disposition),
    life_goal: clipField(psyche.life_goal, NPC_PSYCHE_FIELD_MAX.life_goal),
    mid_goal: clipField(psyche.mid_goal, NPC_PSYCHE_FIELD_MAX.mid_goal),
    short_goal: clipField(psyche.short_goal, NPC_PSYCHE_FIELD_MAX.short_goal),
    likes: clipField(psyche.likes, NPC_PSYCHE_FIELD_MAX.likes),
    dislikes: clipField(psyche.dislikes, NPC_PSYCHE_FIELD_MAX.dislikes),
  };
}

export function npcPsycheFields(psyche: NpcPsyche): NpcPsycheFields {
  const { npc_id: _id, ...fields } = clipNpcPsyche(psyche);
  return fields;
}

export function parseNpcPsycheModel(raw: unknown, npcId: string): NpcPsyche {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return NpcPsycheSchema.parse(
    clipNpcPsyche({
      npc_id: typeof o.npc_id === "string" && o.npc_id.trim() ? o.npc_id : npcId,
      disposition: typeof o.disposition === "string" ? o.disposition : "",
      life_goal: typeof o.life_goal === "string" ? o.life_goal : "",
      mid_goal: typeof o.mid_goal === "string" ? o.mid_goal : "",
      short_goal: typeof o.short_goal === "string" ? o.short_goal : "",
      likes: typeof o.likes === "string" ? o.likes : "",
      dislikes: typeof o.dislikes === "string" ? o.dislikes : "",
    }),
  );
}

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

/** @deprecated 0.8.0 起不再寫入；保留型別僅供讀舊檔時 strip。 */
/** @deprecated 0.8.0 起不再寫入；保留型別僅供文件／舊測對照。 */
export const NpcArchiveQuoteSchema = z.object({
  turn_id: z.string().min(1),
  speaker: z.string().min(1),
  text: z.string().min(1).max(120),
});

const NpcArchiveEntryObjectSchema = z.object({
  npc_archive_id: z.string().regex(NPC_ARCHIVE_ID_RE),
  npc_id: z.string().min(1),
  session_archive_id: z.string().min(1).optional(),
  turn_from: z.string().min(1),
  turn_to: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1).max(800),
});

/** 新寫入省略 salient_quotes；舊檔多餘該欄 strip 後合法。 */
export const NpcArchiveEntrySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object") return raw;
  const { salient_quotes: _ignored, ...rest } = raw as Record<string, unknown>;
  return rest;
}, NpcArchiveEntryObjectSchema);

export type NpcArchiveEntry = z.infer<typeof NpcArchiveEntryObjectSchema>;

const NpcArchiveIndexEntryObjectSchema = z.object({
  npc_archive_id: z.string().regex(NPC_ARCHIVE_ID_RE),
  session_archive_id: z.string().min(1).optional(),
  turn_from: z.string().min(1),
  turn_to: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  body_chars: z.number().int(),
});

export const NpcArchiveIndexSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;
  const entries = Array.isArray(o.entries)
    ? o.entries.map((ent) => {
        if (!ent || typeof ent !== "object") return ent;
        const e = { ...(ent as Record<string, unknown>) };
        delete e.quote_count;
        if (typeof e.summary !== "string" || !e.summary) {
          e.summary = typeof e.title === "string" ? e.title : "";
        }
        return e;
      })
    : o.entries;
  return { ...o, entries };
}, z.object({
  npc_id: z.string().min(1),
  entries: z.array(NpcArchiveIndexEntryObjectSchema),
}));

export type NpcArchiveIndex = z.infer<typeof NpcArchiveIndexSchema>;

export type NpcMemorySnippet = {
  npc_id: string;
  tier: MemoryTier;
  body: string;
  psyche?: NpcPsycheFields;
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
  /** 參考事實與已承認能力，非玩家人格腳本。不進對玩家 HTTP。 */
  player_memory: { body: string };
  /** 僅切分該拍；不落 gm_note、不進對玩家 HTTP。 */
  split_constraint?: string;
};

export const PLAYER_MEMORY_BODY_MAX = 800;

export const PlayerMemorySchema = z.object({
  body: z.string(),
});

export type PlayerMemory = z.infer<typeof PlayerMemorySchema>;

export function clipUtf16(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max);
}

export const AdjudicationPendingSchema = z.object({
  original_player_text: z.string().min(1),
  created_turn_id: z.string(),
  meta_session_id: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.enum(["gm", "player"]),
      text: z.string(),
    }),
  ),
});

export type AdjudicationPending = z.infer<typeof AdjudicationPendingSchema>;

export const LiteAdjudicationSchema = z.object({
  decision: z.enum(["pass", "escalate"]),
});

export const DeepAdjudicationSchema = z.object({
  decision: z.enum(["pass", "discuss"]),
  message: z.string().optional().default(""),
});

/** 側欄 meta 終態；與 NpcPsyche.disposition（性格）分開。 */
export const GmMetaDispositionSchema = z.enum([
  "talk",
  "pass_original",
  "split",
  "revise",
  "hard_reject",
]);

export type GmMetaDisposition = z.infer<typeof GmMetaDispositionSchema>;

export const GmMetaOutputSchema = z.object({
  disposition: GmMetaDispositionSchema,
  message: z.string().optional().default(""),
  player_memory_patch: z.string().optional().default(""),
  split_constraint: z.string().optional().default(""),
});

export type GmMetaOutput = z.infer<typeof GmMetaOutputSchema>;

export const GmChatBodySchema = z.object({
  text: z.string().min(1),
});

export const ENTITY_ID_RE = /^[a-z][a-z0-9_]*$/;

/** UUID directory name: lowercase 8-4-4-4-12. */
export const WORLD_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** 單一 world.json：id＋save_name＋source；不再另開 save.json／title。 */
export const WorldSchema = z.object({
  id: z.string().regex(WORLD_UUID_RE),
  source: z.enum(["default", "custom"]),
  save_name: z.string().min(1).max(40),
  created_at: z.string().min(1),
});

export type World = z.infer<typeof WorldSchema>;

/** API／清單用的精簡形；與 world.id／save_name 同源。 */
export const SaveMetaSchema = z.object({
  id: z.string().regex(WORLD_UUID_RE),
  save_name: z.string().min(1).max(40),
});

export type SaveMeta = z.infer<typeof SaveMetaSchema>;

export function saveMetaFromWorld(world: World): SaveMeta {
  return { id: world.id, save_name: world.save_name };
}

export const CurrentPointerSchema = z.object({
  id: z.string().min(1),
});

export type CurrentPointer = z.infer<typeof CurrentPointerSchema>;

function trimField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** save_name：trim 後 UTF-16 長度 1–40。 */
export function parseSaveName(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s.length < 1 || s.length > 40) {
    throw new Error("save_name_invalid");
  }
  return s;
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
  distilled_body: z.string(),
});

export type NpcArchiveModel = z.infer<typeof NpcArchiveModelSchema>;

/** 0.8.0：只收 title／summary／distilled_body；多餘 salient_quotes 忽略。 */
export function parseNpcArchiveModel(raw: unknown): NpcArchiveModel {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return NpcArchiveModelSchema.parse({
    title: o.title,
    summary: o.summary,
    distilled_body: o.distilled_body,
  });
}

