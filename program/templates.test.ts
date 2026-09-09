import "./test-runtime-env.ts";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { HttpError } from "./errors.ts";
import { buildPlaySystemPrompt } from "./gm-pi.ts";
import { mockGm } from "./gm-mock.ts";
import {
  kbRuntimeDir,
  kbSeedDir,
  loadDefaultGmCanon,
  loadEntities,
  loadGmNote,
  loadScene,
  loadSeedEntities,
  setupDefaultForTest,
  syncWorldGate,
  wipeWorlds,
} from "./kb.ts";
import { WorldSchema } from "./schema.ts";
import { listTemplates, loadWorld, requestHome, setupCustom, setupDefault } from "./setup.ts";
import { runTurn } from "./turn.ts";
import { MIST_RITE_BAN, TEMPLATE_CATALOG, TEMPLATE_IDS, type TemplateId } from "./templates.ts";

const ROOT = join(import.meta.dir, "..");
const SENTINEL: Record<TemplateId, string> = {
  "rust-lamp": "北路燈手三日未歸",
  cyberpunk: "地下診所不接官方單",
  "sword-dungeon": "封門符還熱著",
  "esper-city": "市區禁止釋放",
  "mist-rite": "今晚不要出門",
};

const TAVERN_BAN = ["瑪拉", "bartender", "ash", "tavern"];

async function wipe(): Promise<void> {
  await wipeWorlds();
}

test("repo has no flat kb/seed json", async () => {
  const names = await readdir(kbSeedDir);
  expect(names.some((n) => n.endsWith(".json"))).toBe(false);
  expect(existsSync(join(ROOT, "prompts", "gm-default.md"))).toBe(false);
  for (const id of TEMPLATE_IDS) {
    expect(existsSync(join(kbSeedDir, id))).toBe(true);
    expect(existsSync(join(ROOT, "prompts", "gm-default", `${id}.md`))).toBe(true);
  }
});

test("missing seed dir and missing canon are 500", async () => {
  try {
    await loadSeedEntities("nope" as TemplateId);
    throw new Error("expected HttpError");
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(500);
    expect((err as HttpError).body.error).toBe("missing_seed");
  }
  try {
    await loadDefaultGmCanon("nope" as TemplateId);
    throw new Error("expected HttpError");
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(500);
    expect((err as HttpError).body.error).toBe("missing_canon");
  }
});

test("listTemplates still works after playing setup", async () => {
  await wipe();
  await setupDefaultForTest("t", "esper-city");
  expect((await syncWorldGate()).needs_setup).toBe(false);
  expect(listTemplates().templates).toHaveLength(5);
});

test("GET templates catalog matches HOW order", () => {
  const { templates } = listTemplates();
  expect(templates.map((t) => t.id)).toEqual([...TEMPLATE_IDS]);
  expect(templates.map((t) => t.display_name)).toEqual(TEMPLATE_CATALOG.map((t) => t.display_name));
  expect(templates.map((t) => t.blurb)).toEqual(TEMPLATE_CATALOG.map((t) => t.blurb));
});

test("setupDefault missing and invalid template_id are 400", async () => {
  await wipe();
  try {
    await setupDefault({ save_name: "t" });
    throw new Error("expected HttpError");
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(400);
    expect((err as HttpError).body.error).toBe("missing_template_id");
  }
  try {
    await setupDefault({ save_name: "t", template_id: "" });
    throw new Error("expected HttpError");
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).body.error).toBe("missing_template_id");
  }
  try {
    await setupDefault({ save_name: "t", template_id: "not-a-template" });
    throw new Error("expected HttpError");
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(400);
    expect((err as HttpError).body.error).toBe("invalid_template");
  }
});

test("setupDefaultForTest no second arg is rust-lamp", async () => {
  await wipe();
  const world = await setupDefaultForTest();
  expect(world.template_id).toBe("rust-lamp");
  expect(world.save_name).toBe("test");
  const scene = await loadScene();
  expect(scene?.scene_id).toBe("tavern");
  expect((await loadEntities()).some((e) => e.id === "bartender")).toBe(true);
});

test("setupDefaultForTest first arg still save name tavern", async () => {
  await wipe();
  const world = await setupDefaultForTest("overreach");
  expect(world.save_name).toBe("overreach");
  expect(world.template_id).toBe("rust-lamp");
});

