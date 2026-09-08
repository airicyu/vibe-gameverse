import "./test-runtime-env.ts";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "bun:test";
import {
  debugRunCompact,
  findLiveJsonl,
  forceCompactNeeded,
  formatOpeningMessage,
  maybeCompactAfterTurn,
  parseJsonlChat,
  presentChanged,
  recentDialoguePairs,
  setCompactTestHooks,
} from "./compact.ts";
import { getAppConfig, resetAppConfigCache } from "./config.ts";
import {
  INITIAL_SCENE,
  kbRuntimeDir,
  loadCompactState,
  loadDirtySet,
  loadL2Current,
  loadScene,
  migratePlaySessionDir,
  playSessionsDir,
  resetPlaythrough,
  saveCompactState,
  saveL2Current,
  sessionArchiveDir,
  setupDefaultForTest,
} from "./kb.ts";
import { gatherRecallSnippets } from "./recall.ts";
import type { GmOutput } from "./schema.ts";
import { runTurn } from "./turn.ts";
import { writeFromGm } from "./writer.ts";

async function wipe(): Promise<void> {
  await rm(kbRuntimeDir, { recursive: true, force: true });
  await mkdir(kbRuntimeDir, { recursive: true });
  setCompactTestHooks(null);
}

function talk(gmNote = "進行中"): GmOutput {
  return {
    narration: "吧台燈芯一跳。",
    npc_lines: [{ npc_id: "bartender", name: "瑪拉", text: "這件事今晚不能讓第三個人聽見。" }],
    events: [
      {
        actors: ["player", "bartender"],
        action: "confide",
        result: "shared",
        summary: "瑪拉把北路的事壓低了聲",
        entity_ids: ["bartender", "player"],
      },
    ],
    gm_note: gmNote,
    scene: INITIAL_SCENE,
    ui: null,
    needs_image: false,
  };
}

function jsonlFixture(): string {
  return [
    JSON.stringify({
      type: "message",
      message: { role: "user", content: "第一回：你好" },
    }),
    JSON.stringify({
      type: "message",
      message: {
        role: "assistant",
        content: [{ type: "text", text: '{"narration":"a"}' }],
        usage: { input: 10, output: 2, totalTokens: 12 },
      },
    }),
    JSON.stringify({
      type: "message",
      message: { role: "user", content: "第二回：酒" },
    }),
    JSON.stringify({
      type: "message",
      message: {
        role: "assistant",
        content: [{ type: "text", text: '{"narration":"b"}' }],
        usage: { input: 20, output: 2, totalTokens: 22 },
      },
    }),
    JSON.stringify({
      type: "message",
      message: { role: "user", content: "第三回：角落" },
    }),
    JSON.stringify({
      type: "message",
      message: {
        role: "assistant",
        content: [{ type: "text", text: '{"narration":"c"}' }],
        usage: { input: 30, output: 2, totalTokens: 32 },
      },
    }),
  ].join("\n");
}

function forceJsonlFixture(): string {
  return [
    JSON.stringify({ type: "message", message: { role: "user", content: "hi" } }),
    JSON.stringify({
      type: "message",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "{}" }],
        usage: { input: 100000, output: 2, totalTokens: 100002 },
      },
    }),
  ].join("\n");
}

async function seedLiveJsonl(text = jsonlFixture()): Promise<string> {
  await mkdir(playSessionsDir, { recursive: true });
  const path = join(playSessionsDir, "live.jsonl");
  await writeFile(path, text);
  return path;
}

test("config loads isolation yaml", () => {
  resetAppConfigCache();
  const cfg = getAppConfig();
  expect(cfg.compact.max_turns_without_compact).toBe(20);
  expect(cfg.compact.recent_turns_to_keep).toBe(3);
  expect(cfg.debug).toBe(false);
});

test("missing config.yaml fails subprocess start", async () => {
  const proc = Bun.spawn(["bun", "-e", "import { loadAppConfigFromDisk } from './program/config.ts'; loadAppConfigFromDisk();"], {
    cwd: join(import.meta.dir, ".."),
    env: { ...process.env, VIBE_GAMEVERSE_CONFIG: join(kbRuntimeDir, "no-such-config.yaml") },
    stderr: "pipe",
    stdout: "pipe",
  });
  const code = await proc.exited;
  expect(code).not.toBe(0);
});

