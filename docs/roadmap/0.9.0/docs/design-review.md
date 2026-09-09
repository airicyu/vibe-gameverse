# Design review — 0.9.0 回合處理中 UI

- 日期：2026-09-09（Asia/Hong_Kong）
- 輪次：**第 2 輪複審**
- 角色：設計審查（不改 INDEX／HOW／reasoning／HANDOFF／程式；不以本檔當已定案）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收（WHAT／HOW／WHY 皆在 INDEX；無獨立 HOW／reasoning；`HANDOFF.md` 仍待閘門後補）；構想備註 [`../../backlog/turn-in-progress-ui.md`](../../backlog/turn-in-progress-ui.md)（非契約）
- 現行程式抽樣：`program/public/app.js`、`program/public/index.html`、`program/public/styles.css`、`program/server.ts`（`/api/turn` 只讀）
- **總評：** 無未關閉 HIGH；M1／M2 已關閉；非整案不可行。對照現 INDEX（已定案 9／13／14 與驗收已收斂初審方案 A，並加回應抵達守衛）。**審查門檻通過**；可依 INDEX Track A 開工（小改；HANDOFF 可選）。

## Findings（本輪）

關閉＝已寫進 INDEX／HOW／HANDOFF；仍開＝契約仍分叉；非阻擋＝記錄即可。

### HIGH

（無）

### MEDIUM

#### M1 — finally 撤 busy 與回主頁後 `input.disabled` 交錯未寫死 — **關閉**

**初審題旨（保留）：** 已定案 5 曾暗示 busy 結束後一律 `input.disabled = false` 並 `focus`；已定案 9 要求 `not_playing` 回主頁時 finally 必撤 busy。現行 `showHome()` 鎖 input，但 submit `finally` 覆寫為可編輯並 `focus`，兩條並陳時實作易強化 quirk 或誤「修好」被當違約。

**本輪核對（對照現 INDEX）：** 已定案 **9** 已採初審方案 A——finally **必撤** busy；若已非 playing（`#play` hidden／剛回主頁），**不要**啟用 `#input`、**不要** `focus`；僅仍 playing 才恢復可編輯並 `focus`。已定案 **5** 不再寫「保留現行 finally quirk」，改指向 13。驗收亦有「隱藏對局 `#input` 未被 finally 啟用／focus」。**關閉位置：** INDEX 已定案 9＋驗收對應句。

#### M2 — busy 期間次要控件（回主頁／重開／刪除／debug）未定 — **關閉**

**初審題旨（保留）：** 僅鎖 textarea／`#send` 時，等待期間仍可點回主頁／重開／刪除／debug，與進行中 `fetch` 競態；INDEX 亦未規範「已離對局則不寫氣泡」。

**本輪核對（對照現 INDEX）：** 已定案 **13** 採方案 A——busy 期間一併 `disabled`：`#go-home`、`#restart`、`#delete-world`、可見時 `#debug-compact`；finally 在仍 playing 時恢復（debug 僅面板可見時），回主頁交由 `hydrate`／`showHome`。已定案 **14** 另寫回應抵達守衛（初審方案 B 之雙保險）——非 playing／`#play[hidden]` 則跳過成功／錯誤氣泡，只撤 busy 並遵守 9。驗收已列次要控件不可點。**關閉位置：** INDEX 已定案 13、14＋驗收「busy 期間次要控件」句。

### LOW

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| L1 | **非阻擋** | 仍無 `HANDOFF.md`。本版標小改；[`agent-workflow.md`](../../agent-workflow.md) 允許自足 INDEX → 實作。可選補薄 HANDOFF，非門檻。 |
| L2 | **關閉** | 現 INDEX 文件地圖第 4 點已鏈 [`docs/design-review.md`](./design-review.md)，並註不以審查檔當契約。 |
| L3 | **非阻擋** | backlog 構想產品句仍有「或等效 spinner」；契約以 INDEX「處理中」＋ spinner 為準，無須為本項改 backlog。 |
| L4 | **非阻擋**（本輪新增） | Track A「做」仍只寫 disable 送出鈕，未點名 13／14 的次要控件與回應守衛。已定案＋驗收已自足；實作須跟已定案，勿只讀 Track 摘要。規劃可選補一句 Track A，非開工阻擋。 |
| L5 | **非阻擋**（本輪新增） | 驗收未單列「已離場則跳過氣泡寫入」（定案 14）。13 已鎖次要控件，主路徑難觸發；14 已在已定案。可選補驗收句，非門檻。 |

