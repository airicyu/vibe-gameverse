import "./test-runtime-env.ts";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { HttpError } from "./errors.ts";
import {
  bootWorlds,
  getScreen,
  isPlayableWorld,
  kbRuntimeDir,
  kbWorldsDir,
  listPlayableWorlds,
  loadActiveSave,
  wipeWorlds,
  worldDir,
} from "./kb.ts";
import { deleteCurrentWorld, listWorlds, loadWorld, requestHome, setupDefault } from "./setup.ts";
import { runTurn } from "./turn.ts";

async function wipe(): Promise<void> {
  await wipeWorlds();
}

test("empty worlds parent is home; turn 409", async () => {
  await wipe();
  expect(await getScreen()).toBe("home");
  expect((await listPlayableWorlds()).length).toBe(0);
  try {
    await runTurn({ player_text: "你好" });
    throw new Error("expected HttpError");
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(409);
    expect((err as HttpError).body.error).toBe("not_playing");
  }
});

test("two setups coexist; opening B does not erase A", async () => {
  await wipe();
  const a = await setupDefault({ template_id: "rust-lamp", save_name: "存檔甲" });
  const idA = a.save.id;
  const noteA = join(worldDir(idA), "gm_note.txt");
  expect(existsSync(noteA)).toBe(true);
  await requestHome();
  const b = await setupDefault({ template_id: "rust-lamp", save_name: "存檔乙" });
  expect(b.save.id).not.toBe(idA);
  expect(existsSync(noteA)).toBe(true);
  expect(existsSync(join(worldDir(b.save.id), "world.json"))).toBe(true);
  const listed = await listPlayableWorlds();
  expect(listed.map((w) => w.id).sort()).toEqual([idA, b.save.id].sort());
  expect(listed.find((w) => w.id === idA)?.save_name).toBe("存檔甲");
  expect(listed.find((w) => w.id === b.save.id)?.save_name).toBe("存檔乙");
});

test("save_name is the display name; list has no separate title", async () => {
  await wipe();
  const { world, save } = await setupDefault({ template_id: "rust-lamp", save_name: "我的第一局" });
  expect(save.save_name).toBe("我的第一局");
  expect(world.save_name).toBe("我的第一局");
  expect(world.id).toBe(save.id);
  const { worlds } = await listWorlds();
  expect(worlds[0]?.save_name).toBe("我的第一局");
  expect((worlds[0] as { title?: string }).title).toBeUndefined();
});

test("home then reload same id keeps playthrough", async () => {
  await wipe();
  const a = await setupDefault({ template_id: "rust-lamp", save_name: "可重載" });
  await writeFile(join(kbRuntimeDir, "gm_note.txt"), "標記仍在");
  await requestHome();
  expect(await getScreen()).toBe("home");
  expect(existsSync(worldDir(a.save.id))).toBe(true);
  await loadWorld({ id: a.save.id });
  expect(await getScreen()).toBe("playing");
  const save = await loadActiveSave();
  expect(save?.id).toBe(a.save.id);
  const note = await Bun.file(join(kbRuntimeDir, "gm_note.txt")).text();
  expect(note.trim()).toBe("標記仍在");
});

test("delete requires exact confirm delete", async () => {
  await wipe();
  const a = await setupDefault({ template_id: "rust-lamp", save_name: "待刪" });
  const id = a.save.id;
  try {
    await deleteCurrentWorld({ confirm: "DELETE" });
    throw new Error("expected HttpError");
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(400);
  }
  expect(existsSync(worldDir(id))).toBe(true);
  await deleteCurrentWorld({ confirm: "delete" });
  expect(existsSync(worldDir(id))).toBe(false);
  expect(await getScreen()).toBe("home");
  expect((await listPlayableWorlds()).some((w) => w.id === id)).toBe(false);
});

test("half world not listed; load 409", async () => {
  await wipe();
  const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  await mkdir(worldDir(id), { recursive: true });
  await writeFile(
    join(worldDir(id), "world.json"),
    JSON.stringify({ source: "default", save_name: "半套", created_at: "2026-01-01T00:00:00.000Z" }),
  );
  expect(await isPlayableWorld(id)).toBe(false);
  expect((await listPlayableWorlds()).some((w) => w.id === id)).toBe(false);
  try {
    await loadWorld({ id });
    throw new Error("expected HttpError");
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(409);
  }
});

test("bootWorlds clears pointer even if playable saves exist", async () => {
  await wipe();
  const a = await setupDefault({ template_id: "rust-lamp", save_name: "開機測" });
  expect(await getScreen()).toBe("playing");
  expect(existsSync(join(kbWorldsDir, "current.json"))).toBe(true);
  await bootWorlds();
  expect(await getScreen()).toBe("home");
  expect(existsSync(join(kbWorldsDir, "current.json"))).toBe(false);
  expect(existsSync(worldDir(a.save.id))).toBe(true);
});

test("decoy runtime beside parent is not listed", async () => {
  await wipe();
  await setupDefault({ template_id: "rust-lamp", save_name: "真存檔" });
  await requestHome();
  const decoy = join(kbWorldsDir, "..", "runtime");
  mkdirSync(decoy, { recursive: true });
  writeFileSync(
    join(decoy, "world.json"),
    JSON.stringify({
      id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      source: "default",
      save_name: "幽靈",
      created_at: "2026-01-01T00:00:00.000Z",
    }),
  );
  const listed = await listPlayableWorlds();
  expect(listed.every((w) => w.save_name !== "幽靈")).toBe(true);
  expect(listed.length).toBe(1);
});

test("load while playing is 409", async () => {
  await wipe();
  const a = await setupDefault({ template_id: "rust-lamp", save_name: "甲" });
  await requestHome();
  const b = await setupDefault({ template_id: "rust-lamp", save_name: "乙" });
  expect(await getScreen()).toBe("playing");
  try {
    await loadWorld({ id: a.save.id });
    throw new Error("expected HttpError");
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(409);
    expect((err as HttpError).body.error).toBe("must_home");
  }
  expect((await loadActiveSave())?.id).toBe(b.save.id);
});

test("VIBE_GAMEVERSE_KB_RUNTIME is ignored", async () => {
  await wipe();
  const prev = process.env.VIBE_GAMEVERSE_KB_RUNTIME;
  process.env.VIBE_GAMEVERSE_KB_RUNTIME = join(kbWorldsDir, "should-not-use");
  try {
    await setupDefault({ template_id: "rust-lamp", save_name: "env測" });
    expect(kbRuntimeDir.startsWith(kbWorldsDir)).toBe(true);
    expect(kbRuntimeDir.includes("should-not-use")).toBe(false);
  } finally {
    if (prev === undefined) delete process.env.VIBE_GAMEVERSE_KB_RUNTIME;
    else process.env.VIBE_GAMEVERSE_KB_RUNTIME = prev;
  }
});
