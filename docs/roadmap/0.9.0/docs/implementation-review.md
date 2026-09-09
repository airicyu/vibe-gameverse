# Implementation review — 0.9.0 回合處理中 UI

- 日期：2026-09-09（Asia/Hong_Kong）
- 輪次：**第 2 輪複審**
- 角色：實作審查（不改程式；只認檔案／diff／測試）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收；[`../HANDOFF.md`](../HANDOFF.md)；背景 [`design-review.md`](./design-review.md)（非契約）
- 抽樣錨點：`program/public/app.js`、`index.html`、`styles.css`；`program/server.ts`／`schema.ts`／turn 契約（本版 diff 應無）；出貨文件：`VERSION.md`、`changelog.md`、`AGENTS.md`、`docs/roadmap/backlog/`
- **總評：** 無未關閉 **HIGH**。H1 已關：`showPlay` 恢復 `#send`／`#restart`／`#go-home`／`#delete-world`，回主頁再開局可再送出。M1 出貨文件已齊（VERSION／changelog／AGENTS「處理中」；backlog 列與 `turn-in-progress-ui.md` 已刪）。Track A 主路徑靜態對齊 INDEX。`GM_MODE=mock bun test` 全綠（94 pass／0 fail）。**M2 仍開（待使用者手驗）**：本環境無 Chromium，依已定案 11 **出貨前仍須真瀏覽器一拍**；不阻擋出貨程式判定，但總評必須寫明。同意出貨前請補手驗。

## Findings（本輪）

### HIGH

#### H1 — `not_playing`／回主頁後次要控件與 `#send` 殘留 `disabled`，再進對局無法送出 — **關閉**

**初審題旨：** `setTurnBusy(false)` 在 `!isPlayingVisible()` 時早退，不恢復 `#send`／次要控件；`showPlay` 亦未清，再進對局永久鎖死。

**複審證據（2026-09-09）：** `showPlay`（`app.js` L93–102）已 `disabled = false`：`sendBtn`、`restartBtn`、`goHomeBtn`、`deleteWorldBtn`，並啟用 `#input`。路徑：`not_playing`→`showHome`→`finally`/`setTurnBusy(false)` 早退（隱藏區不啟用／不 focus `#input`，已定案 9）→ 之後 `enterReady`→`showPlay` 恢復送出與次要控件。仍 playing 的 `setTurnBusy(false)` 仍一併恢復上述控件與（面板可見時）`#debug-compact`。

**結果：** 關閉。殘餘：`showPlay` 不碰 `#debug-compact`；僅在 playing 撤 busy 或後續 turn 週期恢復——debug 邊角，非對局鎖死，不重開 H1。

### MEDIUM

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| M1 | **關閉** | `VERSION.md`＝`0.9.0`；`changelog.md` 有「0.9.0 — 回合處理中 UI」節；`AGENTS.md` UI 節一句對局等待可見「處理中」（非 streaming）；`docs/roadmap/backlog/turn-in-progress-ui.md` 已不存在；`backlog/INDEX.md` 已自構想表移除並列入「已出貨、已自本表移除」。 |
| M2 | **仍開（待使用者手驗）** | 本環境 WSL 仍無 Chromium／Chrome binary，未能真開瀏覽器對局送一句。靜態／DOM 已足夠支持**程式**對齊判斷；INDEX 已定案 11 要求「出貨前須在瀏覽器對局真送一句」，靜態截圖不算驗收 → **非阻擋出貨程式**，但出貨同意前須使用者（或有瀏覽器之環境）手驗 busy 出現與撤銷（含 H1 路徑：回主頁再開局可送出）。 |

### LOW

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| L1 | **記錄** | 無 client 單測（INDEX 已定案 11：可加非門檻）。 |
| L2 | **記錄** | busy 文案色 `var(--muted)`；對比待真瀏覽器確認（併 M2）。 |
| L3 | **記錄（緩解）** | backlog 已標 0.9.0 自構想表移除；0.9.0 INDEX 仍 `in progress`（待同意出貨）屬預期，非執行時缺陷。 |

## 驗收對照

