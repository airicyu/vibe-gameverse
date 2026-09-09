import "./test-runtime-env.ts";
import { expect, test } from "bun:test";
import { loadEpisodes, wipeWorlds } from "./kb.ts";
import { requestHome, setupDefault } from "./setup.ts";

test("setupDefault auto-runs opening turn with narration", async () => {
  await wipeWorlds();
  const result = await setupDefault({ template_id: "rust-lamp", save_name: "開場測" });
  expect(result.opening).not.toBeNull();
  expect(result.opening!.gm.narration.length).toBeGreaterThan(0);
  expect(result.opening!.gm.npc_lines.length).toBeGreaterThan(0);
  const episodes = await loadEpisodes();
  expect(episodes.length).toBeGreaterThan(0);
  await requestHome();
  const again = await setupDefault({ template_id: "rust-lamp", save_name: "另一局" });
  // new world also gets opening
  expect(again.opening).not.toBeNull();
});

test("load after home does not re-open if episodes exist", async () => {
  await wipeWorlds();
  const created = await setupDefault({ template_id: "rust-lamp", save_name: "可載入" });
  const id = created.save.id;
  const n = (await loadEpisodes()).length;
  expect(n).toBeGreaterThan(0);
  await requestHome();
  const { loadWorld } = await import("./setup.ts");
  const loaded = await loadWorld({ id });
  expect(loaded.opening).toBeNull();
  expect((await loadEpisodes()).length).toBe(n);
});

test("turns append chat_tail; load restores recent dialogue for UI", async () => {
  await wipeWorlds();
  const created = await setupDefault({ template_id: "rust-lamp", save_name: "對話尾" });
  const { runTurn } = await import("./turn.ts");
  const { loadChatTail } = await import("./kb.ts");
  await runTurn({ player_text: "我向櫃檯點一碗湯" });
  const tail = await loadChatTail();
  expect(tail.length).toBeGreaterThanOrEqual(1);
  const last = tail[tail.length - 1]!;
  expect(last.player_text).toBe("我向櫃檯點一碗湯");
  expect(last.hide_player).toBe(false);
  expect(last.narration.length).toBeGreaterThan(0);
  // opening entry should hide player bubble
  expect(tail.some((e) => e.hide_player)).toBe(true);

  const id = created.save.id;
  await requestHome();
  const { loadWorld } = await import("./setup.ts");
  await loadWorld({ id });
  const restored = await loadChatTail();
  expect(restored.length).toBe(tail.length);
  expect(restored[restored.length - 1]!.player_text).toBe("我向櫃檯點一碗湯");
});
