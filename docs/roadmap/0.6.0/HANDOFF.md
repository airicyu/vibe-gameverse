# HANDOFF — 0.6.0 Compact 分 scope 與同回合平行

狀態：`shipped`。契約以 [`INDEX.md`](./INDEX.md) 為準；HOW：[`docs/compact-scopes.md`](./docs/compact-scopes.md)。

**Do not commit unless the user asks.**

對使用者：繁體中文書面語。

## 讀檔順序

1. `AGENTS.md`
2. `docs/roadmap/0.6.0/INDEX.md`
3. `docs/roadmap/0.6.0/docs/compact-scopes.md`、`docs/reasoning.md`
4. 路徑／zod／回想欄位：[0.5.0 session-compact HOW](../0.5.0/docs/session-compact.md)（僅未被 0.6.0 HOW「覆寫」表推翻者）
5. [research/pi-agent-subagent.md](../../research/pi-agent-subagent.md)（平行＝program 再開 session，不要家長委派）
6. 錨點：`program/turn.ts`、`program/compact.ts`、`program/gm-pi.ts`、`program/config.ts`、根目錄 `config.yaml`、`program/schema.ts`、`program/npc-memory.ts`、`program/kb.ts`、`prompts/compact-npc-archive.md`、`prompts/compact-summary.md`

只認檔案，不認 chat history。INDEX 已寫的不要再問；沉默才提問。

## 產品摘要

Compact 拆成 NPC scope（L2 離場、有資格才 archive／distill）與 session scope（滿 N＝8、`scene_id` 換幕、強制線）。廢 judge 與 0.5.0 `(a)`。同一 HTTP 回合內 `allSettled` 平行短呼叫；不背景、不鎖。失敗解耦：離場 NPC 按 id；session 自身 fail-closed；不回滾已提交的離場 NPC。不搬 `kb/runtime` 樹。

## Track 順序

A（觸發分流、廢 judge、yaml N＝8）→ B（DAG 平行、`allSettled`、dirty 三結局、opening 在新 session）→ C（失敗解耦測規）→ D（changelog／VERSION／AGENTS；出貨後刪 backlog `compact-optimization`）。

每 Track 結束跑相關測試；全部結束跑 `bun test`。實作開始時 INDEX → `in progress`；`shipped` 僅在驗收與測試通過且使用者同意出貨時。

## 禁區

INDEX 非目標。勿 `rm` live `kb/runtime`。勿背景 compact／per-id 鎖。勿 `pi-subagents`、勿家長 `task`。勿裸 `Promise.all` 當失敗屏障。勿 `clipTail`。勿把未落盤 `sa_` 寫進 NPC archive。勿重接 judge。勿搬目錄樹。勿 debug 分鈕。勿改回想語意。

## 完成檢查

- INDEX 驗收可客觀測（離場有／無資格、並行、廢 judge、N／換幕／強制線、失敗解耦、mock 不自動跑）
- 倉庫 `config.yaml` 預設 N＝8
- 測試只用 `VIBE_GAMEVERSE_KB_RUNTIME`（設定可用 `VIBE_GAMEVERSE_CONFIG`）

## Paste-ready starter prompt

```text
你是 0.6.0 實作 agent。只認檔案，不認 chat history。
先讀 AGENTS.md → docs/roadmap/0.6.0/HANDOFF.md → docs/roadmap/0.6.0/INDEX.md → docs/roadmap/0.6.0/docs/compact-scopes.md → docs/roadmap/0.6.0/docs/reasoning.md → docs/roadmap/0.5.0/docs/session-compact.md（僅路徑／zod／回想，且服從 0.6.0 覆寫表）。
依 Track A→B→C→D。禁非目標。INDEX 已定案不要再問；沉默才提問。
繁體中文書面語。不要 git commit，除非使用者明確要求。
勿 rm 專案 live kb/runtime。測試用 VIBE_GAMEVERSE_KB_RUNTIME 與可選 VIBE_GAMEVERSE_CONFIG。
```
