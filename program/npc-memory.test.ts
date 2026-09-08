import "./test-runtime-env.ts";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "bun:test";
import {
  commitCustomWorld,
  DEFAULT_L2_CURRENT_BODY,
  INITIAL_SCENE,
  activateTestWorld,
  kbRuntimeDir,
  wipeWorlds,
  loadDirtySet,
  loadEntities,
  loadL2Current,
  loadNpcPool,
  resetPlaythrough,
  saveEntities,
  setupDefaultForTest,
} from "./kb.ts";
import {
  assembleNpcMemories,
  buildGmContext,
  setPromoteL2FailHook,
} from "./npc-memory.ts";
import {
  EntitySchema,
  NpcArchiveEntrySchema,
  NpcArchiveIndexSchema,
  parseGeneratedWorld,
  PrimerSchema,
  type Entity,
  type GmOutput,
} from "./schema.ts";
import { setupCustom } from "./setup.ts";
import { runTurn } from "./turn.ts";
import { writeFromGm } from "./writer.ts";
import { mockGeneratedWorld } from "./world-mock.ts";

const LONG_PRIMER = PrimerSchema.parse({
  worldview: "紫晶沙漠裡的鐘樓每小時倒轉一次，沙粒會記住說出口的謊。",
  protagonist: "",
  extras: "",
  starting_point: "玩家在一座沒有門牌的石棧醒來，風裡全是鹽。",
});

async function wipe(): Promise<void> {
  await wipeWorlds();
  await activateTestWorld();
}

async function walkFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: import("node:fs").Dirent[] = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await walkFiles(p)));
    else out.push(p);
  }
  return out;
}

function greetGm(npcId: string): GmOutput {
  return {
    narration: "門開了一縫。",
    npc_lines: [{ npc_id: npcId, name: "路人", text: "嗨。" }],
    events: [
      {
        actors: ["player", npcId],
        action: "greet",
        result: "nod",
        summary: "互相點頭打招呼",
        entity_ids: [npcId, "player"],
      },
    ],
    gm_note: "進行中",
    scene: INITIAL_SCENE,
    ui: null,
    needs_image: false,
  };
}

function talkGm(npcId: string, summary: string): GmOutput {
  return {
    narration: "兩人把話往深處說。",
    npc_lines: [{ npc_id: npcId, name: npcId, text: "這件事不能讓第三個人聽見，燈油的帳要對。" }],
    events: [
      {
        actors: ["player", npcId],
        action: "confide",
        result: "shared",
        summary,
        entity_ids: [npcId, "player"],
      },
    ],
    gm_note: "進行中",
    scene: INITIAL_SCENE,
    ui: null,
    needs_image: false,
  };
}

test("memory_tier: npc missing is 0; non-npc with value fails", () => {
  expect(EntitySchema.parse({ id: "x", name: "X", kind: "npc", summary: "s" }).memory_tier).toBe(0);
  expect(() =>
    EntitySchema.parse({ id: "tavern", name: "館", kind: "place", summary: "s", memory_tier: 2 }),
  ).toThrow();
});

test("archive schemas: new writes omit quotes; old quotes strip; index has summary", () => {
  const index = NpcArchiveIndexSchema.parse({
    npc_id: "bartender",
    entries: [
      {
        npc_archive_id: "na_bartender_003",
        turn_from: "t0030",
        turn_to: "t0042",
        title: "北路",
        summary: "北路燈手未回，知情壓著。",
        body_chars: 400,
        quote_count: 1,
      },
    ],
  });
  expect(index.entries[0]?.npc_archive_id).toBe("na_bartender_003");
  expect(index.entries[0]?.summary).toContain("燈手");
  expect("quote_count" in (index.entries[0] as object)).toBe(false);
  const entry = NpcArchiveEntrySchema.parse({
    npc_archive_id: "na_bartender_003",
    npc_id: "bartender",
    turn_from: "t0030",
    turn_to: "t0042",
    title: "北路",
    summary: "知情未說。",
    salient_quotes: [{ turn_id: "t0031", speaker: "ash", text: "不該知道。" }],
  });
  expect("salient_quotes" in entry).toBe(false);
  expect(entry.summary).toBe("知情未說。");
});

