import "./test-runtime-env.ts";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { HttpError } from "./errors.ts";
import { buildPlaySystemPrompt } from "./gm-pi.ts";
import { mockGm } from "./gm-mock.ts";
import {
  activateTestWorld,
  commitCustomWorld,
  getNeedsSetup,
  getSeedIds,
  inspectWorld,
  kbRuntimeDir,
  loadEntities,
  loadScene,
  resetPlaythrough,
  saveEntities,
  setupDefaultForTest,
  syncWorldGate,
  wipeWorlds,
} from "./kb.ts";
import {
  EntitySchema,
  parseGeneratedWorld,
  parseGmOutput,
  PrimerSchema,
  type Entity,
  type Primer,
} from "./schema.ts";
import { getSetupStatus, setupCustom, setupDefault } from "./setup.ts";
import { runTurn } from "./turn.ts";
import { mockGeneratedWorld } from "./world-mock.ts";

const PROMPTS_DIR = join(import.meta.dir, "..", "prompts");
const BARTENDER_PERSONA_LINE = "用問題擋問題";
const ASH_PERSONA_LINE = "婉拒組隊";

const LONG_PRIMER: Primer = {
  worldview: "紫晶沙漠裡的鐘樓每小時倒轉一次，沙粒會記住說出口的謊。",
  protagonist: "",
  extras: "",
  starting_point: "玩家在一座沒有門牌的石棧醒來，風裡全是鹽。",
};

async function wipe(): Promise<void> {
  await wipeWorlds();
  await activateTestWorld();
}

test("empty runtime boot does not seed and needs_setup", async () => {
  await wipe();
  const gate = await syncWorldGate();
  expect(gate.needs_setup).toBe(true);
  expect(gate.world).toBeNull();
  expect(await loadScene()).toBeNull();
  const inspect = await inspectWorld();
  expect(inspect.kind).toBe("missing");
});

test("setupDefaultForTest ids equal seed ids", async () => {
  await wipe();
  await setupDefaultForTest();
  const ids = new Set((await loadEntities()).map((e) => e.id));
  const seed = await getSeedIds();
  expect([...ids].sort()).toEqual([...seed].sort());
  const gate = await syncWorldGate();
  expect(gate.needs_setup).toBe(false);
  expect(gate.world?.source).toBe("default");
  expect(gate.world?.save_name).toBe("test");
});

test("entities without world.json do not backfill default", async () => {
  await wipe();
  await setupDefaultForTest();
  await rm(join(kbRuntimeDir, "world.json"), { force: true });
  const gate = await syncWorldGate();
  expect(gate.needs_setup).toBe(true);
  expect(gate.world).toBeNull();
  expect((await inspectWorld()).kind).toBe("missing");
});

test("invalid world.json is needs_setup and not rewritten", async () => {
  await wipe();
  await setupDefaultForTest();
  const bad = '{ "source": "nope", "title": "x" }';
  await writeFile(join(kbRuntimeDir, "world.json"), bad);
  const gate = await syncWorldGate();
  expect(gate.needs_setup).toBe(true);
  expect(await readFile(join(kbRuntimeDir, "world.json"), "utf8")).toBe(bad);
});

test("setup default replaces leftover custom entities", async () => {
  await wipe();
  const primer = PrimerSchema.parse(LONG_PRIMER);
  await commitCustomWorld(primer, mockGeneratedWorld(primer), "t");
  expect((await loadEntities()).some((e) => e.id === "keeper")).toBe(true);
  await resetPlaythrough();
  const { world } = await setupDefault({ template_id: "rust-lamp", save_name: "t" });
  expect(world.source).toBe("default");
  const ids = new Set((await loadEntities()).map((e) => e.id));
  expect(ids.has("keeper")).toBe(false);
  expect(ids.has("bartender")).toBe(true);
});

test("ready setup default returns 409", async () => {
  await wipe();
  await setupDefault({ template_id: "rust-lamp", save_name: "t" });
  try {
    await setupDefault({ template_id: "rust-lamp", save_name: "t" });
    throw new Error("expected HttpError");
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(409);
  }
});

test("custom mock commits harbor and not primer text", async () => {
  await wipe();
  const { world } = await setupCustom({ ...LONG_PRIMER, save_name: "t" });
  expect(world.source).toBe("custom");
  expect(world.save_name).toBe("t");
  const entities = await loadEntities();
  expect(entities.some((e) => e.id === "player")).toBe(true);
  expect(entities.some((e) => e.kind === "npc")).toBe(true);
  expect(entities.some((e) => e.id === "harbor_inn")).toBe(true);
  const blob = JSON.stringify(entities);
  expect(blob.includes(LONG_PRIMER.worldview)).toBe(false);
  expect(blob.includes(LONG_PRIMER.starting_point)).toBe(false);
  const gate = await syncWorldGate();
  expect(gate.needs_setup).toBe(false);
  expect(getSetupStatus()).toBe("idle");
});

