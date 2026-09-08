# 回合處理中 UI（spinner／「處理中」）

**狀態：** backlog 構想，**尚未排入任何 `docs/roadmap/X.Y.Z/`。** 不是承諾範圍；排程前收斂文案與是否涵蓋開場／compact。本檔仍不夠當完整 HANDOFF。

**現行：** `POST /api/turn` 期間，對局輸入框 `disabled`，玩家氣泡已進 log；**沒有**「處理中」字樣、沒有 spinner。真 GM（pi session）一回合可數秒到更久，畫面像卡住。主頁 setup 已有 `setSetupBusy`／「生成中…」，對局 turn **沒有對等狀態**。debug compact 只 disable 按鈕。

本檔**不**改 GM JSON 契約、Writer、compact 規則。例證皆虛構。

與 [玩家過強輸入與 GM 控場](./player-overreach-adjudication.md) 分工：控場若日後有「裁決預覽」狀態，spinner 應讓路給確認 UI，不要兩套 busy 疊在一起。

---

## 產品句（構想）

玩家送出一句、GM（含 Writer／同回合 compact）尚未回來時，對局畫面明確表示 **正在處理**：可見的「處理中」或等效 spinner，避免以為當機。回來後（成功氣泡或錯誤列）立刻撤掉 busy。

---

## 現行行為與缺口

| 層 | 現在 | 缺口 |
|----|------|------|
| 對局輸入 | submit 後 `input.disabled` | 無視覺 busy；空白框＋不能打，像壞掉 |
| log | 只有玩家氣泡 | 無佔位「GM 正在寫」 |
| 開場 | `runOpeningTurnIfNeeded` 可在 load／setup 後打隱含 turn | 未必走同一套 turn busy（待拍板） |
| 主頁 setup | 「生成中…」 | 對局未對齊 |
| HTTP | 單請求等完整 JSON | 無需 streaming 也能做 client busy |

失敗模式：只 disable 不說明 → 玩家連打 F5；或 busy 在 `finally` 漏撤 → 永遠鎖輸入。

---

## 構想範圍（傾向，可推翻）

- **最小：** 送出後顯示系統列或輸入區旁「處理中」＋簡易 CSS spinner；`finally` 清除。送出鈕／Enter 在 busy 時仍擋（已有 `input.disabled`）。
- **不要**為本項做 SSE／逐字 streaming（另案）。
- **不要**為本項改 `POST /api/turn` 形狀。
- 錯誤氣泡仍用現有 err 列；busy 結束後才能再送。
- 同回合 NPC compact／session compact 若拉長等待，**算在同一段 busy**（使用者只感到「這句還沒回來」）。

---

## 非目標（本項）

- 華麗產品 UI、進度百分比、假 ETA。
- 伺服器推送「現在在 compact」。
- 取消進行中的 turn（需另談 abort 與 session 一致性）。
- 取代 setup「生成中…」（可之後視覺對齊，不是本項必做）。

---

## 待拍板

1. 文案：「處理中」／「GM 書寫中」／只 spinner 無字。
2. 位置：log 佔位氣泡 vs 輸入列上方 vs 按鈕內。
3. 開場隱含 turn、load 後第一幀是否同一套。
4. `GM_MODE=mock` 是否也閃一下 busy（測得到、真玩幾乎看不見）。
