# 0.9.0 回合處理中 UI

- 上游：[0.8.0 角色記憶：情景摘要與定位](../0.8.0/INDEX.md)（`shipped`；本版 **不**依賴 0.8.0 出貨或記憶契約，只假設現行對局 Web UI 與 `POST /api/turn` 已可玩）
- 構想來源：原 [backlog/turn-in-progress-ui.md](../backlog/turn-in-progress-ui.md)（出貨後已刪；**契約以本 INDEX 為準**）
- Changelog：根目錄 [`changelog.md`](../../../changelog.md)；同步 `VERSION.md` 與 `AGENTS.md`
- 狀態：`shipped`
- 日期：2026-09-09（Asia/Hong_Kong）

## 產品句

玩家在對局送出一句之後、該次 `POST /api/turn`（含同請求內 Writer／compact）尚未回來時，畫面必須 **看得見正在處理**（文案「處理中」＋簡易 spinner），避免誤以為當機。回來後（成功氣泡或既有錯誤列）立刻撤掉。不改回合契約、不做 streaming。

## 文件地圖

1. 本檔（WHAT／HOW／WHY 皆在此；小改不另開 HOW／reasoning）
2. 開工：[`HANDOFF.md`](./HANDOFF.md)
3. 設計審查：[`docs/design-review.md`](./docs/design-review.md)（不以審查檔當契約）
4. 實作審查：[`docs/implementation-review.md`](./docs/implementation-review.md)

**開工前仍須拍板：** 無。

## 與上一版對照

| 行為 | 現行（至 0.8.0 UI） | 0.9.0 |
|------|---------------------|--------|
| 對局送出後 | `input.disabled = true`；玩家氣泡已進 log；**無**處理中字樣／spinner | 同上 disable，另顯示「處理中」＋ spinner；`finally` 必撤 |
| 主頁 setup／load | `setSetupBusy`／「生成中…」（含 server 端開場 turn） | **不改**；開場不另套一套對局 spinner |
| `POST /api/turn` | 單請求等完整 JSON | **形狀不變** |
| Debug session compact | 按鈕 disable＋「compact 進行中…」 | **不改**（不是對局 turn busy） |

## 已定案

1. **範圍。** 只改對局畫面在 **玩家主動** `POST /api/turn` 等待期間的可見 busy。不改 `program/schema.ts`、GM JSON、Writer、compact 觸發、HTTP path／body／status。不做 SSE／逐字 streaming。不做取消進行中 turn。
2. **何時出現。** `program/public/app.js` 對局 `form` submit：寫入玩家氣泡、清 input、disable 輸入與送出鈕之後立刻設 busy；該 `fetch("/api/turn")` 的 `try`／`catch` **`finally` 必須撤 busy**（成功、4xx、網路錯、`not_playing` 回主頁皆然）。禁止只 disable 不說明。禁止漏撤導致永遠鎖輸入。
3. **文案。** 固定繁中 **「處理中」**（不是「GM 書寫中」、不是無字只轉圈）。與主頁「生成中…」分工：主頁是 setup／生成／開場；對局是這一拍 turn。
4. **位置與形態。** 放在對局 **輸入列**（`#form` 內或緊鄰其上），例如狀態列或送出鈕旁：可見文字「處理中」＋簡易 CSS spinner（`styles.css` 即可，不引外部套件）。**不要**在 `#log` 插一則會被誤認為敘事／NPC 的佔位氣泡（避免與 `narration`／`npc` 氣泡混淆）。`#log` 的 `aria-live` 維持既有；busy 列須能被看見（對比足夠），可用 `aria-live="polite"` 或 `aria-busy` 標在 form／play 區塊，實作擇一，驗收以「肉眼可見＋輔助技術知道 busy」為準。
5. **鎖定。** busy 期間：textarea 與 `#send` 皆 disabled；既有 Enter 送出已擋 `input.disabled`，維持。另見已定案 13（次要控件）。
6. **同一段等待。** 同一次 HTTP 若 server 還跑 NPC／session compact，使用者只感到「這句還沒回來」——**不要**另顯「正在 compact」。本版 **不**讓 server 推送階段。
7. **開場隱含 turn。** `runOpeningTurnIfNeeded` 發生在 setup／load 的 **同一 HTTP 回應之前**。主頁已有「生成中…」／load 忙碌。本版 **不**在進對局後再為開場套 turn spinner。F5／`hydrate` 已 playing、log 空、**沒有**進行中的 `POST /api/turn` → **不要**顯示「處理中」。
8. **`GM_MODE=mock`。** 與 pi **同一套 client busy**，禁止依 mode 分支關掉。mock 可能一閃而過，可接受。
9. **回主頁與 finally。** 若 turn 回 `not_playing`／`needs_setup` 而 `hydrate` 回主頁：busy 仍須在 finally 清掉，主頁不得殘留對局 spinner。finally **必撤** busy；若當下已非 playing（`#play` hidden／剛回主頁），則 **不要** 把 `#input` 設為可編輯、**不要** `focus`——僅在仍 playing 時才 `input.disabled = false` 並 `focus`。禁止為「保留現行 quirk」而在隱藏對局區啟用輸入。
10. **與後續控場。** [0.11.0 玩家過強輸入](../0.11.0/INDEX.md) 若日後有裁決預覽，預覽 UI **取代**本 busy，不要兩套疊加。本版不實作預覽。
11. **測試。** 無強制瀏覽器 e2e。`bun test` 既有全綠。能加的 client 單測可加，非本版門檻。出貨前須在瀏覽器對局 **真送一句**（mock 或 pi）確認 busy 出現與撤銷；靜態截圖不算驗收。
12. **出貨文件。** `VERSION.md`＝`0.9.0`；`changelog.md` 記本版；`AGENTS.md` 一句對局等待可見「處理中」（勿寫成 streaming）。出貨後刪 backlog 本列與 `turn-in-progress-ui.md`。不 hop 存檔。
13. **busy 期間次要控件。** busy 期間一併 `disabled`：`#go-home`、`#restart`、`#delete-world`，以及可見時的 `#debug-compact`。finally 撤 busy 時：若仍 playing，一併恢復這些控件的可點狀態（debug 鈕僅在面板可見時恢復為可點）；若已回主頁，交由 `hydrate`／`showHome`，勿再強制啟用對局列控件。
14. **回應抵達守衛。** turn 的 `fetch` 回應處理開頭：若已非 playing（或 `#play[hidden]`），則 **跳過** 成功／錯誤氣泡寫入，只撤 busy（並遵守已定案 9）。防止與「重開畫面」等競態把氣泡寫進已清空或已離場的 log（busy 期間次要控件已鎖，此條為雙保險）。