test("bad generated JSON does not write world", async () => {
  await wipe();
  const primer = PrimerSchema.parse(LONG_PRIMER);
  const leak: Entity[] = [
    {
      id: "player",
      name: "旅人",
      kind: "player",
      summary: LONG_PRIMER.worldview,
    },
    {
      id: "keeper",
      name: "掌櫃",
      kind: "npc",
      summary: "櫃檯",
    },
    {
      id: "harbor_inn",
      name: "客棧",
      kind: "place",
      summary: "木樓",
    },
  ];
  expect(() =>
    parseGeneratedWorld(
      {
        title: "霧港",
        gm_note: "進行中",
        gm_canon: "canon",
        entities: leak,
        scene: { scene_id: "harbor_inn", present: ["player", "keeper"], visible: [] },
        relations: [],
      },
      primer,
    ),
  ).toThrow();
  expect((await inspectWorld()).kind).toBe("missing");
});

test("gm-contract has no tavern proper nouns", async () => {
  const contract = await readFile(new URL("../prompts/gm-contract.md", import.meta.url), "utf8");
  for (const word of ["鏽燈", "瑪拉", "灰", "紙條", "燈手", "酒館 POC"]) {
    expect(contract.includes(word)).toBe(false);
  }
});

test("default play prompt uses runtime persona not only tavern names", async () => {
  await wipe();
  await setupDefaultForTest();
  const def = await buildPlaySystemPrompt();
  expect(def.includes(BARTENDER_PERSONA_LINE)).toBe(true);
  expect(def.includes(ASH_PERSONA_LINE)).toBe(true);
  expect(def.includes("npc_lines")).toBe(true);
  expect(existsSync(join(PROMPTS_DIR, "npc-bartender.md"))).toBe(false);
  expect(existsSync(join(PROMPTS_DIR, "npc-ash.md"))).toBe(false);

  await resetPlaythrough();
  await setupCustom({ ...LONG_PRIMER, save_name: "t" });
  const custom = await buildPlaySystemPrompt();
  expect(custom.includes("瑪拉")).toBe(false);
  expect(custom.includes("harbor_inn") || custom.includes("霧港")).toBe(true);
  expect(custom.includes("地下診所不接官方單")).toBe(false);
  expect(custom.includes("封門符還熱著")).toBe(false);
  expect(custom.includes("市區禁止釋放")).toBe(false);
  expect(custom.includes("今晚不要出門")).toBe(false);
});

test("custom mock turn is not tavern cast", async () => {
  await wipe();
  await setupCustom({ ...LONG_PRIMER, save_name: "t" });
  const result = await runTurn({ player_text: "我向櫃檯點一碗湯" });
  const text = `${result.gm.narration}${result.gm.npc_lines.map((l) => l.text).join("")}${result.gm.gm_note}`;
  expect(text.includes("瑪拉")).toBe(false);
  expect(text.includes("蠟封")).toBe(false);
  expect(result.gm.npc_lines.some((l) => l.npc_id === "bartender")).toBe(false);
  expect(result.gm.npc_lines.some((l) => l.npc_id === "keeper")).toBe(true);
});

test("mockGm custom branch ignores tavern plot", () => {
  const gm = parseGmOutput(
    mockGm(
      {
        player_text: "問怪人",
        gm_note: "start",
        scene: { scene_id: "harbor_inn", present: ["player", "keeper"], visible: ["counter"] },
        memory_slice: {
          episodes: [],
          entities: [{ id: "keeper", name: "潮掌櫃", summary: "掌櫃" }],
          relations: [],
        },
        turn_id: "t0001",
        timestamp: new Date().toISOString(),
        npc_memories: [],
      },
      { source: "custom", title: "霧港", created_at: "2026-01-01T00:00:00.000Z" },
    ),
    { fillKnownNpcNames: false },
  );
  expect(gm.npc_lines[0]?.npc_id).toBe("keeper");
  expect(gm.narration.includes("瑪拉")).toBe(false);
});

test("primer too long is 400", async () => {
  await wipe();
  try {
    await setupCustom({
      save_name: "t",
      worldview: "字".repeat(4001),
      starting_point: "起始地點必須夠長才算數。",
    });
    throw new Error("expected HttpError");
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(400);
  }
});