test("each default template commit and mock beat stay in-cast", async () => {
  for (const id of TEMPLATE_IDS) {
    await wipe();
    await setupDefaultForTest("t", id);
    const world = (await syncWorldGate()).world;
    expect(world?.template_id).toBe(id);
    const entities = await loadEntities();
    const ids = new Set(entities.map((e) => e.id));
    const npcs = entities.filter((e) => e.kind === "npc");
    expect(npcs.length).toBeGreaterThanOrEqual(1);
    expect(npcs.length).toBeLessThanOrEqual(3);
    expect(npcs.some((e) => e.memory_tier === 2)).toBe(true);
    const scene = await loadScene();
    const place = entities.find((e) => e.kind === "place");
    expect(scene?.scene_id).toBe(place?.id);
    if (id !== "rust-lamp") {
      expect(ids.has("bartender")).toBe(false);
      expect(ids.has("ash")).toBe(false);
      expect(ids.has("tavern")).toBe(false);
      const blob = `${await loadGmNote()}${JSON.stringify(entities)}${JSON.stringify(scene)}`;
      for (const ban of TAVERN_BAN) {
        expect(blob.includes(ban)).toBe(false);
      }
    }
    const prompt = await buildPlaySystemPrompt();
    expect(prompt.includes(SENTINEL[id])).toBe(true);
    for (const other of TEMPLATE_IDS) {
      if (other === id) continue;
      expect(prompt.includes(SENTINEL[other])).toBe(false);
    }
    const result = await runTurn({ player_text: "我環顧四周。" });
    expect(result.gm.scene.scene_id).toBe(place!.id);
    for (const line of result.gm.npc_lines) {
      expect(ids.has(line.npc_id) || line.npc_id === "player").toBe(true);
      if (id !== "rust-lamp") {
        expect(line.npc_id).not.toBe("bartender");
        expect(line.npc_id).not.toBe("ash");
      }
    }
    const packed = `${result.gm.narration}${result.gm.npc_lines.map((l) => l.text).join("")}${result.gm.gm_note}`;
    if (id !== "rust-lamp") {
      expect(packed.includes("瑪拉")).toBe(false);
      expect(packed.includes("鏽燈酒館")).toBe(false);
    }
    const l2 = npcs.filter((e) => e.memory_tier === 2);
    for (const npc of l2) {
      expect(existsSync(join(kbRuntimeDir, "npc-memory", "l2", npc.id, "current.json"))).toBe(true);
      expect(existsSync(join(kbRuntimeDir, "npc-memory", "l2", npc.id, "psyche.json"))).toBe(true);
    }
  }
});

test("esper-city entities have no bartender", async () => {
  await wipe();
  await setupDefault({ save_name: "t", template_id: "esper-city" });
  const ids = (await loadEntities()).map((e) => e.id);
  expect(ids.includes("bartender")).toBe(false);
});

test("mist-rite files have no banned original names", async () => {
  const dir = join(kbSeedDir, "mist-rite");
  const files = await readdir(dir);
  let blob = await readFile(join(ROOT, "prompts", "gm-default", "mist-rite.md"), "utf8");
  for (const f of files) {
    blob += await readFile(join(dir, f), "utf8");
  }
  const lower = blob.toLowerCase();
  for (const ban of MIST_RITE_BAN) {
    expect(lower.includes(ban.toLowerCase())).toBe(false);
  }
});

test("legacy default world missing template_id is rust-lamp", async () => {
  await wipe();
  await setupDefaultForTest();
  const raw = JSON.parse(await readFile(join(kbRuntimeDir, "world.json"), "utf8")) as Record<string, unknown>;
  delete raw.template_id;
  await writeFile(join(kbRuntimeDir, "world.json"), JSON.stringify(raw, null, 2));
  const parsed = WorldSchema.parse(JSON.parse(await readFile(join(kbRuntimeDir, "world.json"), "utf8")));
  expect(parsed.template_id).toBe("rust-lamp");
  const gate = await syncWorldGate();
  expect(gate.needs_setup).toBe(false);
  expect(gate.world?.template_id).toBe("rust-lamp");
  const onDisk = JSON.parse(await readFile(join(kbRuntimeDir, "world.json"), "utf8")) as { template_id?: string };
  expect(onDisk.template_id).toBe("rust-lamp");
});

test("illegal on-disk template_id fails load with 500", async () => {
  await wipe();
  const world = await setupDefaultForTest();
  const id = world.id;
  const raw = JSON.parse(await readFile(join(kbRuntimeDir, "world.json"), "utf8")) as Record<string, unknown>;
  raw.template_id = "not-real";
  await writeFile(join(kbRuntimeDir, "world.json"), JSON.stringify(raw, null, 2));
  await requestHome();
  try {
    await loadWorld({ id });
    throw new Error("expected HttpError");
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(500);
    expect((err as HttpError).body.error).toBe("invalid_template");
  }
});

test("custom setup ignores template_id and does not read gm-default", async () => {
  await wipe();
  const { world } = await setupCustom({
    save_name: "t",
    template_id: "cyberpunk",
    worldview: "紫晶沙漠裡的鐘樓每小時倒轉一次，沙粒會記住說出口的謊。",
    protagonist: "",
    extras: "",
    starting_point: "玩家在一座沒有門牌的石棧醒來，風裡全是鹽。",
  });
  expect(world.source).toBe("custom");
  expect(world.template_id).toBeUndefined();
  const prompt = await buildPlaySystemPrompt();
  expect(prompt.includes("地下診所不接官方單")).toBe(false);
  expect(prompt.includes("北路燈手三日未歸")).toBe(false);
});

test("mockGm non rust-lamp never uses tavern cast", () => {
  const gm = mockGm(
    {
      player_text: "問怪人",
      gm_note: "start",
      scene: {
        scene_id: "rain_clinic",
        present: ["player", "clinic_doc", "night_fixer"],
        visible: [],
      },
      memory_slice: {
        episodes: [],
        entities: [{ id: "clinic_doc", name: "衛澄", summary: "醫" }],
        relations: [],
      },
      turn_id: "t0001",
      timestamp: new Date().toISOString(),
      npc_memories: [],
    },
    {
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      source: "default",
      save_name: "t",
      created_at: "2026-01-01T00:00:00.000Z",
      template_id: "cyberpunk",
    },
  );
  expect(gm.npc_lines.some((l) => l.npc_id === "bartender")).toBe(false);
  expect(gm.narration.includes("瑪拉")).toBe(false);
  expect(gm.scene.scene_id).toBe("rain_clinic");
});
