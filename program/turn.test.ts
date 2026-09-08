import "./test-runtime-env.ts";
import { mkdir, rm } from "node:fs/promises";
import { expect, test } from "bun:test";
import { parseAssistantJson } from "./gm-pi.ts";
import { GmOutputSchema, parseGmOutput } from "./schema.ts";
import { mockGm } from "./gm-mock.ts";
import { writeFromGm } from "./writer.ts";
import { HttpError } from "./errors.ts";
import { kbRuntimeDir, loadEntities, loadEpisodes, loadRelations, resetPlaythrough, setupDefaultForTest } from "./kb.ts";
import { runTurn } from "./turn.ts";

test("parseAssistantJson extracts object from fence", () => {
  const raw = 'sure\n```json\n{"narration":"ok","npc_lines":[],"events":[],"gm_note":"n","ui":null,"needs_image":false}\n```';
  const obj = parseAssistantJson(raw) as { narration: string };
  expect(obj.narration).toBe("ok");
});

test("parseAssistantJson repairs trailing commas", () => {
  const obj = parseAssistantJson('{ "title": "a", "summary": "b", }') as { title: string };
  expect(obj.title).toBe("a");
});

test("parseGmOutput coerces single npc_lines object to array", () => {
  const gm = parseGmOutput({
    narration: "煙味很重。",
    npc_lines: { npc_id: "bartender", text: "怪人？這裡每天都是怪人。" },
    events: {
      actors: "player,bartender",
      action: "ask",
      result: "evasive",
      summary: "問怪人",
      entity_ids: "bartender",
    },
    gm_note: "防備中",
    scene: { scene_id: "tavern", present: ["player", "bartender", "ash"], visible: [] },
    ui: null,
    needs_image: false,
  });
  expect(gm.npc_lines).toHaveLength(1);
  expect(gm.events).toHaveLength(1);
  expect(gm.events[0]?.actors).toEqual(["player", "bartender"]);
});

test("parseGmOutput fills display name and rejects echo-without-narration", () => {
  const gm = parseGmOutput({
    narration: "煙味很重。",
    npc_lines: [{ npc_id: "bartender", text: "坐。" }],
    events: [],
    gm_note: "x",
    scene: { scene_id: "tavern", present: ["player", "bartender", "ash"], visible: [] },
    ui: null,
    needs_image: false,
  });
  expect(gm.npc_lines[0]?.name).toBe("瑪拉");

  expect(() =>
    parseGmOutput({
      player_text: "來點啤酒",
      npc_lines: [{ npc_id: "ash", text: "我是守燈人" }],
      events: [],
      gm_note: "x",
      ui: null,
      needs_image: false,
    }),
  ).toThrow();
});

test("parseGmOutput missing scene fails", () => {
  expect(() =>
    parseGmOutput({
      narration: "燈。",
      npc_lines: [],
      events: [],
      gm_note: "x",
      ui: null,
      needs_image: false,
    }),
  ).toThrow();
});

test("GM JSON schema rejects missing narration", () => {
  expect(() =>
    GmOutputSchema.parse({
      npc_lines: [],
      events: [],
      gm_note: "x",
      ui: null,
      needs_image: false,
    }),
  ).toThrow();
});

test("parseGmOutput strips duplicated NPC lines out of narration", () => {
  const gm = parseGmOutput({
    narration:
      "灰把空碗往前推，低聲說了兩個字：「……也好。」瑪拉轉過身來，說了一句不像送行的話：「那你最好比今天早上的自己強一點。」",
    npc_lines: [
      { npc_id: "ash", text: "……也好。" },
      { npc_id: "bartender", text: "那你最好比今天早上的自己強一點。" },
    ],
    events: [],
    gm_note: "回酒館",
    scene: { scene_id: "tavern", present: ["player", "bartender", "ash"], visible: [] },
    ui: null,
    needs_image: false,
  });
  expect(gm.narration.includes("……也好")).toBe(false);
  expect(gm.narration.includes("那你最好")).toBe(false);
  expect(gm.narration.includes("灰把空碗往前推")).toBe(true);
  expect(gm.npc_lines).toHaveLength(2);
});

