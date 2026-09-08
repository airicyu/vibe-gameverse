# 0.1.0 WHY — 先打通酒館記憶迴圈

對照：[`../INDEX.md`](../INDEX.md)。

## 為什麼先鎖死一個酒館

handover／brainstorm 驗收是「玩約 15 分鐘 → 重開 session → NPC 仍記得」，不是大世界。固定一點、兩 NPC、一條線索，才能把 **program 迴圈 + pi 接續 + Writer 落盤** 打穿。選劇本、生成 seed 會讓「空庫要不要灌檔、session 何時建立」變成第二個產品，故留到 0.2.0。

## 為什麼 boot 偷灌 seed

沒有 setup 門時，空 `kb/runtime` 若不 copy seed，開頁沒有實體、沒有開場 scene，GM 與 mock 都沒有卡司。偷灌讓 `bun start` 立刻可玩，也讓測試有一份固定酒館。

0.2.0 產品句改成「先選劇本」之後，偷灌會讓選單永遠來不及出現，因而推翻。

## 為什麼 `resetPiGm` 立刻開 session

本版沒有「選單期」。新遊戲＝再來一局**同一間酒館**，dispose 後馬上 create 可減少空窗。0.2.0 新遊戲必須停在選擇，此語意才變成錯誤。

## 為什麼契約與酒館寫在同一份 `gm.md`

當時只有一種世界。拆檔沒有第二個消費者。代價是 0.2.0 custom 若整份當前綴會汙染瑪拉／紙條。

## 為什麼 coerce 可補酒館

Flash 常漏 `npc_id`／`gm_note`。本版世界只有酒館，補 `bartender` 與酒館 note 能讓 Presenter 不空白。換成多世界後，同一後備會把霧港說成瑪拉。

## 為什麼 Writer 不呼叫模型

回合延遲已經有一次 GM；第二個模型會加倍等待，且 Writer 職責是結構化落盤，適合程式。

## 為什麼不做 compact

接續同一 jsonl 已足夠打通「重開仍記得」（記憶主要在 KB + gm_note + 短 memory_slice）。壓縮策略未定，寫進 backlog 以免塞進 POC。

## 否決（本版）

| 方案 | 否決原因 |
|------|----------|
| 每回合直打 OpenRouter | 已定熱路徑為 pi session；key 也不要出現在本 app HTTP |
| Clone Engram 當遊戲庫 | 混私人生活；過重 |
| 真多 agent NPC | POC 只要面具＋切片 |
| 先做選世界／生成器 | 擋住「記得」驗收 |
