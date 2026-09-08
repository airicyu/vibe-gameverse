import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { HttpError } from "./errors.ts";
import {
  DEFAULT_WORLD_TITLE,
  DirtySetSchema,
  EMPTY_DIRTY_SET,
  EMPTY_NPC_POOL,
  EntitySchema,
  EpisodeSchema,
  L2CurrentSchema,
  NpcPoolSchema,
  RelationSchema,
  SceneStateSchema,
  WorldSchema,
  type DirtySet,
  type Entity,
  type Episode,
  type GeneratedWorld,
  type L2Current,
  type MemorySlice,
  type NpcPool,
  type Primer,
  type Relation,
  type SceneState,
  type World,
} from "./schema.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const kbSeedDir = join(root, "kb", "seed");
export const kbRuntimeDir =
  process.env.VIBE_GAMEVERSE_KB_RUNTIME?.trim() || join(root, "kb", "runtime");

export const npcMemoryDir = join(kbRuntimeDir, "npc-memory");

const paths = {
  episodes: join(kbRuntimeDir, "episodes.json"),
  entities: join(kbRuntimeDir, "entities.json"),
  relations: join(kbRuntimeDir, "relations.json"),
  gmNote: join(kbRuntimeDir, "gm_note.txt"),
  scene: join(kbRuntimeDir, "scene.json"),
  turnCounter: join(kbRuntimeDir, "turn_counter.json"),
  world: join(kbRuntimeDir, "world.json"),
  primer: join(kbRuntimeDir, "primer.json"),
  gmCanon: join(kbRuntimeDir, "gm_canon.md"),
};

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

export function l2CurrentPath(npcId: string): string {
  return join(npcMemoryDir, "l2", npcId, "current.json");
}

const PLAYTHROUGH_FILES = [
  "episodes.json",
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

export async function inspectWorld(): Promise<WorldInspect> {
  try {
    const text = await readFile(paths.world, "utf8");
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

async function readGmCanonTrimmed(): Promise<string | null> {
  try {
    return (await readFile(paths.gmCanon, "utf8")).trim();
  } catch {
    return null;
  }
}

/** 唯一 ready 真相：無效 world；custom 缺／空 gm_canon.md；其餘有效 world（default 忽略 canon）。 */
export async function syncWorldGate(): Promise<WorldGate> {
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

export async function ensureRuntime(): Promise<void> {
  await syncWorldGate();
  await mkdir(npcMemoryDir, { recursive: true });
}

export async function getNeedsSetup(): Promise<boolean> {
  return (await syncWorldGate()).needs_setup;
}

export async function loadValidWorld(): Promise<World | null> {
  return (await syncWorldGate()).world;
}

export async function clearPlaythrough(): Promise<void> {
  await mkdir(kbRuntimeDir, { recursive: true });
  for (const f of PLAYTHROUGH_FILES) {
    await rm(join(kbRuntimeDir, f), { force: true });
  }
  await rm(join(kbRuntimeDir, "prompts"), { recursive: true, force: true });
  await rm(join(kbRuntimeDir, "pi-sessions"), { recursive: true, force: true });
  await rm(npcMemoryDir, { recursive: true, force: true });
}

/** 新遊戲：只清空，不灌 seed、不開對局。 */
export async function resetPlaythrough(): Promise<void> {
  await clearPlaythrough();
}

export async function atomicCommitPlaythrough(files: Map<string, string>): Promise<void> {
  if (!files.has("world.json")) throw new Error("atomic commit requires world.json");
  const staging = join(dirname(kbRuntimeDir), `.vibe-setup-${randomUUID()}`);
  await mkdir(staging, { recursive: true });
  try {
    for (const [rel, content] of files) {
      const dest = join(staging, rel);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, content);
    }
    WorldSchema.parse(JSON.parse(await readFile(join(staging, "world.json"), "utf8")));
    await mkdir(kbRuntimeDir, { recursive: true });
    await clearPlaythrough();
    const rest = [...files.keys()].filter((k) => k !== "world.json");
    for (const rel of rest) {
      const to = join(kbRuntimeDir, rel);
      await mkdir(dirname(to), { recursive: true });
      await rename(join(staging, rel), to);
    }
    await rename(join(staging, "world.json"), paths.world);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

export async function commitDefaultWorld(): Promise<World> {
  const entities = await loadSeedEntities();
  const world: World = {
    source: "default",
    title: DEFAULT_WORLD_TITLE,
    created_at: new Date().toISOString(),
  };
  const files = new Map<string, string>([
    ["entities.json", JSON.stringify(entities, null, 2)],
    ["episodes.json", "[]"],
    ["relations.json", "[]"],
    ["gm_note.txt", INITIAL_GM_NOTE],
    ["scene.json", JSON.stringify(INITIAL_SCENE, null, 2)],
    ["turn_counter.json", JSON.stringify({ n: 0 })],
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
  ]);
  await atomicCommitPlaythrough(files);
  return world;
}

export async function commitCustomWorld(primer: Primer, generated: GeneratedWorld): Promise<World> {
  const world: World = {
    source: "custom",
    title: generated.title,
    created_at: new Date().toISOString(),
  };
  const entities = generated.entities.map((e) =>
    e.kind === "npc" ? { ...e, memory_tier: 0 as const } : e,
  );
  const files = new Map<string, string>([
    ["entities.json", JSON.stringify(entities, null, 2)],
    ["episodes.json", "[]"],
    ["relations.json", JSON.stringify(generated.relations, null, 2)],
    ["gm_note.txt", generated.gm_note],
    ["scene.json", JSON.stringify(generated.scene, null, 2)],
    ["turn_counter.json", JSON.stringify({ n: 0 })],
    ["primer.json", JSON.stringify(primer, null, 2)],
    ["gm_canon.md", generated.gm_canon],
    ["world.json", JSON.stringify(world, null, 2)],
    ["npc-memory/pool.json", JSON.stringify(EMPTY_NPC_POOL, null, 2)],
    ["npc-memory/dirty-set.json", JSON.stringify(EMPTY_DIRTY_SET, null, 2)],
  ]);
  await atomicCommitPlaythrough(files);
  return world;
}

/** 測試用：顯式灌 default，禁止依賴 boot 偷灌。 */
export async function setupDefaultForTest(): Promise<World> {
  return commitDefaultWorld();
}

export async function loadEpisodes(): Promise<Episode[]> {
  const raw = await readJson<unknown[]>(paths.episodes, []);
  return raw.map((e) => EpisodeSchema.parse(e));
}

export async function saveEpisodes(episodes: Episode[]): Promise<void> {
  await writeFile(paths.episodes, JSON.stringify(episodes, null, 2));
}

export async function loadEntities(): Promise<Entity[]> {
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
  const parsed = DirtySetSchema.parse({ ...dirty, since_session_archive: null });
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

export async function removeL2Dir(npcId: string): Promise<void> {
  await rm(join(npcMemoryDir, "l2", npcId), { recursive: true, force: true });
}

export async function saveEntities(entities: Entity[]): Promise<void> {
  await writeFile(paths.entities, JSON.stringify(entities, null, 2));
}

export async function loadRelations(): Promise<Relation[]> {
  const raw = await readJson<unknown[]>(paths.relations, []);
  return raw.map((e) => RelationSchema.parse(e));
}

export async function saveRelations(relations: Relation[]): Promise<void> {
  await writeFile(paths.relations, JSON.stringify(relations, null, 2));
}

export async function loadGmNote(): Promise<string> {
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
  try {
    const raw = JSON.parse(await readFile(paths.scene, "utf8"));
    const parsed = SceneStateSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
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