test("default setup L2 files and empty pool for mara/ash", async () => {
  await wipe();
  await setupDefaultForTest();
  const entities = await loadEntities();
  expect(entities.find((e) => e.id === "bartender")?.memory_tier).toBe(2);
  expect(entities.find((e) => e.id === "ash")?.memory_tier).toBe(2);
  const bartender = await loadL2Current("bartender");
  const ash = await loadL2Current("ash");
  expect(bartender?.body.includes(DEFAULT_L2_CURRENT_BODY.bartender.slice(0, 6))).toBe(true);
  expect(ash?.body.includes("蠟封紙條")).toBe(true);
  const pool = await loadNpcPool();
  expect(pool.npcs.bartender).toBeUndefined();
  expect(pool.npcs.ash).toBeUndefined();
  const dirty = await loadDirtySet();
  expect(dirty.touched).toEqual(["bartender", "ash"]);
  expect(dirty.near_cap).toEqual([]);
  expect(existsSync(join(kbRuntimeDir, "npc-memory", "l2", "bartender", "archive"))).toBe(false);
});

test("generated npc tier 2 is committed as 0 without l2", async () => {
  await wipe();
  const generated = mockGeneratedWorld(LONG_PRIMER);
  generated.entities = generated.entities.map((e) =>
    e.kind === "npc" ? { ...e, memory_tier: 2 as const } : e,
  );
  const parsed = parseGeneratedWorld(generated, LONG_PRIMER);
  expect(parsed.entities.find((e) => e.kind === "npc")?.memory_tier).toBe(0);
  await commitCustomWorld(LONG_PRIMER, generated, "t");
  const entities = await loadEntities();
  expect(entities.find((e) => e.id === "keeper")?.memory_tier).toBe(0);
  expect(existsSync(join(kbRuntimeDir, "npc-memory", "l2", "bartender"))).toBe(false);
  expect(existsSync(join(kbRuntimeDir, "npc-memory", "l2", "keeper"))).toBe(false);
  expect((await loadNpcPool()).npcs).toEqual({});
});

test("greet writes L0 and does not promote even if relation exists", async () => {
  await wipe();
  await setupDefaultForTest();
  await writeFromGm(greetGm("passerby"), "t0001", new Date().toISOString(), "tavern");
  const passerby = (await loadEntities()).find((e) => e.id === "passerby");
  expect(passerby?.memory_tier).toBe(0);
  expect((await loadNpcPool()).npcs.passerby?.tier).toBe(0);
  expect((await loadNpcPool()).npcs.passerby?.last_substantive_turn).toBe(1);
});

test("present only does not write body or promote", async () => {
  await wipe();
  await setupDefaultForTest();
  const gm: GmOutput = {
    narration: "瑪拉仍在吧台。",
    npc_lines: [{ npc_id: "bartender", text: "坐。" }],
    events: [
      {
        actors: ["player", "bartender"],
        action: "talk_idle",
        result: "ok",
        summary: "與瑪拉閒談",
        entity_ids: ["bartender", "passerby", "player"],
      },
    ],
    gm_note: "進行中",
    scene: INITIAL_SCENE,
    ui: null,
    needs_image: false,
  };
  await writeFromGm(gm, "t0001", new Date().toISOString(), "tavern");
  expect((await loadEntities()).some((e) => e.id === "passerby")).toBe(true);
  expect((await loadEntities()).find((e) => e.id === "passerby")?.memory_tier).toBe(0);
  expect((await loadNpcPool()).npcs.passerby).toBeUndefined();
});

test("non-trivial talk promotes 0 to 1", async () => {
  await wipe();
  await setupDefaultForTest();
  await writeFromGm(talkGm("lantern_keeper", "守燈人把失蹤的夜告訴玩家"), "t0002", new Date().toISOString(), "tavern");
  expect((await loadEntities()).find((e) => e.id === "lantern_keeper")?.memory_tier).toBe(1);
  expect((await loadNpcPool()).npcs.lantern_keeper?.tier).toBe(1);
});

