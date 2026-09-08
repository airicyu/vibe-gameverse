# HANDOFF — 0.7.0 多世界存檔

狀態：設計閘門已通過（見 [`docs/design-review.md`](./docs/design-review.md)）。契約以 [`INDEX.md`](./INDEX.md) 為準；HOW：[`docs/multi-world.md`](./docs/multi-world.md)。

**Do not commit unless the user asks.**

對使用者：繁體中文書面語。

## 讀檔順序

1. `AGENTS.md`
2. `docs/roadmap/0.7.0/INDEX.md`（已定案＋驗收＋Track）
3. `docs/roadmap/0.7.0/docs/multi-world.md`、`docs/reasoning.md`
4. 錨點：`program/kb.ts`、`program/setup.ts`、`program/server.ts`、`program/gm-pi.ts`、`program/schema.ts`、`program/test-runtime-env.ts`、`program/public/`、`.gitignore`
5. 生成契約不變：0.2.0／0.3.0（本版只改落盤目錄與選單）

只認檔案，不認 chat history。INDEX 已寫的不要再問；沉默才提問。

## 產品摘要

多份 `kb/worlds/{uuid}/` 完整 playthrough；`save.json` 存顯示名；`current.json` pointer 標目前在玩。主頁＝開始新故事／載入；開新不得抹其他 uuid。新 process 啟動刪 pointer→一律主頁。遊玩中可回主頁（不清存檔）或輸入 `delete` 刪目前這份。舊 `kb/runtime/` 不讀不搬。

## Track 順序

A（目錄、pointer、env、gitignore；對局路徑跟 pointer）→ B（HTTP／setup `save_name`／廢清 parent 的 new-game）→ C（UI 主頁／載入／回主頁／刪除 dialog）→ D（驗收單測、changelog／VERSION／AGENTS；出貨後刪 backlog `multi-world-saves`）。

每 Track 結束跑相關測試；全部結束跑 `bun test`。實作開始時 INDEX → `in progress`；`shipped` 僅在驗收與測試通過且使用者同意出貨時。

## 禁區

INDEX 非目標。勿 `rm` live `kb/runtime` 或 live `kb/worlds`。勿 hop 舊 runtime。勿同一世界多槽／匯出／雲同步。勿改 compact trigger。勿空 parent 偷灌 seed。勿把 save_name 寫進 GM prompt。playing 時禁止 load／setup（須先 home）。

## 完成檢查

- INDEX 驗收可客觀測（空 parent 主頁、A／B 並存、save_name≠title、回主頁不刪、delete 確認字、半套 409、開機不 continue、decoy runtime）
- 測試只用 `VIBE_GAMEVERSE_KB_WORLDS`（RUNTIME 忽略）
- `.gitignore` 含 `kb/worlds/`
- 出貨：VERSION＝`0.7.0`；changelog；AGENTS 寫 worlds／主頁／pointer；刪 backlog 列與檔

## Paste-ready starter prompt

```text
你是 0.7.0 實作 agent。只認檔案，不認 chat history。
先讀 AGENTS.md → docs/roadmap/0.7.0/HANDOFF.md → docs/roadmap/0.7.0/INDEX.md → docs/roadmap/0.7.0/docs/multi-world.md → docs/roadmap/0.7.0/docs/reasoning.md。
依 Track A→B→C→D。禁非目標。INDEX 已定案不要再問；沉默才提問。
繁體中文書面語。不要 git commit，除非使用者明確要求。
勿 rm 專案 live kb/runtime 或 kb/worlds。測試用 VIBE_GAMEVERSE_KB_WORLDS 指 temp parent。
```