test("rename pi-sessions to play-sessions; both dirs keep play-sessions", async () => {
  await wipe();
  const oldDir = join(kbRuntimeDir, "pi-sessions");
  await mkdir(oldDir, { recursive: true });
  await writeFile(join(oldDir, "a.jsonl"), "{}\n");
  await migratePlaySessionDir();
  expect(existsSync(playSessionsDir)).toBe(true);
  expect(existsSync(join(playSessionsDir, "a.jsonl"))).toBe(true);
  expect(existsSync(oldDir)).toBe(false);

  await mkdir(oldDir, { recursive: true });
  await writeFile(join(oldDir, "old-only.jsonl"), "x");
  await writeFile(join(playSessionsDir, "new.jsonl"), "y");
  await migratePlaySessionDir();
  expect(existsSync(join(playSessionsDir, "new.jsonl"))).toBe(true);
  expect(existsSync(join(oldDir, "old-only.jsonl"))).toBe(true);
});

test("new game removes play-sessions and session-archive", async () => {
  await wipe();
  await setupDefaultForTest();
  await mkdir(playSessionsDir, { recursive: true });
  await mkdir(sessionArchiveDir, { recursive: true });
  await writeFile(join(playSessionsDir, "x.jsonl"), "x");
  await writeFile(join(sessionArchiveDir, "index.json"), "{\"entries\":[]}");
  await resetPlaythrough();
  expect(existsSync(playSessionsDir)).toBe(false);
  expect(existsSync(sessionArchiveDir)).toBe(false);
  expect(existsSync(join(kbRuntimeDir, "compact-state.json"))).toBe(false);
});

test("Writer does not clip L2 current at 800; near_cap at 640 does not compact", async () => {
  await wipe();
  await setupDefaultForTest();
  const long = "記".repeat(850);
  await saveL2Current({ npc_id: "bartender", body: long, updated_turn: 1 });
  await writeFromGm(talk(), "t0002", new Date().toISOString(), "tavern");
  const body = (await loadL2Current("bartender"))?.body ?? "";
  expect(body.length).toBeGreaterThan(800);
  const dirty = await loadDirtySet();
  expect(dirty.near_cap.includes("bartender")).toBe(true);
  expect(existsSync(join(sessionArchiveDir, "sa_001"))).toBe(false);
});

test("warehouse config.yaml default N is 8", async () => {
  const text = await readFile(join(import.meta.dir, "..", "config.yaml"), "utf8");
  expect(text.includes("max_turns_without_compact: 8")).toBe(true);
});

test("present unchanged and under N does not compact; gm_note only does not session", async () => {
  await wipe();
  await setupDefaultForTest();
  await seedLiveJsonl();
  await maybeCompactAfterTurn({
    turnId: "t0003",
    gm: talk("全新 gm_note 字串"),
    sceneBefore: INITIAL_SCENE,
    mock: true,
  });
  expect(existsSync(join(sessionArchiveDir, "sa_001"))).toBe(false);
});

test("present delta does not session compact", async () => {
  await wipe();
  await setupDefaultForTest();
  await saveCompactState({ anchor_turn_n: 0 });
  const gm = { ...talk(), scene: { ...INITIAL_SCENE, present: ["player", "bartender"] } };
  await maybeCompactAfterTurn({ turnId: "t0004", gm, sceneBefore: INITIAL_SCENE, mock: true });
  expect((await loadCompactState()).anchor_turn_n).toBe(0);
  expect(existsSync(join(sessionArchiveDir, "sa_001"))).toBe(false);
});

test("N due without inject hooks does not compact and does not move anchor", async () => {
  await wipe();
  await setupDefaultForTest();
  await saveCompactState({ anchor_turn_n: 0 });
  await maybeCompactAfterTurn({ turnId: "t0020", gm: talk(), sceneBefore: INITIAL_SCENE, mock: true });
  expect((await loadCompactState()).anchor_turn_n).toBe(0);
  expect(existsSync(join(sessionArchiveDir, "sa_001"))).toBe(false);
});

