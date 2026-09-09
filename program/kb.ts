import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { HttpError } from "./errors.ts";
import {
  CompactStateSchema,
  CurrentPointerSchema,
  DirtySetSchema,
  EMPTY_DIRTY_SET,
  EMPTY_NPC_POOL,
  CHAT_TAIL_KEEP,
  ChatTailEntrySchema,
  EntitySchema,
  EpisodeSchema,
  L2CurrentSchema,
  NpcPsycheSchema,
  NpcPoolSchema,
  PlayerMemorySchema,
  AdjudicationPendingSchema,
  RelationSchema,
  SaveMetaSchema,
  saveMetaFromWorld,
  SceneStateSchema,
  WORLD_UUID_RE,
  WorldSchema,
  type CompactState,
  type DirtySet,
  type ChatTailEntry,
  type Entity,
  type Episode,
  type GeneratedWorld,
  type L2Current,
  type NpcPsyche,
  type NpcPsycheFields,
  type MemorySlice,
  type NpcPool,
  type PlayerMemory,
  type AdjudicationPending,
  type Primer,
  type Relation,
  type SaveMeta,
  type SceneState,
  type World,
  emptyNpcPsyche,
  clipNpcPsyche,
  clipUtf16,
  PLAYER_MEMORY_BODY_MAX,
} from "./schema.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const kbSeedDir = join(root, "kb", "seed");

/** Parent of all world saves. Old VIBE_GAMEVERSE_KB_RUNTIME is ignored. */
export const kbWorldsDir =
  process.env.VIBE_GAMEVERSE_KB_WORLDS?.trim() || join(root, "kb", "worlds");

const currentPointerPath = () => join(kbWorldsDir, "current.json");

/** Active playthrough root (pointer target). Null screen → unbound sentinel. */
export let kbRuntimeDir = join(kbWorldsDir, ".no-active");
export let npcMemoryDir = join(kbRuntimeDir, "npc-memory");
export let playSessionsDir = join(kbRuntimeDir, "play-sessions");
export let sessionArchiveDir = join(kbRuntimeDir, "session-archive");
export let compactScratchDir = join(kbRuntimeDir, "compact-scratch");
export let compactStatePath = join(kbRuntimeDir, "compact-state.json");
export let playerMemoryDir = join(kbRuntimeDir, "player-memory");
export let gmMetaSessionsDir = join(kbRuntimeDir, "gm-meta-sessions");
let legacyPiSessionsDir = join(kbRuntimeDir, "pi-sessions");
let activeWorldId: string | null = null;
/** home／delete／load 遞增；進行中 gm-chat 對不上則放棄落盤。 */
let abandonGeneration = 0;

const paths = {
  episodes: join(kbRuntimeDir, "episodes.json"),
  chatTail: join(kbRuntimeDir, "chat-tail.json"),
  entities: join(kbRuntimeDir, "entities.json"),
  relations: join(kbRuntimeDir, "relations.json"),
  gmNote: join(kbRuntimeDir, "gm_note.txt"),
  scene: join(kbRuntimeDir, "scene.json"),
  turnCounter: join(kbRuntimeDir, "turn_counter.json"),
  world: join(kbRuntimeDir, "world.json"),
  primer: join(kbRuntimeDir, "primer.json"),
  gmCanon: join(kbRuntimeDir, "gm_canon.md"),
};

