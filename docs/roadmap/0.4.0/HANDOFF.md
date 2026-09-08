# HANDOFF — 0.4.0 NPC 分層記憶

狀態：`shipped`。契約以 [`INDEX.md`](./INDEX.md) 為準；HOW：[`docs/npc-memory.md`](./docs/npc-memory.md)。

**Do not commit unless the user asks.**

對使用者：繁體中文書面語。

## 讀檔順序

1. `AGENTS.md`
2. `docs/roadmap/0.4.0/INDEX.md`（已定案＋驗收＋Track）
3. `docs/roadmap/0.4.0/docs/npc-memory.md`、`docs/reasoning.md`
4. `docs/roadmap/0.4.0/docs/design-review.md`（不以審查檔當契約）
5. 錨點程式：`program/schema.ts`、`kb.ts`、`writer.ts`、`turn.ts`、`world-generate.ts`、`gm-pi.ts`、`gm-mock.ts`、`kb/seed/bartender.json`、`ash.json`

只認檔案，不認 chat history。INDEX 已寫的不要再問；沉默才提問。

## 產品摘要

對局除世界 KB 外，NPC 有分層主觀記憶：L0／L1 同一 `pool.json`；L2 才有 `npc-memory/l2/{id}/current.json`。Default 瑪拉／灰開場即 L2（短常數）。Writer 在世界 KB 之後機械更新；不開第二模型；不寫 archive；不 compact jsonl。`MemorySlice` 形狀不變；記憶走 `GmContext.npc_memories`（僅 `scene.present`）。

## Track 順序

A（schema／路徑／setup 初值／生成最多 0）→ B（Writer 順序、trivial、升 2 原子、遺忘、dirty）→ C（`buildGmContext`、contract 不串台段）→ D（BAN 測、`AGENTS.md`／VERSION 出貨時）。

每 Track 結束跑相關測試；全部結束跑 `bun test`。

## 禁區

INDEX 非目標。勿 `rm` live `kb/runtime`。勿改 0.3.0 relation／gate／persona BAN。勿用「有檔反推 tier」。勿把整份 pool 進 prompt。勿把 `npc_memories` 加進玩家 HTTP。勿寫 `archive/`。常數 600／800／12／640／4000 勿擅自改。構想 backlog 的 `{npc_id}.json` 路徑已推翻。

## 完成檢查

- INDEX 驗收可客觀測
- 招呼＋`upsertRelation` 不升 1
- 升 2 注入回滾
- custom 生成 2 → 落盤 0
- 測試只用 `VIBE_GAMEVERSE_KB_RUNTIME`

## Paste-ready starter prompt

```text
你是 0.4.0 實作 agent。只認檔案，不認 chat history。
先讀 AGENTS.md → docs/roadmap/0.4.0/HANDOFF.md → docs/roadmap/0.4.0/INDEX.md → docs/roadmap/0.4.0/docs/npc-memory.md → docs/roadmap/0.4.0/docs/reasoning.md。
依 Track A→B→C→D。禁非目標。INDEX 已定案不要再問；沉默才提問。
繁體中文書面語。不要 git commit，除非使用者明確要求。
勿 rm 專案 live kb/runtime。測試用 VIBE_GAMEVERSE_KB_RUNTIME。
```