## 驗收對照

| 驗收句 | 設計層是否可測 | 缺口 |
|--------|----------------|------|
| 對局送出後、回應前：可見「處理中」＋ spinner；輸入與送出不可用 | 可 | 無 |
| 成功：GM 氣泡出現後 busy 消失，可再輸入 | 可 | 與已定案 9（仍 playing）一致 |
| 失敗（仍 playing）：錯誤列後 busy 消失，可再輸入 | 可 | 無 |
| `not_playing`／回主頁：busy 已撤；隱藏 `#input` 未被 finally 啟用／focus | 可 | M1 已關；對齊已定案 9 |
| busy 期間：`#go-home`／`#restart`／`#delete-world`（及可見 `#debug-compact`）不可點 | 可 | M2 已關；對齊已定案 13 |
| `#log` 沒有敘事／NPC 樣的「處理中」假氣泡 | 可 | 無 |
| `POST /api/turn` 形狀與 0.8.0 相同 | 可 | 已定案 1／非目標／錨點只讀 server |
| mock 與 pi 同一套 busy | 可 | 已定案 8 |
| `bun test` 全綠；VERSION＝0.9.0；backlog 本列已刪 | 出貨時 | 屬實作／出貨；無強制 e2e（已定案 11） |

## 與現碼抽樣

現碼未做本版 ≠ 設計 HIGH。標出與提案差異（實作 Track A 應對齊）：

| 錨點 | 現行 | 0.9.0 提案（現 INDEX） |
|------|------|------------------------|
| `app.js` form submit | 寫入玩家氣泡、清 input、`input.disabled = true`；**無**「處理中」／spinner；`#send` **未** disabled；`finally` **一律** `disabled = false`＋`focus` | 設 busy＋鎖 send／次要控件；finally 撤 busy；非 playing 不啟用／不 focus（9、13） |
| `app.js` `not_playing` | `log` 清空→`hydrate`→`throw`→`catch` 仍 `add` 錯誤氣泡→`finally` 啟用 input | 回主頁後跳過氣泡（14）；finally 只撤 busy、不啟用隱藏 input（9） |
| `app.js` 次要控件 | turn 等待期間 `#go-home`／`#restart`／`#delete-world`／`#debug-compact` 仍可點 | busy 期間一併 disabled（13） |
| `app.js` `setSetupBusy` | 主頁「生成中…」 | **不混用**（已定案 7） |
| `index.html` `#form`／`#log` | `#log` 有 `aria-live="polite"`；form 內無 busy 列 | busy 在 form 內或緊鄰其上；禁止 log 假氣泡 |
| `styles.css` | 無 spinner／turn-busy | 簡易 CSS spinner，不引外部套件 |
| `server.ts` `POST /api/turn` | `runTurn`→JSON；409 `not_playing`／`needs_setup` | **形狀不變**；本版不改契約 |

上游 0.8.0 記憶契約與本版無關。backlog／控場預覽：已定案 10 預留「預覽取代 busy」，本版不實作。

## 修復追蹤表

| ID | 級 | 狀態 | 關閉位置（INDEX 條／HOW 節） |
|----|----|------|------------------------------|
| M1 | MEDIUM | **關閉** | 已定案 **9**；驗收「隱藏 `#input` 未被 finally 啟用／focus」 |
| M2 | MEDIUM | **關閉** | 已定案 **13**、**14**；驗收「busy 期間次要控件」 |
| L1 | LOW | **非阻擋** | —（無 HANDOFF；小改可接受） |
| L2 | LOW | **關閉** | INDEX 文件地圖第 4 點 |
| L3 | LOW | **非阻擋** | —（backlog 措辭） |
| L4 | LOW | **非阻擋** | —（Track A 摘要略短；已定案自足） |
| L5 | LOW | **非阻擋** | —（驗收未單列定案 14；可選） |

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-09-09 | 無 HIGH；非整案不可行；門檻通過。應修 M1（finally／回主頁 input）、M2（busy 期次要控件）。可開工條件：規劃收斂 MEDIUM 或標非阻擋後依 INDEX Track A 實作。 |
| 第 2 輪複審 | 2026-09-09 | 對照現 INDEX：M1→已定案 9；M2→已定案 13＋14；L2 關閉。無未關閉 HIGH；無應修未關 MEDIUM。**審查門檻通過**；提案可行，可開工。 |