| INDEX 驗收句 | 通過／失敗 | 證據（測／檔） |
|--------------|------------|----------------|
| 對局送出後、回應前：可見「處理中」＋ spinner；輸入與送出不可用 | **靜態通過**（瀏覽器待 M2） | `#turn-busy`＋「處理中」＋`.turn-spinner`；`setTurnBusy(true)` 鎖 input／send |
| 成功：GM 氣泡出現後 busy 消失，可再輸入 | **靜態通過**（瀏覽器待 M2） | `finally`→`setTurnBusy(false)` 恢復 |
| 失敗（仍 playing）：錯誤列後 busy 消失，可再輸入 | **靜態通過** | `catch`＋`finally` 撤 busy |
| `not_playing`／回主頁：busy 已撤；隱藏 `#input` 未被 finally 啟用／focus | **通過**（H1 已關） | 早退不啟用／不 focus input；再開局靠 `showPlay` 恢復 send／次要控件 |
| busy 期間：`#go-home`／`#restart`／`#delete-world`（及可見 `#debug-compact`）不可點 | **靜態通過** | `setTurnBusy(true)` 一併 disabled |
| `#log` **沒有**敘事／NPC 樣「處理中」假氣泡 | **通過** | busy 在 `#form` 內，未進 `#log` |
| `POST /api/turn` 形狀與 0.8.0 相同 | **通過** | 契約未改 server／schema（本版為 public UI＋出貨文件） |
| mock 與 pi 同一套 busy（無 `GM_MODE` 關閉分支） | **通過** | `program/public/` 無 `GM_MODE` 關閉分支 |
| `bun test` 全綠；出貨 VERSION＝0.9.0；backlog 本列已刪 | **通過**（手驗除外） | 見下兩節；M2 另列 |

## 已定案核對（重點）

| 已定案 | 實作 | 結果 |
|--------|------|------|
| 2／3／4 setTurnBusy、「處理中」、spinner、禁 log 假氣泡 | `#turn-busy`＋spinner；`aria-live`／`aria-busy` | 對齊 |
| 5／13 鎖 input／send／次要控件；再進對局可點 | `setTurnBusy(true)` 全鎖；`showPlay` 恢復四鈕 | 對齊（H1 關） |
| 8 無 GM_MODE client 分支 | 無 | 對齊 |
| 9 finally 撤 busy；非 playing 勿啟用／focus input | 早退只鎖 input、不 focus | 對齊 |
| 11 出貨前真瀏覽器一拍 | 本環境未做 | M2 |
| 14 回應抵達守衛 | 非 playing 跳過氣泡寫入 | 對齊 |
| 1／非目標 不改 server／schema | public UI＋出貨文件 | 對齊 |
| 12 出貨文件 | VERSION／changelog／AGENTS／backlog 刪檔 | 對齊（M1 關） |

## 測試結果

- 指令：`GM_MODE=mock bun test`（工作目錄根；`program/test-runtime-env.ts` 隔離 `VIBE_GAMEVERSE_KB_WORLDS` tmp parent；未 `rm` live `kb/worlds`／`kb/runtime`）
- 結果：**94 pass，0 fail**，320 `expect()`；6 files；約 1.3–2.0s
- 本版無新增強制測；既有全包未回歸

## 出貨文件核對

| 項 | 狀態 |
|----|------|
| `VERSION.md` = `0.9.0` | **是** |
| `changelog.md` 0.9.0 節 | **是** |
| `AGENTS.md` 一句對局等待「處理中」 | **是**（UI 與 session） |
| backlog 列與 `turn-in-progress-ui.md` 已刪 | **是**（檔不存在；INDEX 已自構想表移除） |

## 瀏覽器手驗

- **未執行**（無 Chromium／系統瀏覽器可用）。
- **出貨前仍須真瀏覽器一拍**（INDEX 已定案 11）：對局送一句確認 busy 出現與撤銷；建議兼測 `not_playing`／回主頁→再開局可送出（H1 回歸）。
- 標記：非阻擋出貨**程式**；阻擋「同意出貨」直至手驗完成。

## 修復追蹤

| ID | 級 | 狀態 | 建議關閉方式 |
|----|----|------|--------------|
| H1 | H | **關閉** | `showPlay` 已恢復 `#send`／次要四控件（複審靜態確認） |
| M1 | M | **關閉** | 出貨文件與 backlog 刪檔已齊 |
| M2 | M | **仍開（待使用者手驗）** | 真瀏覽器對局送一句（mock 或 pi） |
| L1 | L | 記錄 | 可選 client 單測／手驗清單 |
| L2 | L | 記錄 | 真瀏覽器確認 busy 對比 |
| L3 | L | 記錄 | INDEX `in progress` 至同意出貨屬預期 |

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-09-09 | 未關閉 HIGH：H1（回主頁後按鈕殘留 disabled）。M1 出貨文件、M2 瀏覽器手驗待補。`bun test` 全綠（94／0）。主路徑 busy UI 靜態對齊 INDEX；修 H1 並手驗後方可作出貨判斷。 |
| 第 2 輪複審 | 2026-09-09 | **無未關 HIGH。** H1／M1 關閉。M2 仍開（待使用者真瀏覽器一拍；非阻擋程式）。`bun test` 全綠（94／0）。程式側可作出貨就緒判斷；同意出貨前補 M2。 |