test("pool body over 600 promotes to L2 atomically; inject rolls back", async () => {
  await wipe();
  await setupDefaultForTest();
  const entities = await loadEntities();
  entities.push({
    id: "scribe",
    name: "書記",
    kind: "npc",
    summary: "路人書記",
    memory_tier: 1,
  });
  await saveEntities(entities);
  await mkdir(join(kbRuntimeDir, "npc-memory"), { recursive: true });
  await writeFile(
    join(kbRuntimeDir, "npc-memory", "pool.json"),
    JSON.stringify({
      npcs: { scribe: { tier: 1, last_substantive_turn: 1, body: "x".repeat(598) } },
    }),
  );

  setPromoteL2FailHook(() => {
    throw new Error("inject");
  });
  try {
    await writeFromGm(talkGm("scribe", "把整本帳的缺口講完"), "t0002", new Date().toISOString(), "tavern");
    throw new Error("expected inject");
  } catch (err) {
    expect(err instanceof Error && err.message === "inject").toBe(true);
  } finally {
    setPromoteL2FailHook(null);
  }
  expect((await loadEntities()).find((e) => e.id === "scribe")?.memory_tier).toBe(1);
  expect((await loadNpcPool()).npcs.scribe).toBeDefined();
  expect(existsSync(join(kbRuntimeDir, "npc-memory", "l2", "scribe"))).toBe(false);

  await writeFromGm(talkGm("scribe", "把整本帳的缺口講完"), "t0003", new Date().toISOString(), "tavern");
  expect((await loadEntities()).find((e) => e.id === "scribe")?.memory_tier).toBe(2);
  expect((await loadNpcPool()).npcs.scribe).toBeUndefined();
  expect((await loadL2Current("scribe"))?.body.length).toBeGreaterThan(0);
  expect((await loadDirtySet()).touched.includes("scribe")).toBe(true);
});

test("L0 forgotten after 12 turns without substantive hit; entity remains", async () => {
  await wipe();
  await setupDefaultForTest();
  await writeFromGm(greetGm("passerby"), "t0001", new Date().toISOString(), "tavern");
  expect((await loadNpcPool()).npcs.passerby).toBeDefined();
  await writeFromGm(
    {
      narration: "雨還在下。",
      npc_lines: [{ npc_id: "bartender", text: "杯子自己會乾。" }],
      events: [
        {
          actors: ["player", "bartender"],
          action: "talk_idle",
          result: "ok",
          summary: "與老闆說話",
          entity_ids: ["bartender", "player"],
        },
      ],
    gm_note: "進行中",
    scene: INITIAL_SCENE,
    ui: null,
      needs_image: false,
    },
    "t0013",
    new Date().toISOString(),
    "tavern",
  );
  expect((await loadNpcPool()).npcs.passerby).toBeUndefined();
  expect((await loadEntities()).some((e) => e.id === "passerby")).toBe(true);
});

test("buildGmContext only includes present npcs; missing L2 omitted; no full pool", async () => {
  const entities: Entity[] = [
    { id: "player", name: "P", kind: "player", summary: "p" },
    { id: "bartender", name: "瑪拉", kind: "npc", summary: "b", memory_tier: 2 },
    { id: "ghost", name: "鬼", kind: "npc", summary: "g", memory_tier: 0 },
  ];
  const pool = {
    npcs: {
      ghost: { tier: 0 as const, last_substantive_turn: 1, body: "不該進 prompt 的池密。" },
      bartender: { tier: 1 as const, last_substantive_turn: 1, body: "池裡不該有 L2。" },
    },
  };
  const memories = assembleNpcMemories({
    scene: { scene_id: "tavern", present: ["player", "bartender"], visible: [] },
    entities,
    pool,
    l2ById: new Map([["bartender", null]]),
  });
  expect(memories.some((m) => m.npc_id === "ghost")).toBe(false);
  expect(memories.some((m) => m.npc_id === "bartender")).toBe(false);
  const ctx = buildGmContext({
    player_text: "hi",
    gm_note: "n",
    scene: { scene_id: "tavern", present: ["player", "bartender"], visible: [] },
    memory_slice: { episodes: [], entities: [], relations: [] },
    turn_id: "t0001",
    timestamp: "t",
    entities,
    pool,
    l2ById: new Map([
      ["bartender", { npc_id: "bartender", body: "吧台印象", updated_turn: 0 }],
    ]),
  });
  expect(ctx.npc_memories).toEqual([{ npc_id: "bartender", tier: 2, body: "吧台印象" }]);
});