## 開工前仍須拍板

無。

## 非目標

- Streaming、進度百分比、假 ETA、階段文案（compact／Writer）
- 取消 turn／AbortController 語意
- 改 setup「生成中…」、改 debug compact 文案
- 華麗產品 UI、生圖、控場預覽
- 改 `POST /api/turn` 或任何 KB／GM 契約

## 驗收

- [x] 對局送出後、回應前：可見「處理中」＋ spinner；輸入與送出不可用。
- [x] 成功：GM 氣泡出現後 busy 消失，可再輸入。
- [x] 失敗（仍 playing）：既有錯誤列出現後 busy 消失，可再輸入（不得永遠 disable）。
- [x] `not_playing`／回主頁：busy 已撤；隱藏對局 `#input` **未被** finally 啟用／focus。
- [x] busy 期間：`#go-home`／`#restart`／`#delete-world`（及可見 `#debug-compact`）不可點。
- [x] `#log` **沒有**一則看起來像敘事／NPC 的「處理中」假氣泡。
- [x] `POST /api/turn` 請求／回應形狀與 0.8.0 相同（本版 diff 不含 schema／server turn 契約）。
- [x] mock 與 pi 皆走同一套 busy（無 `GM_MODE` 關閉分支）。
- [x] `bun test` 全綠；出貨 VERSION＝`0.9.0`；backlog 本列已刪。

（瀏覽器真送一句：出貨前須由使用者在本機瀏覽器確認 busy 出現與撤銷；靜態／DOM 邏輯已對齊。已同意出貨；狀態 `shipped`。）

## 實作軌道

單軌即可。

### Track A — 對局 busy UI

- **做：** `index.html`／`app.js`／`styles.css`：submit 路徑設／撤 busy；文案與 spinner；disable 送出鈕與次要控件（已定案 13）；回應抵達守衛（已定案 14）；finally 對齊已定案 9。
- **不做：** server、schema、setup busy 重寫、debug compact 文案／語意。
- **驗收：** 上列 checklist；瀏覽器真走一拍 turn。

## 錨點檔案

| 路徑 | 用途 |
|------|------|
| `program/public/app.js` | 對局 `form` submit、`input.disabled`、`finally`；`setSetupBusy` **不要**混用 |
| `program/public/index.html` | `#play`、`#log`、`#form`、`#send` |
| `program/public/styles.css` | spinner／busy 列樣式 |
| `program/server.ts` | `/api/turn`：本版 **只讀、不改契約** |

## 行為約束

- 繁體中文書面語；不 commit 除非使用者要求。
- 勿 `rm` live `kb/worlds`。例證虛構。
- 狀態已 `shipped`；後續改動另開版本。