function rebindRuntimePaths(dir: string): void {
  kbRuntimeDir = dir;
  npcMemoryDir = join(kbRuntimeDir, "npc-memory");
  playSessionsDir = join(kbRuntimeDir, "play-sessions");
  sessionArchiveDir = join(kbRuntimeDir, "session-archive");
  compactScratchDir = join(kbRuntimeDir, "compact-scratch");
  compactStatePath = join(kbRuntimeDir, "compact-state.json");
  playerMemoryDir = join(kbRuntimeDir, "player-memory");
  gmMetaSessionsDir = join(kbRuntimeDir, "gm-meta-sessions");
  legacyPiSessionsDir = join(kbRuntimeDir, "pi-sessions");
  paths.episodes = join(kbRuntimeDir, "episodes.json");
  paths.chatTail = join(kbRuntimeDir, "chat-tail.json");
  paths.entities = join(kbRuntimeDir, "entities.json");
  paths.relations = join(kbRuntimeDir, "relations.json");
  paths.gmNote = join(kbRuntimeDir, "gm_note.txt");
  paths.scene = join(kbRuntimeDir, "scene.json");
  paths.turnCounter = join(kbRuntimeDir, "turn_counter.json");
  paths.world = join(kbRuntimeDir, "world.json");
  paths.primer = join(kbRuntimeDir, "primer.json");
  paths.gmCanon = join(kbRuntimeDir, "gm_canon.md");
}

export function worldDir(id: string): string {
  return join(kbWorldsDir, id);
}

export function getActiveWorldId(): string | null {
  return activeWorldId;
}

export type Screen = "home" | "playing";

export const INITIAL_GM_NOTE =
  "幕：鏽燈酒館。玩家剛進門。瑪拉在吧台。灰在角落，桌上有蠟封紙條。本場目標：讓玩家碰到那條線索。鉤子：問怪人／走向角落。";

export const INITIAL_SCENE: SceneState = {
  scene_id: "tavern",
  present: ["player", "bartender", "ash"],
  visible: ["bar", "corner_table", "rusty_lantern"],
};

export const DEFAULT_L2_CURRENT_BODY: Record<"bartender" | "ash", string> = {
  bartender: "今晚吧台如常。灰在角落。北路的事不當眾說。",
  ash: "坐在角落。蠟封紙條在桌上。還沒決定要不要交給進來的人。",
};

export const DEFAULT_L2_PSYCHE: Record<"bartender" | "ash", NpcPsycheFields> = {
  bartender: {
    disposition: "話少、帶刺，用問題擋問題",
    life_goal: "守住酒館與熟客的安穩",
    mid_goal: "別讓北路話題把店裡捲進麻煩",
    short_goal: "照顧吧台，少讓人注意到角落的灰",
    likes: "熟客、乾淨杯子、不追問的人",
    dislikes: "當眾追問北路、鬧事、逼她表態",
  },
  ash: {
    disposition: "少露臉，句子短，不先交底",
    life_goal: "把該辦的事辦完就離開，不拖入他人冒險",
    mid_goal: "找一個不張揚的人收下蠟封紙條",
    short_goal: "觀察進店的人，還沒決定要不要推紙條",
    likes: "安靜角落、不組隊的對話、守口如瓶的人",
    dislikes: "被當成守燈人、被拉隊、當眾逼問身分",
  },
};

export function l2CurrentPath(npcId: string): string {
  return join(npcMemoryDir, "l2", npcId, "current.json");
}

export function l2PsychePath(npcId: string): string {
  return join(npcMemoryDir, "l2", npcId, "psyche.json");
}

export function currentAbandonGeneration(): number {
  return abandonGeneration;
}

export function bumpAbandonGeneration(): number {
  abandonGeneration += 1;
  return abandonGeneration;
}

export function playerMemoryPath(): string {
  return join(playerMemoryDir, "current.json");
}

export function pendingPath(): string {
  return join(playerMemoryDir, "pending.json");
}

export async function loadPlayerMemoryAt(id: string): Promise<PlayerMemory> {
  try {
    const raw = JSON.parse(await readFile(join(worldDir(id), "player-memory", "current.json"), "utf8"));
    const parsed = PlayerMemorySchema.safeParse(raw);
    if (!parsed.success) return { body: "" };
    return { body: clipUtf16(parsed.data.body, PLAYER_MEMORY_BODY_MAX) };
  } catch {
    return { body: "" };
  }
}

export async function savePlayerMemoryAt(id: string, mem: PlayerMemory): Promise<void> {
  const dir = join(worldDir(id), "player-memory");
  await mkdir(dir, { recursive: true });
  const body = clipUtf16(mem.body, PLAYER_MEMORY_BODY_MAX);
  await writeFile(join(dir, "current.json"), JSON.stringify({ body }, null, 2));
}