test("dirty near_cap follows L2 body length 640", async () => {
  await wipe();
  await setupDefaultForTest();
  const long = "記".repeat(640);
  await writeFile(
    join(kbRuntimeDir, "npc-memory", "l2", "bartender", "current.json"),
    JSON.stringify({ npc_id: "bartender", body: long, updated_turn: 1 }),
  );
  await writeFromGm(
    {
      narration: "雨。",
      npc_lines: [{ npc_id: "ash", text: "別出聲。" }],
      events: [
        {
          actors: ["player", "ash"],
          action: "greet",
          result: "ok",
          summary: "點頭",
          entity_ids: ["ash", "player"],
        },
      ],
    gm_note: "進行中",
    scene: INITIAL_SCENE,
    ui: null,
      needs_image: false,
    },
    "t0004",
    new Date().toISOString(),
    "tavern",
  );
  expect((await loadDirtySet()).near_cap.includes("bartender")).toBe(true);
  await writeFile(
    join(kbRuntimeDir, "npc-memory", "l2", "bartender", "current.json"),
    JSON.stringify({ npc_id: "bartender", body: "短", updated_turn: 4 }),
  );
  await writeFromGm(
    {
      narration: "燈。",
      npc_lines: [{ npc_id: "ash", text: "嗯。" }],
      events: [
        {
          actors: ["player", "ash"],
          action: "nod",
          result: "ok",
          summary: "點頭",
          entity_ids: ["ash", "player"],
        },
      ],
    gm_note: "進行中",
    scene: INITIAL_SCENE,
    ui: null,
      needs_image: false,
    },
    "t0005",
    new Date().toISOString(),
    "tavern",
  );
  expect((await loadDirtySet()).near_cap.includes("bartender")).toBe(false);
});

test("custom harbor has no tavern L2; new npc not 2; no archive files", async () => {
  await wipe();
  await setupCustom({ ...LONG_PRIMER, save_name: "t" });
  expect(existsSync(join(kbRuntimeDir, "npc-memory", "l2", "bartender"))).toBe(false);
  // setup 會跑開場回合；keeper 開口後可能升到 1，但仍不得是 L2／tier 2
  const keeperTier = (await loadEntities()).find((e) => e.id === "keeper")?.memory_tier;
  expect(keeperTier).toBeDefined();
  expect(keeperTier!).toBeLessThan(2);
  expect(existsSync(join(kbRuntimeDir, "npc-memory", "l2", "keeper"))).toBe(false);
  const result = await runTurn({ player_text: "我向櫃檯點一碗湯" });
  const files = await walkFiles(join(kbRuntimeDir, "npc-memory"));
  expect(files.some((f) => f.includes(`${join("archive")}`))).toBe(false);
  expect("archive_excerpts" in result).toBe(false);
  await resetPlaythrough();
  expect(existsSync(join(kbRuntimeDir, "npc-memory"))).toBe(false);
});

test("runTurn HTTP result has no npc_memories key", async () => {
  await wipe();
  await setupDefaultForTest();
  const result = await runTurn({ player_text: "你好" });
  expect("npc_memories" in result).toBe(false);
  expect("archive_excerpts" in result).toBe(false);
});


test("writer does not copy npc_lines text verbatim into L2 current.body", async () => {
  await wipe();
  await setupDefaultForTest();
  const line = "這句台詞絕對不該整段進 current";
  await writeFromGm(
    {
      narration: "灰低聲回了一句。",
      gm_note: "進行中。",
      scene: { scene_id: "tavern", present: ["player", "ash", "bartender"], visible: [] },
      npc_lines: [{ npc_id: "ash", name: "灰", text: line }],
      events: [
        {
          actors: ["ash", "player"],
          action: "reply",
          result: "quiet",
          summary: "灰對玩家低聲回應",
          entity_ids: ["ash", "player"],
        },
      ],
      ui: null,
      needs_image: false,
    } as any,
    "t0001",
    new Date().toISOString(),
    "tavern",
  );
  const cur = await loadL2Current("ash");
  expect(cur?.body.includes(line)).toBe(false);
});
