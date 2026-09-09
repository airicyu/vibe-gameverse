# HANDOFF — 0.11.0 玩家過強輸入與 GM 控場

**本版已 `shipped`（2026-09-10）。** 本檔是歷史實作交接，**不要**再開實作 session 重做 Track A–E。契約以 [`INDEX.md`](./INDEX.md) 為準；HOW：[`docs/overreach.md`](./docs/overreach.md)；WHY：[`docs/reasoning.md`](./docs/reasoning.md)。

**Do not commit unless the user asks.**

對使用者：繁體中文書面語。

## 讀檔順序

1. `AGENTS.md`
2. [`INDEX.md`](./INDEX.md)（已定案＋驗收已勾）
3. [`docs/overreach.md`](./docs/overreach.md)、[`docs/reasoning.md`](./docs/reasoning.md)
4. 審查：[`docs/design-review.md`](./docs/design-review.md)、[`docs/implementation-review.md`](./docs/implementation-review.md)
5. 錨點：`program/turn.ts`、`program/overreach.ts`、`program/gm-meta.ts`、`program/server.ts`、`program/schema.ts`、`program/kb.ts`、`program/public/*`、`prompts/gm-contract.md`／`adjudicate-*.md`／`gm-meta.md`

## 產品摘要

兩層裁決後才進故事 GM。深審為獨立短呼叫（`decision`）；僅 `discuss` 才建 meta session（disposition）。過線則獨立 GM 側欄談 1／2／3；`player-memory/` 只記事實與已承認能力。Pending 時故事新句＝改寫。Meta 不進 `play-sessions/`。

## 完成檢查（出貨時）

- INDEX 驗收已勾；`bun test` 全綠
- `VERSION.md`／changelog／AGENTS 已寫；backlog 列與 `player-overreach-adjudication.md` 已刪