test("injected compact archives jsonl, writes L2 archive, shortens current, sets since", async () => {
  await wipe();
  await setupDefaultForTest();
  await writeFromGm(talk(), "t0005", new Date().toISOString(), "tavern");
  await saveL2Current({ npc_id: "bartender", body: "記".repeat(640), updated_turn: 5 });
  await seedLiveJsonl();
  setCompactTestHooks({
    summary: () => ({ title: "廣場爭論結束", body: "虛構的酒館段落已結束。" }),
    npcArchive: () => ({
      title: "瑪拉本段",
      summary: "吧台把北路壓低了聲。",
      salient_quotes: [{ turn_id: "t0005", speaker: "bartender", text: "今晚不能讓第三人聽見。" }],
      distilled_body: "剛封過一幕。北路不當眾說。",
    }),
  });
  const gm = talk();
  const result = await maybeCompactAfterTurn({ turnId: "t0020", gm, sceneBefore: INITIAL_SCENE, mock: true });
  expect(result.compacted).toBe(true);
  expect(existsSync(join(sessionArchiveDir, "sa_001", "session.jsonl"))).toBe(true);
  expect(existsSync(join(sessionArchiveDir, "sa_001", "summary.json"))).toBe(true);
  expect(existsSync(join(playSessionsDir, "live.jsonl"))).toBe(false);
  const summary = JSON.parse(await readFile(join(sessionArchiveDir, "sa_001", "summary.json"), "utf8"));
  expect(summary.truncated).toBe(false);
  expect(summary.title).toBe("廣場爭論結束");
  expect(existsSync(join(kbRuntimeDir, "npc-memory", "l2", "bartender", "archive", "na_bartender_001.json"))).toBe(true);
  expect(((await loadL2Current("bartender"))?.body.length ?? 99)).toBeLessThan(640);
  expect((await loadDirtySet()).since_session_archive).toBe("sa_001");
});

test("npc archive extra salient_quotes are capped not fail-closed", async () => {
  await wipe();
  await setupDefaultForTest();
  await writeFromGm(talk(), "t0005", new Date().toISOString(), "tavern");
  await saveL2Current({ npc_id: "bartender", body: "記".repeat(640), updated_turn: 5 });
  await seedLiveJsonl();
  setCompactTestHooks({
    summary: () => ({ title: "出門", body: "離開酒館上北路。" }),
    npcArchive: (npcId) => ({
      title: `${npcId} 本段`,
      summary: "本段知情。",
      salient_quotes: [
        { turn_id: "t0001", speaker: npcId, text: "一" },
        { turn_id: "t0002", speaker: npcId, text: "二" },
        { turn_id: "t0003", speaker: npcId, text: "三" },
        { turn_id: "t0004", speaker: npcId, text: "四不該留下" },
      ],
      distilled_body: "短記憶。",
    }),
  });
  const result = await maybeCompactAfterTurn({ turnId: "t0020", gm: talk(), sceneBefore: INITIAL_SCENE, mock: true });
  expect(result.compacted).toBe(true);
  const entry = JSON.parse(
    await readFile(join(kbRuntimeDir, "npc-memory", "l2", "bartender", "archive", "na_bartender_001.json"), "utf8"),
  );
  expect(entry.salient_quotes).toHaveLength(3);
  expect(entry.salient_quotes.map((q: { text: string }) => q.text)).not.toContain("四不該留下");
});

test("debugRunCompact skips judge and archives", async () => {
  await wipe();
  await setupDefaultForTest();
  await writeFromGm(talk(), "t0005", new Date().toISOString(), "tavern");
  await seedLiveJsonl();
  setCompactTestHooks({
    summary: () => ({ title: "debug compact", body: "除錯強制封存本段。" }),
    npcArchive: () => ({
      title: "瑪拉本段",
      summary: "除錯封存。",
      salient_quotes: [],
      distilled_body: "短。",
    }),
  });
  const result = await debugRunCompact();
  expect(result.compacted).toBe(true);
  expect(result.archiveId).toBe("sa_001");
  expect(existsSync(join(sessionArchiveDir, "sa_001", "summary.json"))).toBe(true);
});

