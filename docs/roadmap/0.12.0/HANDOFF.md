# HANDOFF — 0.12.0 多套 Default 模板

**本版已 `shipped`（2026-09-10）。** 本檔是歷史實作交接，**不要**再開實作 session 重做 Track A–D。契約以 [`INDEX.md`](./INDEX.md) 為準；HOW：[`docs/default-templates.md`](./docs/default-templates.md)。

**Do not commit unless the user asks.**

對使用者：繁體中文書面語。

## 讀檔順序

1. `AGENTS.md`
2. [`INDEX.md`](./INDEX.md)（已定案＋驗收已勾）
3. [`docs/default-templates.md`](./docs/default-templates.md)、[`docs/reasoning.md`](./docs/reasoning.md)
4. 審查：[`docs/design-review.md`](./docs/design-review.md)、[`docs/implementation-review.md`](./docs/implementation-review.md)
5. 錨點：`kb/seed/{template_id}/`、`prompts/gm-default/{template_id}.md`、`program/templates.ts`、`program/kb.ts`、`program/setup.ts`、`gm-pi.ts`、`gm-mock.ts`、`schema.ts`、`server.ts`、`program/public/*`

## 產品摘要

五套 Default 子目錄 seed；setup 必帶 `template_id`；對局只讀該套 canon；主頁列出顯示名＋導語。`mist-rite` 原創成年卡司，禁止原作商標。

## 完成檢查（出貨時）

- INDEX 驗收已勾；每套 mock 不串台
- `VERSION.md`＝`0.12.0`；backlog 列與 `default-world-templates.md` 已刪
