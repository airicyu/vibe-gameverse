# HANDOFF — 0.8.0 角色記憶：情景摘要與定位

狀態：設計閘門已通過（見 [`docs/design-review.md`](./docs/design-review.md)）。契約以 [`INDEX.md`](./INDEX.md) 為準；HOW：[`docs/memory-situations.md`](./docs/memory-situations.md)。

**Do not commit unless the user asks.**

對使用者：繁體中文書面語。

## 讀檔順序

1. `AGENTS.md`
2. `docs/roadmap/0.8.0/INDEX.md`（已定案＋驗收＋Track）
3. `docs/roadmap/0.8.0/docs/memory-situations.md`、`docs/reasoning.md`
4. 錨點：`program/recall.ts`、`program/schema.ts`、`program/compact.ts`、`prompts/compact-npc-archive.md`、`program/writer.ts`、`program/npc-memory.ts`；相關測：`program/compact.test.ts`、`program/npc-memory.test.ts`
5. 對照舊語意（勿當本版契約）：`docs/roadmap/0.5.0/`、`docs/roadmap/0.6.0/`

只認檔案，不認 chat history。INDEX 已寫的不要再問；沉默才提問。

## 產品摘要

廢 `salient_quotes` 與 jsonl 剪句餵 GM。過去＝情景 summary + locator。新增回想閘門（iii）：點名 L2＋有 archive 即可掃（不要求 present／不要求名缺席近 8 episode）。對白全文只在 `session-archive` jsonl。不 hop。不改 0.6.0 compact scope。

## Track 順序

A（schema／prompt／compact 寫入；index 帶 summary、刪 quote_count）→ B（recall 組 past；刪 excerptJsonl；閘門 iii；選槽）→ C（改 0.5 測規；Writer 台詞禁 verbatim；changelog／VERSION／AGENTS；出貨刪 backlog `memory-situations`）。

每 Track 結束跑相關測試；全部結束跑 `bun test`。實作開始時 INDEX → `in progress`；`shipped` 僅在驗收與測試通過且使用者同意出貨時。

## 禁區

INDEX 非目標。勿 `rm` live `kb/worlds`。勿 hop 舊 quotes。勿給對局 GM 讀檔 tool。勿每回合掃全部 archive。勿做心理欄／歷史 UI。勿改 NPC／session compact 觸發表。

## 完成檢查

- 新 NPC archive 無 `salient_quotes`；index 有 summary、無 `quote_count`
- 回想：summary＋locator；零 quotes／零 jsonl 剪句
- 閘門（iii）離場點名可召
- Writer：台詞字串不得原樣整段進 current
- `bun test` 全綠；VERSION＝`0.8.0`；changelog／AGENTS；刪 backlog 列與檔

## Paste-ready starter prompt

```text
你是 0.8.0 實作 agent。只認檔案，不認 chat history。
先讀 AGENTS.md → docs/roadmap/0.8.0/HANDOFF.md → docs/roadmap/0.8.0/INDEX.md → docs/roadmap/0.8.0/docs/memory-situations.md → docs/roadmap/0.8.0/docs/reasoning.md。
依 Track A→B→C。禁非目標。INDEX 已定案不要再問；沉默才提問。
繁體中文書面語。不要 git commit，除非使用者明確要求。
勿 rm 專案 live kb/worlds。測試用 VIBE_GAMEVERSE_KB_WORLDS／隔離 runtime 慣例。
```