test("fail after apply restores jsonl and keeps prior npc archive files", async () => {
  await wipe();
  await setupDefaultForTest();
  await writeFromGm(talk(), "t0005", new Date().toISOString(), "tavern");
  await seedLiveJsonl();
  const prior = join(kbRuntimeDir, "npc-memory", "l2", "bartender", "archive");
  await mkdir(prior, { recursive: true });
  await writeFile(
    join(prior, "na_bartender_001.json"),
    JSON.stringify({
      npc_archive_id: "na_bartender_001",
      npc_id: "bartender",
      turn_from: "t0001",
      turn_to: "t0004",
      title: "舊幕",
      summary: "先前已封成功的主觀檔。",
      salient_quotes: [],
    }),
  );
  await writeFile(
    join(prior, "index.json"),
    JSON.stringify({
      npc_id: "bartender",
      entries: [
        {
          npc_archive_id: "na_bartender_001",
          turn_from: "t0001",
          turn_to: "t0004",
          title: "舊幕",
          body_chars: 10,
          quote_count: 0,
        },
      ],
    }),
  );
  setCompactTestHooks({
    summary: () => ({ title: "t", body: "摘要正文。" }),
    npcArchive: () => ({
      title: "新",
      summary: "新摘要",
      salient_quotes: [],
      distilled_body: "短",
    }),
    failAfterApply: () => {
      throw new Error("apply inject");
    },
  });
  const live = join(playSessionsDir, "live.jsonl");
  const result = await maybeCompactAfterTurn({ turnId: "t0020", gm: talk(), sceneBefore: INITIAL_SCENE, mock: true });
  expect(result.compacted).toBe(false);
  expect(existsSync(live)).toBe(true);
  expect(existsSync(join(prior, "na_bartender_001.json"))).toBe(true);
  expect(existsSync(join(prior, "na_bartender_002.json"))).toBe(false);
});

test("fail after scratch leaves live jsonl and no half archive", async () => {
  await wipe();
  await setupDefaultForTest();
  await writeFromGm(talk(), "t0006", new Date().toISOString(), "tavern");
  const live = await seedLiveJsonl();
  setCompactTestHooks({
    summary: () => ({ title: "t", body: "摘要正文。" }),
    npcArchive: () => ({
      title: "n",
      summary: "s",
      salient_quotes: [],
      distilled_body: "短",
    }),
    failAfterScratch: () => {
      throw new Error("inject");
    },
  });
  const result = await maybeCompactAfterTurn({ turnId: "t0020", gm: talk(), sceneBefore: INITIAL_SCENE, mock: true });
  expect(result.compacted).toBe(false);
  expect(existsSync(live)).toBe(true);
  expect(existsSync(join(sessionArchiveDir, "sa_001"))).toBe(false);
  expect(existsSync(join(kbRuntimeDir, "npc-memory", "l2", "bartender", "archive"))).toBe(false);
  expect((await loadCompactState()).anchor_turn_n).toBe(0);
});

test("force line skips judge veto and marks truncated", async () => {
  await wipe();
  await setupDefaultForTest();
  await writeFromGm(talk(), "t0007", new Date().toISOString(), "tavern");
  await seedLiveJsonl(forceJsonlFixture());
  setCompactTestHooks({
    summary: () => ({ title: "普通", body: "普通摘要。" }),
    npcArchive: () => ({
      title: "n",
      summary: "s",
      salient_quotes: [],
      distilled_body: "短記憶",
    }),
  });
  expect(await forceCompactNeeded(await findLiveJsonl())).toBe(true);
  const result = await maybeCompactAfterTurn({ turnId: "t0007", gm: talk(), sceneBefore: INITIAL_SCENE, mock: true });
  expect(result.compacted).toBe(true);
  const summary = JSON.parse(await readFile(join(sessionArchiveDir, "sa_001", "summary.json"), "utf8"));
  expect(summary.truncated).toBe(true);
  expect(String(summary.title).includes("非自然")).toBe(true);
});

test("opening formatter includes tail pairs; missing pairs still compact", () => {
  const msg = formatOpeningMessage({
    archiveId: "sa_001",
    summary: {
      archive_id: "sa_001",
      turn_from: "t0001",
      turn_to: "t0003",
      title: "t",
      body: "摘要。",
      truncated: false,
    },
    gmNote: "note",
    scene: INITIAL_SCENE,
    l2Currents: [{ npc_id: "bartender", body: "短" }],
    pairs: recentDialoguePairs(parseJsonlChat(jsonlFixture()), 3),
  });
  expect(msg.includes("sa_001")).toBe(true);
  expect(msg.includes("第三回")).toBe(true);
  const empty = formatOpeningMessage({
    archiveId: "sa_002",
    summary: {
      archive_id: "sa_002",
      turn_from: "t0001",
      turn_to: "t0001",
      title: "t",
      body: "摘要。",
      truncated: true,
    },
    gmNote: "n",
    scene: INITIAL_SCENE,
    l2Currents: [],
    pairs: [],
  });
  expect(empty.includes("Recent dialogue")).toBe(false);
});