export async function loadPlayerMemory(): Promise<PlayerMemory> {
  if (activeWorldId == null) return { body: "" };
  return loadPlayerMemoryAt(activeWorldId);
}

export async function savePlayerMemory(mem: PlayerMemory): Promise<void> {
  if (activeWorldId == null) return;
  await savePlayerMemoryAt(activeWorldId, mem);
}

export async function appendPlayerMemoryPatchAt(id: string, patch: string): Promise<string> {
  const prev = (await loadPlayerMemoryAt(id)).body;
  const next = prev.trim() ? `${prev.replace(/\s+$/, "")}\n${patch.trim()}` : patch.trim();
  await savePlayerMemoryAt(id, { body: next });
  return prev;
}

export async function appendPlayerMemoryPatch(patch: string): Promise<string> {
  if (activeWorldId == null) return "";
  return appendPlayerMemoryPatchAt(activeWorldId, patch);
}

export async function loadPending(): Promise<AdjudicationPending | null> {
  if (activeWorldId == null) return null;
  try {
    const raw = JSON.parse(await readFile(pendingPath(), "utf8"));
    const parsed = AdjudicationPendingSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function savePending(pending: AdjudicationPending): Promise<void> {
  if (activeWorldId == null) return;
  await mkdir(playerMemoryDir, { recursive: true });
  await writeFile(pendingPath(), JSON.stringify(pending, null, 2));
}

export async function deletePending(): Promise<void> {
  if (activeWorldId == null) return;
  await rm(pendingPath(), { force: true });
}

async function deletePendingAtWorld(id: string): Promise<void> {
  await rm(join(worldDir(id), "player-memory", "pending.json"), { force: true });
}

export async function emptyPlayerMemoryFile(): Promise<string> {
  return JSON.stringify({ body: "" }, null, 2);
}

const PLAYTHROUGH_FILES = [
  "episodes.json",
  "chat-tail.json",
  "entities.json",
  "relations.json",
  "gm_note.txt",
  "scene.json",
  "turn_counter.json",
  "world.json",
  "primer.json",
  "gm_canon.md",
] as const;

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function dirExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

export async function loadSeedEntities(): Promise<Entity[]> {
  const seedFiles = await readdir(kbSeedDir);
  const entities: Entity[] = [];
  for (const f of seedFiles.filter((n) => n.endsWith(".json"))) {
    const raw = JSON.parse(await readFile(join(kbSeedDir, f), "utf8"));
    entities.push(EntitySchema.parse(raw));
  }
  return entities;
}

export async function getSeedIds(): Promise<string[]> {
  return (await loadSeedEntities()).map((e) => e.id);
}

export type WorldInspect =
  | { kind: "valid"; world: World }
  | { kind: "invalid" }
  | { kind: "missing" };

export async function inspectWorld(atDir?: string): Promise<WorldInspect> {
  const worldPath = atDir ? join(atDir, "world.json") : paths.world;
  try {
    const text = await readFile(worldPath, "utf8");
    try {
      const parsed = WorldSchema.safeParse(JSON.parse(text));
      if (parsed.success) return { kind: "valid", world: parsed.data };
      return { kind: "invalid" };
    } catch {
      return { kind: "invalid" };
    }
  } catch {
    return { kind: "missing" };
  }
}

export type WorldGate = { needs_setup: boolean; world: World | null };

async function readGmCanonTrimmed(atDir?: string): Promise<string | null> {
  const canonPath = atDir ? join(atDir, "gm_canon.md") : paths.gmCanon;
  try {
    return (await readFile(canonPath, "utf8")).trim();
  } catch {
    return null;
  }
}

async function loadSaveMetaAt(id: string): Promise<SaveMeta | null> {
  const inspect = await inspectWorld(worldDir(id));
  if (inspect.kind !== "valid") return null;
  if (inspect.world.id !== id) return null;
  return saveMetaFromWorld(inspect.world);
}

/** Ready for a uuid dir: valid world.json (id＝目錄名；custom 尚須非空 canon). */
export async function isPlayableWorld(id: string): Promise<boolean> {
  if (!WORLD_UUID_RE.test(id)) return false;
  if (!(await dirExists(worldDir(id)))) return false;
  const inspect = await inspectWorld(worldDir(id));
  if (inspect.kind !== "valid") return false;
  if (inspect.world.id !== id) return false;
  if (inspect.world.source === "custom") {
    const canon = await readGmCanonTrimmed(worldDir(id));
    if (canon == null || canon.length === 0) return false;
  }
  return true;
}

export type PlayableWorldListItem = {
  id: string;
  save_name: string;
  source: World["source"];
  created_at: string;
};

export async function listPlayableWorlds(): Promise<PlayableWorldListItem[]> {
  await mkdir(kbWorldsDir, { recursive: true });
  let names: string[];
  try {
    names = await readdir(kbWorldsDir);
  } catch {
    return [];
  }
  const out: PlayableWorldListItem[] = [];
  for (const name of names) {
    if (!WORLD_UUID_RE.test(name)) continue;
    if (!(await isPlayableWorld(name))) continue;
    const inspect = await inspectWorld(worldDir(name));
    if (inspect.kind !== "valid") continue;
    out.push({
      id: name,
      save_name: inspect.world.save_name,
      source: inspect.world.source,
      created_at: inspect.world.created_at,
    });
  }
  out.sort((a, b) => {
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return out;
}

async function readPointerId(): Promise<string | null> {
  try {
    const raw = JSON.parse(await readFile(currentPointerPath(), "utf8"));
    const parsed = CurrentPointerSchema.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data.id;
  } catch {
    return null;
  }
}

export async function clearPointer(): Promise<void> {
  await rm(currentPointerPath(), { force: true });
  activeWorldId = null;
  rebindRuntimePaths(join(kbWorldsDir, ".no-active"));
}

export async function writePointer(id: string): Promise<void> {
  await mkdir(kbWorldsDir, { recursive: true });
  await writeFile(currentPointerPath(), JSON.stringify({ id }, null, 2));
}

/** Bind live paths to uuid; write pointer; migrate legacy pi-sessions once. */
export async function setActiveWorld(id: string | null): Promise<void> {
  if (id == null) {
    await clearPointer();
    return;
  }
  if (!WORLD_UUID_RE.test(id)) {
    throw new Error(`invalid world id: ${id}`);
  }
  rebindRuntimePaths(worldDir(id));
  activeWorldId = id;
  await writePointer(id);
  await migratePlaySessionDir();
}

/** Ready gate for the currently bound playthrough (or needs_setup if none). */
export async function syncWorldGate(): Promise<WorldGate> {
  if (activeWorldId == null) {
    return { needs_setup: true, world: null };
  }
  await mkdir(kbRuntimeDir, { recursive: true });
  const inspect = await inspectWorld();
  if (inspect.kind !== "valid") return { needs_setup: true, world: null };
  if (inspect.world.source === "custom") {
    const canon = await readGmCanonTrimmed();
    if (canon == null || canon.length === 0) {
      return { needs_setup: true, world: null };
    }
  }
  return { needs_setup: false, world: inspect.world };
}

export async function getScreen(): Promise<Screen> {
  if (activeWorldId == null) return "home";
  if (!(await isPlayableWorld(activeWorldId))) {
    await clearPointer();
    return "home";
  }
  return "playing";
}

export async function loadActiveSave(): Promise<SaveMeta | null> {
  if (activeWorldId == null) return null;
  return loadSaveMetaAt(activeWorldId);
}

/** Rebind from disk pointer if valid+playable; else clear. Does not delete pointer on boot. */
export async function restorePointerFromDisk(): Promise<Screen> {
  const id = await readPointerId();
  if (!id || !WORLD_UUID_RE.test(id) || !(await isPlayableWorld(id))) {
    await clearPointer();
    return "home";
  }
  rebindRuntimePaths(worldDir(id));
  activeWorldId = id;
  await migratePlaySessionDir();
  return "playing";
}

export async function migratePlaySessionDir(): Promise<void> {
  if (activeWorldId == null) return;
  await mkdir(kbRuntimeDir, { recursive: true });
  const oldExists = await dirExists(legacyPiSessionsDir);
  const newExists = await dirExists(playSessionsDir);
  if (oldExists && !newExists) {
    await rename(legacyPiSessionsDir, playSessionsDir);
  }
}

/**
 * Process boot: ensure parent, delete current.json → always home.
 * Does not seed; does not read kb/runtime/.
 */
export async function bootWorlds(): Promise<void> {
  await mkdir(kbWorldsDir, { recursive: true });
  const id = await readPointerId();
  if (id && WORLD_UUID_RE.test(id)) {
    await deletePendingAtWorld(id);
  }
  await clearPointer();
}

/** @deprecated use bootWorlds; kept for call sites that ensured dirs. */
export async function ensureRuntime(): Promise<void> {
  await bootWorlds();
}

export async function getNeedsSetup(): Promise<boolean> {
  return (await getScreen()) !== "playing";
}

export async function loadValidWorld(): Promise<World | null> {
  return (await syncWorldGate()).world;
}

/** Clear playthrough files inside the active uuid only. No-op if no active. */
export async function clearPlaythrough(): Promise<void> {
  if (activeWorldId == null) return;
  await mkdir(kbRuntimeDir, { recursive: true });
  for (const f of PLAYTHROUGH_FILES) {
    await rm(join(kbRuntimeDir, f), { force: true });
  }
  await rm(join(kbRuntimeDir, "prompts"), { recursive: true, force: true });
  await rm(playSessionsDir, { recursive: true, force: true });
  await rm(legacyPiSessionsDir, { recursive: true, force: true });
  await rm(sessionArchiveDir, { recursive: true, force: true });
  await rm(compactScratchDir, { recursive: true, force: true });
  await rm(compactStatePath, { force: true });
  await rm(npcMemoryDir, { recursive: true, force: true });
  await rm(playerMemoryDir, { recursive: true, force: true });
  await rm(gmMetaSessionsDir, { recursive: true, force: true });
}

/** Clear active uuid internals only (does not delete uuid dir or siblings). */
export async function resetPlaythrough(): Promise<void> {
  await clearPlaythrough();
}

/**
 * Atomically commit files into kb/worlds/{targetId}/.
 * Staging under parent `.vibe-setup-*`; does not touch sibling uuids.
 */
export async function atomicCommitPlaythrough(
  files: Map<string, string>,
  targetId: string,
): Promise<void> {
  if (!files.has("world.json")) throw new Error("atomic commit requires world.json");
  if (!WORLD_UUID_RE.test(targetId)) throw new Error(`invalid target id: ${targetId}`);

  const staging = join(kbWorldsDir, `.vibe-setup-${randomUUID()}`);
  const target = worldDir(targetId);
  await mkdir(kbWorldsDir, { recursive: true });
  await mkdir(staging, { recursive: true });
  try {
    for (const [rel, content] of files) {
      const dest = join(staging, rel);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, content);
    }
    const world = WorldSchema.parse(JSON.parse(await readFile(join(staging, "world.json"), "utf8")));
    if (world.id !== targetId) throw new Error("world.json id must match target uuid");

    if (await dirExists(target)) {
      await rm(target, { recursive: true, force: true });
    }
    await rename(staging, target);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

export async function commitDefaultWorld(saveName: string): Promise<{ world: World; save: SaveMeta }> {
  const id = randomUUID();
  const entities = await loadSeedEntities();
  const world: World = {
    id,
    source: "default",
    save_name: saveName,
    created_at: new Date().toISOString(),
  };
  const save = saveMetaFromWorld(world);
  const files = new Map<string, string>([
    ["entities.json", JSON.stringify(entities, null, 2)],
    ["episodes.json", "[]"],
    ["chat-tail.json", "[]"],
    ["relations.json", "[]"],
    ["gm_note.txt", INITIAL_GM_NOTE],
    ["scene.json", JSON.stringify(INITIAL_SCENE, null, 2)],
    ["turn_counter.json", JSON.stringify({ n: 0 })],
    ["compact-state.json", JSON.stringify({ anchor_turn_n: 0 } satisfies CompactState, null, 2)],
    ["world.json", JSON.stringify(world, null, 2)],
    ["npc-memory/pool.json", JSON.stringify(EMPTY_NPC_POOL, null, 2)],
    [
      "npc-memory/dirty-set.json",
      JSON.stringify(
        { since_session_archive: null, touched: ["bartender", "ash"], near_cap: [] } satisfies DirtySet,
        null,
        2,
      ),
    ],
    [
      "npc-memory/l2/bartender/current.json",
      JSON.stringify(
        { npc_id: "bartender", body: DEFAULT_L2_CURRENT_BODY.bartender, updated_turn: 0 },
        null,
        2,
      ),
    ],
    [
      "npc-memory/l2/ash/current.json",
      JSON.stringify({ npc_id: "ash", body: DEFAULT_L2_CURRENT_BODY.ash, updated_turn: 0 }, null, 2),
    ],
    [
      "npc-memory/l2/bartender/psyche.json",
      JSON.stringify({ npc_id: "bartender", ...DEFAULT_L2_PSYCHE.bartender }, null, 2),
    ],
    [
      "npc-memory/l2/ash/psyche.json",
      JSON.stringify({ npc_id: "ash", ...DEFAULT_L2_PSYCHE.ash }, null, 2),
    ],
    ["player-memory/current.json", JSON.stringify({ body: "" }, null, 2)],
  ]);
  await atomicCommitPlaythrough(files, id);
  await setActiveWorld(id);
  return { world, save };
}

export async function commitCustomWorld(
  primer: Primer,
  generated: GeneratedWorld,
  saveName: string,
): Promise<{ world: World; save: SaveMeta }> {
  const id = randomUUID();
  const world: World = {
    id,
    source: "custom",
    save_name: saveName,
    created_at: new Date().toISOString(),
  };
  const save = saveMetaFromWorld(world);
  const entities = generated.entities.map((e) =>
    e.kind === "npc" ? { ...e, memory_tier: 0 as const } : e,
  );
  const files = new Map<string, string>([
    ["entities.json", JSON.stringify(entities, null, 2)],
    ["episodes.json", "[]"],
    ["chat-tail.json", "[]"],
    ["relations.json", JSON.stringify(generated.relations, null, 2)],
    ["gm_note.txt", generated.gm_note],
    ["scene.json", JSON.stringify(generated.scene, null, 2)],
    ["turn_counter.json", JSON.stringify({ n: 0 })],
    ["compact-state.json", JSON.stringify({ anchor_turn_n: 0 } satisfies CompactState, null, 2)],
    ["primer.json", JSON.stringify(primer, null, 2)],
    ["gm_canon.md", generated.gm_canon],
    ["world.json", JSON.stringify(world, null, 2)],
    ["npc-memory/pool.json", JSON.stringify(EMPTY_NPC_POOL, null, 2)],
    ["npc-memory/dirty-set.json", JSON.stringify(EMPTY_DIRTY_SET, null, 2)],
    ["player-memory/current.json", JSON.stringify({ body: "" }, null, 2)],
  ]);
  await atomicCommitPlaythrough(files, id);
  await setActiveWorld(id);
  return { world, save };
}

/** 測試用：顯式灌 default，禁止依賴 boot 偷灌。 */
export async function setupDefaultForTest(saveName = "test"): Promise<World> {
  const { world } = await commitDefaultWorld(saveName);
  return world;
}

/** Test helper: wipe parent uuid dirs + pointer; leave empty parent. */
export async function wipeWorlds(): Promise<void> {
  await mkdir(kbWorldsDir, { recursive: true });
  const names = await readdir(kbWorldsDir);
  for (const name of names) {
    await rm(join(kbWorldsDir, name), { recursive: true, force: true });
  }
  await clearPointer();
}

/**
 * Test helper: create empty uuid dir, write pointer, bind paths.
 * Existing wipe(kbRuntimeDir) tests can call this after wipeWorlds.
 */
export async function activateTestWorld(id?: string): Promise<string> {
  const wid = id ?? randomUUID();
  if (!WORLD_UUID_RE.test(wid)) throw new Error("bad test world id");
  await mkdir(worldDir(wid), { recursive: true });
  await setActiveWorld(wid);
  return wid;
}

export async function deleteActiveWorldDir(): Promise<void> {
  if (activeWorldId == null) return;
  const id = activeWorldId;
  const dir = worldDir(id);
  await clearPointer();
  await rm(dir, { recursive: true, force: true });
}

export async function loadEpisodes(): Promise<Episode[]> {
  if (activeWorldId == null) return [];
  const raw = await readJson<unknown[]>(paths.episodes, []);
  return raw.map((e) => EpisodeSchema.parse(e));
}

export async function saveEpisodes(episodes: Episode[]): Promise<void> {
  await writeFile(paths.episodes, JSON.stringify(episodes, null, 2));
}

/** 近期對局氣泡；缺檔／舊存檔回空陣列（UI 可退回 episode 摘要）。 */
export async function loadChatTail(): Promise<ChatTailEntry[]> {
  if (activeWorldId == null) return [];
  const raw = await readJson<unknown[]>(paths.chatTail, []);
  if (!Array.isArray(raw)) return [];
  const out: ChatTailEntry[] = [];
  for (const row of raw) {
    const parsed = ChatTailEntrySchema.safeParse(row);
    if (parsed.success) out.push(parsed.data);
  }
  return out.slice(-CHAT_TAIL_KEEP);
}

export async function appendChatTail(entry: ChatTailEntry): Promise<void> {
  if (activeWorldId == null) return;
  const next = [...(await loadChatTail()), ChatTailEntrySchema.parse(entry)].slice(-CHAT_TAIL_KEEP);
  await writeFile(paths.chatTail, JSON.stringify(next, null, 2));
}

export async function loadEntities(): Promise<Entity[]> {
  if (activeWorldId == null) return [];
  const raw = await readJson<unknown[]>(paths.entities, []);
  return raw.map((e) => EntitySchema.parse(e));
}

export async function loadNpcPool(): Promise<NpcPool> {
  try {
    const raw = JSON.parse(await readFile(join(npcMemoryDir, "pool.json"), "utf8"));
    return NpcPoolSchema.parse(raw);
  } catch {
    return { npcs: {} };
  }
}

export async function saveNpcPool(pool: NpcPool): Promise<void> {
  await mkdir(npcMemoryDir, { recursive: true });
  await writeFile(join(npcMemoryDir, "pool.json"), JSON.stringify(NpcPoolSchema.parse(pool), null, 2));
}

export async function loadDirtySet(): Promise<DirtySet> {
  try {
    const raw = JSON.parse(await readFile(join(npcMemoryDir, "dirty-set.json"), "utf8"));
    return DirtySetSchema.parse(raw);
  } catch {
    return { ...EMPTY_DIRTY_SET, touched: [], near_cap: [] };
  }
}

export async function saveDirtySet(dirty: DirtySet): Promise<void> {
  await mkdir(npcMemoryDir, { recursive: true });
  const parsed = DirtySetSchema.parse(dirty);
  await writeFile(join(npcMemoryDir, "dirty-set.json"), JSON.stringify(parsed, null, 2));
}

export async function loadL2Current(npcId: string): Promise<L2Current | null> {
  try {
    const raw = JSON.parse(await readFile(l2CurrentPath(npcId), "utf8"));
    const parsed = L2CurrentSchema.parse(raw);
    if (parsed.npc_id !== npcId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveL2Current(current: L2Current): Promise<void> {
  const dest = l2CurrentPath(current.npc_id);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, JSON.stringify(L2CurrentSchema.parse(current), null, 2));
}

export async function loadL2Psyche(npcId: string): Promise<NpcPsyche> {
  try {
    const raw = JSON.parse(await readFile(l2PsychePath(npcId), "utf8"));
    const parsed = NpcPsycheSchema.parse(raw);
    if (parsed.npc_id !== npcId) return emptyNpcPsyche(npcId);
    return clipNpcPsyche(parsed);
  } catch {
    return emptyNpcPsyche(npcId);
  }
}

export async function saveL2Psyche(psyche: NpcPsyche): Promise<void> {
  const dest = l2PsychePath(psyche.npc_id);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, JSON.stringify(clipNpcPsyche(NpcPsycheSchema.parse(psyche)), null, 2));
}

export async function removeL2Dir(npcId: string): Promise<void> {
  await rm(join(npcMemoryDir, "l2", npcId), { recursive: true, force: true });
}

export async function saveEntities(entities: Entity[]): Promise<void> {
  await writeFile(paths.entities, JSON.stringify(entities, null, 2));
}

export async function loadRelations(): Promise<Relation[]> {
  if (activeWorldId == null) return [];
  const raw = await readJson<unknown[]>(paths.relations, []);
  return raw.map((e) => RelationSchema.parse(e));
}

export async function saveRelations(relations: Relation[]): Promise<void> {
  await writeFile(paths.relations, JSON.stringify(relations, null, 2));
}

export async function loadGmNote(): Promise<string> {
  if (activeWorldId == null) return "";
  try {
    return (await readFile(paths.gmNote, "utf8")).trim();
  } catch {
    return "";
  }
}

export async function saveGmNote(note: string): Promise<void> {
  const clipped = note.slice(0, 800);
  await writeFile(paths.gmNote, clipped);
}

export async function loadScene(): Promise<SceneState | null> {
  if (activeWorldId == null) return null;
  try {
    const raw = JSON.parse(await readFile(paths.scene, "utf8"));
    const parsed = SceneStateSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function saveScene(scene: SceneState): Promise<void> {
  await writeFile(paths.scene, JSON.stringify(SceneStateSchema.parse(scene), null, 2));
}

export async function loadCompactState(): Promise<CompactState> {
  try {
    const raw = JSON.parse(await readFile(compactStatePath, "utf8"));
    return CompactStateSchema.parse(raw);
  } catch {
    const init: CompactState = { anchor_turn_n: 0 };
    await saveCompactState(init);
    return init;
  }
}

export async function saveCompactState(state: CompactState): Promise<void> {
  await mkdir(kbRuntimeDir, { recursive: true });
  await writeFile(compactStatePath, JSON.stringify(CompactStateSchema.parse(state), null, 2));
}

export async function peekTurnId(): Promise<string> {
  const c = await readJson<{ n: number }>(paths.turnCounter, { n: 0 });
  return `t${String(Math.max(0, c.n)).padStart(4, "0")}`;
}

export async function nextTurnId(): Promise<string> {
  const c = await readJson<{ n: number }>(paths.turnCounter, { n: 0 });
  c.n += 1;
  await writeFile(paths.turnCounter, JSON.stringify(c));
  return `t${String(c.n).padStart(4, "0")}`;
}

export async function buildMemorySlice(): Promise<MemorySlice> {
  const episodes = await loadEpisodes();
  const entities = await loadEntities();
  const relations = await loadRelations();
  const recent = episodes.slice(-8);
  return {
    episodes: recent.map(({ id, summary, timestamp }) => ({
      id,
      summary,
      timestamp,
    })),
    entities: entities.map(({ id, name, summary }) => ({ id, name, summary })),
    relations,
  };
}

export async function loadCustomGmCanon(): Promise<string> {
  try {
    const text = (await readFile(paths.gmCanon, "utf8")).trim();
    if (!text) {
      throw new HttpError(409, { needs_setup: true, error: "needs_setup" });
    }
    return text;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(409, { needs_setup: true, error: "needs_setup" });
  }
}
