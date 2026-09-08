# HANDOFF — 0.5.0 Session compact

狀態：`shipped`。契約以 [`INDEX.md`](./INDEX.md) 為準；HOW：[`docs/session-compact.md`](./docs/session-compact.md)。

**Do not commit unless the user asks.**

對使用者：繁體中文書面語。

## 讀檔順序

1. `AGENTS.md`
2. `docs/roadmap/0.5.0/INDEX.md`
3. `docs/roadmap/0.5.0/docs/session-compact.md`、`docs/reasoning.md`
4. 對照：[0.4.0 docs/npc-memory.md](../0.4.0/docs/npc-memory.md)（L2 archive 欄位）
5. 錨點：`program/schema.ts`、`kb.ts`、`npc-memory.ts`、`writer.ts`、`turn.ts`、`gm-pi.ts`、`gm-mock.ts`、`world-generate.ts`、`prompts/gm-contract.md`

只認檔案，不認 chat history。INDEX 已寫的不要再問；沉默才提問。

## 產品摘要

長局封存活 jsonl、開新 session；同一拍寫 L2 archive 並 distill current。取消 L2 800 硬截。活目錄 `play-sessions/`。根目錄 `config.yaml`。對局 GM JSON 必填 `scene`。回想：GM 前啟發式才掃，最多兩份細節。

## Track 順序

A（yaml、改名、schema、GM `scene`、不截 800、clear、`compact-state`）→ B（judge／強制／整步 compact／NPC archive 模型／開場 3 回）→ C（回想）→ D（BAN、出貨文件）。

每 Track 結束跑相關測試；全部結束跑 `bun test`。實作開始時把本版 INDEX 狀態改為 `in progress`；出貨才改 `shipped` 並清 backlog。

禁區
INDEX 非目標。勿 `rm` live `kb/runtime`。勿改 0.3.0 gate／persona BAN。勿把整份 jsonl 貼回 system。勿在對局 GM JSON 加 recall 欄（**要**加 `scene`）。勿 Writer 讀 jsonl。勿讓 mock 預設 `should_compact: true`。勿把 `since_session_archive` 再寫死 null。路徑勿再寫 `pi-sessions`（遷移除外）。勿用程式截 distill。N 否決必須寫 `compact-state.json`。

## 完成檢查

- INDEX 驗收可客觀測（含 (a) 進出會問、Custom 無 L2 仍封）
- 注入失敗無半套
- 缺 yaml 啟動失敗
- 回想上限 2／3／120；啟發式不含本回合 events
- 測試只用 `VIBE_GAMEVERSE_KB_RUNTIME`（設定可用 `VIBE_GAMEVERSE_CONFIG`）

## Paste-ready starter prompt

```text
你是 0.5.0 實作 agent。只認檔案，不認 chat history。
先讀 AGENTS.md → docs/roadmap/0.5.0/HANDOFF.md → docs/roadmap/0.5.0/INDEX.md → docs/roadmap/0.5.0/docs/session-compact.md → docs/roadmap/0.5.0/docs/reasoning.md → docs/roadmap/0.4.0/docs/npc-memory.md（僅 archive 欄位）。
依 Track A→B→C→D。禁非目標。INDEX 已定案不要再問；沉默才提問。
繁體中文書面語。不要 git commit，除非使用者明確要求。
勿 rm 專案 live kb/runtime。測試用 VIBE_GAMEVERSE_KB_RUNTIME 與可選 VIBE_GAMEVERSE_CONFIG。
```