test("recall idle has no excerpts; past hint opens at most two", async () => {
  await wipe();
  await setupDefaultForTest();
  await mkdir(join(sessionArchiveDir, "sa_001"), { recursive: true });
  await writeFile(
    join(sessionArchiveDir, "index.json"),
    JSON.stringify({
      entries: [{ archive_id: "sa_001", turn_from: "t0001", turn_to: "t0005", title: "廣場爭論結束", truncated: false }],
    }),
  );
  await writeFile(
    join(sessionArchiveDir, "sa_001", "summary.json"),
    JSON.stringify({
      archive_id: "sa_001",
      turn_from: "t0001",
      turn_to: "t0005",
      title: "廣場爭論結束",
      body: "虛構廣場上有過爭論。",
      truncated: false,
    }),
  );
  await writeFile(
    join(sessionArchiveDir, "sa_001", "session.jsonl"),
    JSON.stringify({ type: "message", message: { role: "user", content: "記得嗎廣場那時" } }) +
      "\n" +
      JSON.stringify({ type: "message", message: { role: "assistant", content: [{ type: "text", text: "那時燈還亮著。" }] } }),
  );
  const idle = await gatherRecallSnippets({
    playerText: "再來一杯",
    scene: INITIAL_SCENE,
    entities: [
      { id: "player", name: "P", kind: "player", summary: "p" },
      { id: "bartender", name: "瑪拉", kind: "npc", summary: "b", memory_tier: 2 },
    ],
    memorySlice: { episodes: [], entities: [], relations: [] },
  });
  expect(idle).toHaveLength(0);
  const hit = await gatherRecallSnippets({
    playerText: "記得嗎廣場那時",
    scene: INITIAL_SCENE,
    entities: [
      { id: "player", name: "P", kind: "player", summary: "p" },
      { id: "bartender", name: "瑪拉", kind: "npc", summary: "b", memory_tier: 2 },
    ],
    memorySlice: { episodes: [], entities: [], relations: [] },
  });
  expect(hit.length).toBeGreaterThan(0);
  expect(hit.length).toBeLessThanOrEqual(2);
  expect(hit[0]?.excerpts.length ?? 0).toBeLessThanOrEqual(3);
});

test("mock runTurn twenty times does not compact without inject", async () => {
  await wipe();
  await setupDefaultForTest();
  await saveCompactState({ anchor_turn_n: 0 });
  for (let i = 0; i < 20; i++) {
    await runTurn({ player_text: `點頭 ${i}` });
  }
  expect(existsSync(join(sessionArchiveDir, "sa_001"))).toBe(false);
});

test("custom without L2 still archives jsonl on inject", async () => {
  await wipe();
  const { setupCustom } = await import("./setup.ts");
  const { PrimerSchema } = await import("./schema.ts");
  await setupCustom(
    PrimerSchema.parse({
      worldview: "紫晶沙漠裡的鐘樓每小時倒轉一次，沙粒會記住說出口的謊。",
      protagonist: "",
      extras: "",
      starting_point: "玩家在一座沒有門牌的石棧醒來，風裡全是鹽。",
    }),
  );
  expect(existsSync(join(kbRuntimeDir, "npc-memory", "l2", "bartender"))).toBe(false);
  await seedLiveJsonl();
  const scene = await loadScene();
  setCompactTestHooks({
    summary: () => ({ title: "霧", body: "客棧一段結束。" }),
  });
  const gm: GmOutput = {
    narration: "潮。",
    npc_lines: [{ npc_id: "keeper", name: "掌櫃", text: "湯好了。" }],
    events: [
      {
        actors: ["player", "keeper"],
        action: "talk_idle",
        result: "ok",
        summary: "點湯",
        entity_ids: ["keeper", "player"],
      },
    ],
    gm_note: "客棧",
    scene: scene!,
    ui: null,
    needs_image: false,
  };
  const result = await maybeCompactAfterTurn({ turnId: "t0020", gm, sceneBefore: scene!, mock: true });
  expect(result.compacted).toBe(true);
  expect(existsSync(join(sessionArchiveDir, "sa_001", "session.jsonl"))).toBe(true);
  expect(existsSync(join(kbRuntimeDir, "npc-memory", "l2", "bartender"))).toBe(false);
});