test("parseGmOutput missing npc_id is unknown_npc not bartender", () => {
  const gm = parseGmOutput({
    narration: "燈火一顫。",
    npc_lines: [{ text: "坐。" }],
    events: [],
    gm_note: "",
    scene: { scene_id: "tavern", present: ["player", "bartender", "ash"], visible: [] },
    ui: null,
    needs_image: false,
  });
  expect(gm.npc_lines[0]?.npc_id).toBe("unknown_npc");
  expect(gm.gm_note).toBe("本場進行中。");
});

test("parseGmOutput fills npc_lines from spoken events when model left them empty", () => {
  const gm = parseGmOutput({
    narration: "那團霧沉默了很長一段時間。聲音在你腦中響起。",
    npc_lines: [],
    events: [
      {
        actors: ["player"],
        action: "詢問霧狀存在是什麼以及它的名字",
        result: "霧狀存在說出自己的名字，並解釋自己的本質",
        summary: "霧狀存在稱自己為『燼』，是一盞早已熄滅的燈塔的燈靈。",
        entity_ids: ["player"],
      },
    ],
    gm_note: "x",
    scene: {
      scene_id: "old_elm_deep_forest",
      present: ["player"],
      visible: ["old_elm", "buried_lamp", "mist_entity"],
    },
    ui: null,
    needs_image: false,
  });
  expect(gm.npc_lines).toHaveLength(1);
  expect(gm.npc_lines[0]?.npc_id).toBe("mist_entity");
  expect(gm.npc_lines[0]?.text.includes("燼")).toBe(true);
});

test("mock GM + writer persist episode and relation", async () => {
  await mkdir(kbRuntimeDir, { recursive: true });
  await setupDefaultForTest();
  const gm = GmOutputSchema.parse(
    mockGm({
      player_text: "我走向吧台，問老闆今晚有沒有怪人來過",
      gm_note: "start",
      scene: { scene_id: "tavern", present: ["player", "bartender", "ash"], visible: ["bar"] },
      memory_slice: { episodes: [], entities: [], relations: [] },
      turn_id: "t0001",
      timestamp: new Date().toISOString(),
      npc_memories: [],
    }),
  );
  expect(gm.narration.length).toBeGreaterThan(0);
  expect(gm.npc_lines[0]?.npc_id).toBe("bartender");
  const written = await writeFromGm(gm, "t0001", new Date().toISOString(), "tavern");
  expect(written.length).toBe(1);
  const episodes = await loadEpisodes();
  const relations = await loadRelations();
  expect(episodes.length).toBe(1);
  expect(relations.some((r) => r.b === "bartender" || r.a === "bartender")).toBe(true);
  await rm(kbRuntimeDir, { recursive: true, force: true });
});

test("runTurn before setup is 409 needs_setup", async () => {
  await mkdir(kbRuntimeDir, { recursive: true });
  await resetPlaythrough();
  try {
    await runTurn({ player_text: "你好" });
    throw new Error("expected HttpError");
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(409);
    expect((err as HttpError).body.needs_setup).toBe(true);
  }
  await rm(kbRuntimeDir, { recursive: true, force: true });
});

test("Writer persists a newly speaking NPC into runtime entities", async () => {
  await mkdir(kbRuntimeDir, { recursive: true });
  await setupDefaultForTest();
  const gm = parseGmOutput({
    narration: "燈火一顫。",
    npc_lines: [{ npc_id: "lantern_keeper", name: "守燈人", text: "我被封在燈裡。" }],
    events: [
      {
        actors: ["player", "lantern_keeper"],
        action: "confront",
        result: "speaks",
        summary: "失蹤的守燈人現身開口",
        entity_ids: ["lantern_keeper", "player"],
      },
    ],
    gm_note: "守燈人已現身",
    scene: { scene_id: "tavern", present: ["player", "bartender", "ash"], visible: [] },
    ui: null,
    needs_image: false,
  });
  await writeFromGm(gm, "t0009", new Date().toISOString(), "tavern");
  const entities = await loadEntities();
  expect(entities.some((e) => e.id === "lantern_keeper" && e.name === "守燈人")).toBe(true);
  await rm(kbRuntimeDir, { recursive: true, force: true });
});