test("entity persona empty is omitted; overlong fails; leak includes persona", () => {
  expect(EntitySchema.parse({ id: "x", name: "X", kind: "npc", summary: "s", persona: "  " }).persona).toBeUndefined();
  expect(() =>
    EntitySchema.parse({ id: "x", name: "X", kind: "npc", summary: "s", persona: "a".repeat(2001) }),
  ).toThrow();
  const primer = PrimerSchema.parse(LONG_PRIMER);
  expect(() =>
    parseGeneratedWorld(
      {
        title: "霧港",
        gm_note: "進行中",
        gm_canon: "canon",
        entities: [
          { id: "player", name: "旅人", kind: "player", summary: "旅客" },
          {
            id: "keeper",
            name: "掌櫃",
            kind: "npc",
            summary: "櫃檯",
            persona: LONG_PRIMER.worldview,
          },
          { id: "harbor_inn", name: "客棧", kind: "place", summary: "木樓" },
        ],
        scene: { scene_id: "harbor_inn", present: ["player", "keeper"], visible: [] },
        relations: [],
      },
      primer,
    ),
  ).toThrow();
});

test("harbor fixture without persona still parses", () => {
  const primer = PrimerSchema.parse(LONG_PRIMER);
  const generated = mockGeneratedWorld(primer);
  expect(generated.entities.every((e) => e.persona === undefined)).toBe(true);
  expect(parseGeneratedWorld(generated, primer).title).toBe("霧港");
});

test("runtime persona override is used; seed persona is not re-read", async () => {
  await wipe();
  await setupDefaultForTest();
  const entities = await loadEntities();
  const bartender = entities.find((e) => e.id === "bartender");
  expect(bartender?.persona).toBeDefined();
  bartender!.persona = "RUNTIME_PERSONA_OVERRIDE_SENTENCE";
  await saveEntities(entities);
  const prompt = await buildPlaySystemPrompt();
  expect(prompt.includes("RUNTIME_PERSONA_OVERRIDE_SENTENCE")).toBe(true);
  expect(prompt.includes(BARTENDER_PERSONA_LINE)).toBe(false);
});

test("custom commit writes gm_canon.md not runtime prompts/gm.md", async () => {
  await wipe();
  const primer = PrimerSchema.parse(LONG_PRIMER);
  await commitCustomWorld(primer, mockGeneratedWorld(primer), "t");
  expect(existsSync(join(kbRuntimeDir, "gm_canon.md"))).toBe(true);
  expect(existsSync(join(kbRuntimeDir, "prompts", "gm.md"))).toBe(false);
  const gate = await syncWorldGate();
  expect(gate.needs_setup).toBe(false);
});

test("custom world without gm_canon.md is needs_setup even if old prompts/gm.md exists", async () => {
  await wipe();
  await writeFile(
    join(kbRuntimeDir, "world.json"),
    JSON.stringify({ source: "custom", title: "霧港", created_at: "2026-01-01T00:00:00.000Z" }),
  );
  expect(await getNeedsSetup()).toBe(true);
  expect((await syncWorldGate()).world).toBeNull();
  await mkdir(join(kbRuntimeDir, "prompts"), { recursive: true });
  await writeFile(join(kbRuntimeDir, "prompts", "gm.md"), "OLD_RUNTIME_GM_MD_MUST_NOT_BE_READ");
  expect(await getNeedsSetup()).toBe(true);
  expect((await syncWorldGate()).world).toBeNull();
  try {
    await buildPlaySystemPrompt();
    throw new Error("expected HttpError");
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(409);
  }
});

test("clearPlaythrough removes gm_canon.md and leftover prompts dir", async () => {
  await wipe();
  const primer = PrimerSchema.parse(LONG_PRIMER);
  await commitCustomWorld(primer, mockGeneratedWorld(primer), "t");
  await mkdir(join(kbRuntimeDir, "prompts"), { recursive: true });
  await writeFile(join(kbRuntimeDir, "prompts", "gm.md"), "stale");
  await resetPlaythrough();
  expect(existsSync(join(kbRuntimeDir, "gm_canon.md"))).toBe(false);
  expect(existsSync(join(kbRuntimeDir, "prompts"))).toBe(false);
});

test("custom missing canon allows setup (not already ready)", async () => {
  await wipe();
  await writeFile(
    join(kbRuntimeDir, "world.json"),
    JSON.stringify({ source: "custom", title: "霧港", created_at: "2026-01-01T00:00:00.000Z" }),
  );
  const { world } = await setupDefault({ template_id: "rust-lamp", save_name: "t" });
  expect(world.source).toBe("default");
});

test("setup and turn do not write repo prompts", async () => {
  const before = new Set(await readdir(PROMPTS_DIR));
  await wipe();
  await setupDefault({ template_id: "rust-lamp", save_name: "t" });
  await runTurn({ player_text: "你好" });
  await resetPlaythrough();
  await setupCustom({ ...LONG_PRIMER, save_name: "t" });
  await runTurn({ player_text: "我向櫃檯點一碗湯" });
  const after = new Set(await readdir(PROMPTS_DIR));
  expect([...after].sort()).toEqual([...before].sort());
  expect([...after].some((n) => n.startsWith("npc-") && n.endsWith(".md"))).toBe(false);
});