test("presentChanged ignores order", () => {
  expect(
    presentChanged(
      { scene_id: "tavern", present: ["player", "ash", "bartender"], visible: [] },
      { scene_id: "tavern", present: ["bartender", "player", "ash"], visible: [] },
    ),
  ).toBe(false);
});

function leaveAshGm(): GmOutput {
  const base = talk();
  return {
    ...base,
    npc_lines: [
      ...base.npc_lines,
      { npc_id: "ash", name: "灰", text: "我先離開角落。燈還亮著。" },
    ],
    events: [
      ...base.events,
      {
        actors: ["player", "ash"],
        action: "leave",
        result: "gone",
        summary: "灰離開酒館角落",
        entity_ids: ["ash", "player"],
      },
    ],
    scene: { ...INITIAL_SCENE, present: ["player", "bartender"] },
  };
}

const npcHook = () => ({
  title: "本段",
  summary: "知情。",
  salient_quotes: [] as { turn_id: string; speaker: string; text: string }[],
  distilled_body: "短記憶。",
});

test("qualified L2 leave archives that npc only; jsonl and anchor stay", async () => {
  await wipe();
  await setupDefaultForTest();
  await writeFromGm(leaveAshGm(), "t0008", new Date().toISOString(), "tavern");
  const live = await seedLiveJsonl();
  const barBefore = (await loadL2Current("bartender"))?.body;
  setCompactTestHooks({ npcArchive: npcHook });
  const result = await maybeCompactAfterTurn({
    turnId: "t0008",
    gm: leaveAshGm(),
    sceneBefore: INITIAL_SCENE,
    mock: true,
  });
  expect(result.compacted).toBe(false);
  expect(existsSync(live)).toBe(true);
  expect(existsSync(join(sessionArchiveDir, "sa_001"))).toBe(false);
  expect(existsSync(join(kbRuntimeDir, "npc-memory", "l2", "ash", "archive", "na_ash_001.json"))).toBe(true);
  const ashEntry = JSON.parse(
    await readFile(join(kbRuntimeDir, "npc-memory", "l2", "ash", "archive", "na_ash_001.json"), "utf8"),
  );
  expect(ashEntry.session_archive_id).toBeUndefined();
  expect((await loadL2Current("bartender"))?.body).toBe(barBefore);
  expect((await loadCompactState()).anchor_turn_n).toBe(0);
});

test("unqualified leave does not open npc archive", async () => {
  await wipe();
  await setupDefaultForTest();
  const gm = { ...talk(), scene: { ...INITIAL_SCENE, present: ["player", "bartender"] } };
  await writeFromGm(gm, "t0009", new Date().toISOString(), "tavern");
  setCompactTestHooks({ npcArchive: npcHook });
  await maybeCompactAfterTurn({ turnId: "t0009", gm, sceneBefore: INITIAL_SCENE, mock: true });
  expect(existsSync(join(kbRuntimeDir, "npc-memory", "l2", "ash", "archive"))).toBe(false);
});

test("scene_id change triggers session compact", async () => {
  await wipe();
  await setupDefaultForTest();
  await writeFromGm(talk(), "t0003", new Date().toISOString(), "tavern");
  await seedLiveJsonl();
  setCompactTestHooks({
    summary: () => ({ title: "換幕", body: "走到門外。" }),
    npcArchive: npcHook,
  });
  const gm = { ...talk(), scene: { ...INITIAL_SCENE, scene_id: "street" } };
  const result = await maybeCompactAfterTurn({ turnId: "t0003", gm, sceneBefore: INITIAL_SCENE, mock: true });
  expect(result.compacted).toBe(true);
  expect(existsSync(join(sessionArchiveDir, "sa_001", "summary.json"))).toBe(true);
});

