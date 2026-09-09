# HANDOFF — 0.9.0 回合處理中 UI

狀態：設計閘門已通過（見 [`docs/design-review.md`](./docs/design-review.md)）。契約以 [`INDEX.md`](./INDEX.md) 為準（小改；WHAT／HOW／WHY 皆在 INDEX）。

**Do not commit unless the user asks.**

對使用者：繁體中文書面語。

## 讀檔順序

1. `AGENTS.md`
2. `docs/roadmap/0.9.0/HANDOFF.md`（本檔）
3. `docs/roadmap/0.9.0/INDEX.md`（已定案＋驗收＋Track A）
4. 錨點：`program/public/app.js`、`index.html`、`styles.css`；`program/server.ts` **只讀** `/api/turn`（不改契約）

只認檔案，不認 chat history。INDEX 已寫的不要再問；沉默才提問。

## 產品摘要

玩家在對局送出一句、`POST /api/turn`（含同請求 Writer／compact）尚未回來時，輸入列可見「處理中」＋簡易 spinner；busy 期間鎖輸入、送出與次要控件。`finally` 必撤 busy；已回主頁則勿啟用隱藏 `#input`。禁止 `#log` 假氣泡。不改回合契約、不做 streaming。

## Track 順序

單軌 **A**：`index.html`／`app.js`／`styles.css`（設／撤 busy、文案、spinner、次要控件、回應守衛）→ 出貨文件（VERSION／changelog／AGENTS；刪 backlog 本列與檔）。

全部結束跑 `bun test`。實作開始時 INDEX → `in progress`；`shipped` 僅在驗收與測試通過且使用者同意出貨時。出貨前須在瀏覽器對局真送一句確認 busy。

## 禁區

INDEX 非目標。勿改 `schema`／server turn 契約／setup「生成中…」／debug compact 文案。勿 SSE。勿 `rm` live `kb/worlds`。勿把本版寫成 streaming。

## 完成檢查

- INDEX 驗收 checklist 可勾
- `bun test` 全綠
- 瀏覽器真走一拍 turn（mock 或 pi）
- 出貨：VERSION＝`0.9.0`；changelog；AGENTS 一句對局「處理中」；刪 backlog 列與 `turn-in-progress-ui.md`

## Paste-ready starter prompt

```text
你是 0.9.0 實作 agent。只認檔案，不認 chat history。
先讀 AGENTS.md → docs/roadmap/0.9.0/HANDOFF.md → docs/roadmap/0.9.0/INDEX.md。
依 Track A。禁非目標。INDEX 已定案不要再問；沉默才提問。
繁體中文書面語。不要 git commit，除非使用者明確要求。
勿改 POST /api/turn 契約。測試用 VIBE_GAMEVERSE_KB_WORLDS 指 temp parent。出貨前瀏覽器真送一句確認 busy。
```