test("two departed npc archives overlap in time", async () => {
  await wipe();
  await setupDefaultForTest();
  const gm: GmOutput = {
    ...talk(),
    npc_lines: [
      { npc_id: "bartender", name: "瑪拉", text: "你走吧。" },
      { npc_id: "ash", name: "灰", text: "我也走。" },
    ],
    events: [
      {
        actors: ["player", "bartender", "ash"],
        action: "leave",
        result: "gone",
        summary: "兩人離開吧台",
        entity_ids: ["bartender", "ash", "player"],
      },
    ],
    scene: { ...INITIAL_SCENE, present: ["player"] },
  };
  await writeFromGm(gm, "t0010", new Date().toISOString(), "tavern");
  const started: number[] = [];
  setCompactTestHooks({
    npcArchive: async (npcId) => {
      started.push(Date.now());
      await new Promise((r) => setTimeout(r, 80));
      return { ...npcHook(), title: npcId };
    },
  });
  const t0 = Date.now();
  await maybeCompactAfterTurn({ turnId: "t0010", gm, sceneBefore: INITIAL_SCENE, mock: true });
  const elapsed = Date.now() - t0;
  expect(existsSync(join(kbRuntimeDir, "npc-memory", "l2", "bartender", "archive", "na_bartender_001.json"))).toBe(true);
  expect(existsSync(join(kbRuntimeDir, "npc-memory", "l2", "ash", "archive", "na_ash_001.json"))).toBe(true);
  expect(elapsed).toBeLessThan(160);
  expect(started.length).toBe(2);
});

test("departed npc failure does not block session compact", async () => {
  await wipe();
  await setupDefaultForTest();
  await writeFromGm(leaveAshGm(), "t0011", new Date().toISOString(), "tavern");
  await seedLiveJsonl();
  setCompactTestHooks({
    summary: () => ({ title: "段", body: "摘要正文夠長。" }),
    npcArchive: (id) => {
      if (id === "ash") throw new Error("npc-archive ash: boom");
      return npcHook();
    },
  });
  const result = await maybeCompactAfterTurn({
    turnId: "t0020",
    gm: leaveAshGm(),
    sceneBefore: INITIAL_SCENE,
    mock: true,
  });
  expect(result.compacted).toBe(true);
  expect(existsSync(join(sessionArchiveDir, "sa_001"))).toBe(true);
  expect(existsSync(join(kbRuntimeDir, "npc-memory", "l2", "ash", "archive", "na_ash_001.json"))).toBe(false);
});

test("session fail keeps departed npc archive", async () => {
  await wipe();
  await setupDefaultForTest();
  await writeFromGm(leaveAshGm(), "t0012", new Date().toISOString(), "tavern");
  const live = await seedLiveJsonl();
  setCompactTestHooks({
    summary: () => ({ title: "t", body: "摘要正文。" }),
    npcArchive: npcHook,
    failAfterScratch: () => {
      throw new Error("inject");
    },
  });
  const result = await maybeCompactAfterTurn({
    turnId: "t0020",
    gm: leaveAshGm(),
    sceneBefore: INITIAL_SCENE,
    mock: true,
  });
  expect(result.compacted).toBe(false);
  expect(existsSync(live)).toBe(true);
  expect(existsSync(join(sessionArchiveDir, "sa_001"))).toBe(false);
  expect(existsSync(join(kbRuntimeDir, "npc-memory", "l2", "ash", "archive", "na_ash_001.json"))).toBe(true);
  expect((await loadCompactState()).anchor_turn_n).toBe(0);
});

test("hot path source never loads compact-judge.md", async () => {
  const src = await readFile(join(import.meta.dir, "compact.ts"), "utf8");
  expect(src.includes("compact-judge.md")).toBe(false);
  expect(src.includes("judgeCompact")).toBe(false);
});

test("scene_id change does not archive on-stage L2 under 640", async () => {
  await wipe();
  await setupDefaultForTest();
  await writeFromGm(talk(), "t0003", new Date().toISOString(), "tavern");
  await seedLiveJsonl();
  setCompactTestHooks({
    summary: () => ({ title: "換幕", body: "走到門外。" }),
    npcArchive: npcHook,
  });
  const gm = { ...talk(), scene: { ...INITIAL_SCENE, scene_id: "street" } };
  await maybeCompactAfterTurn({ turnId: "t0003", gm, sceneBefore: INITIAL_SCENE, mock: true });
  expect(existsSync(join(kbRuntimeDir, "npc-memory", "l2", "bartender", "archive"))).toBe(false);
});

test("one of two departed npc failures still commits the other", async () => {
  await wipe();
  await setupDefaultForTest();
  const gm: GmOutput = {
    ...talk(),
    npc_lines: [
      { npc_id: "bartender", name: "瑪拉", text: "你走吧。" },
      { npc_id: "ash", name: "灰", text: "我也走。" },
    ],
    events: [
      {
        actors: ["player", "bartender", "ash"],
        action: "leave",
        result: "gone",
        summary: "兩人離開吧台",
        entity_ids: ["bartender", "ash", "player"],
      },
    ],
    scene: { ...INITIAL_SCENE, present: ["player"] },
  };
  await writeFromGm(gm, "t0013", new Date().toISOString(), "tavern");
  setCompactTestHooks({
    npcArchive: (id) => {
      if (id === "ash") throw new Error("npc-archive ash: boom");
      return npcHook();
    },
  });
  await maybeCompactAfterTurn({ turnId: "t0013", gm, sceneBefore: INITIAL_SCENE, mock: true });
  expect(existsSync(join(kbRuntimeDir, "npc-memory", "l2", "bartender", "archive", "na_bartender_001.json"))).toBe(true);
  expect(existsSync(join(kbRuntimeDir, "npc-memory", "l2", "ash", "archive", "na_ash_001.json"))).toBe(false);
});

test("npc-only dirty drops successful id and keeps since null", async () => {
  await wipe();
  await setupDefaultForTest();
  await writeFromGm(leaveAshGm(), "t0008", new Date().toISOString(), "tavern");
  setCompactTestHooks({ npcArchive: npcHook });
  await maybeCompactAfterTurn({ turnId: "t0008", gm: leaveAshGm(), sceneBefore: INITIAL_SCENE, mock: true });
  const dirty = await loadDirtySet();
  expect(dirty.touched.includes("ash")).toBe(false);
  expect(dirty.since_session_archive).toBeNull();
});

test("session-only dirty sets since and drops distilled near_cap id", async () => {
  await wipe();
  await setupDefaultForTest();
  await writeFromGm(talk(), "t0005", new Date().toISOString(), "tavern");
  await saveL2Current({ npc_id: "bartender", body: "記".repeat(640), updated_turn: 5 });
  await seedLiveJsonl();
  setCompactTestHooks({
    summary: () => ({ title: "段", body: "摘要正文夠長。" }),
    npcArchive: npcHook,
  });
  await maybeCompactAfterTurn({ turnId: "t0020", gm: talk(), sceneBefore: INITIAL_SCENE, mock: true });
  const dirty = await loadDirtySet();
  expect(dirty.since_session_archive).toBe("sa_001");
  expect(dirty.touched.includes("bartender")).toBe(false);
});

test("both scopes dirty keeps since and does not re-touch departed success", async () => {
  await wipe();
  await setupDefaultForTest();
  await writeFromGm(leaveAshGm(), "t0012", new Date().toISOString(), "tavern");
  await seedLiveJsonl();
  setCompactTestHooks({
    summary: () => ({ title: "段", body: "摘要正文夠長。" }),
    npcArchive: npcHook,
  });
  await maybeCompactAfterTurn({
    turnId: "t0020",
    gm: leaveAshGm(),
    sceneBefore: INITIAL_SCENE,
    mock: true,
  });
  const dirty = await loadDirtySet();
  expect(dirty.since_session_archive).toBe("sa_001");
  expect(dirty.touched.includes("ash")).toBe(false);
});

test("N=8 yaml due at t0008 session compact", async () => {
  await wipe();
  await setupDefaultForTest();
  await writeFromGm(talk(), "t0004", new Date().toISOString(), "tavern");
  await seedLiveJsonl();
  const prev = process.env.VIBE_GAMEVERSE_CONFIG;
  const cfgPath = join(kbRuntimeDir, "cfg-n8.yaml");
  await writeFile(
    cfgPath,
    `compact:
  max_turns_without_compact: 8
  recent_turns_to_keep: 3
  force_after_input_tokens: 100000
  force_after_jsonl_bytes: 400000
`,
  );
  process.env.VIBE_GAMEVERSE_CONFIG = cfgPath;
  resetAppConfigCache();
  try {
    setCompactTestHooks({
      summary: () => ({ title: "滿N", body: "八段結束。" }),
      npcArchive: npcHook,
    });
    const result = await maybeCompactAfterTurn({ turnId: "t0008", gm: talk(), sceneBefore: INITIAL_SCENE, mock: true });
    expect(result.compacted).toBe(true);
  } finally {
    if (prev === undefined) delete process.env.VIBE_GAMEVERSE_CONFIG;
    else process.env.VIBE_GAMEVERSE_CONFIG = prev;
    resetAppConfigCache();
  }
});
