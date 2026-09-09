# 0.12.0 WHY — 多套 Default 模板

## 為何仍是 copy seed，不是生成五套

Default 的價值是 **可測、可 mock、卡司穩定**。五套若每次 LLM 生成，串台與未成年卡司風險上升，也無法保證單場景規模。Custom 已覆蓋「自己寫引子」。

## 為何 `source` 加欄而不是 `default:id`

少改 0.7 gate（可玩＝default 或 custom＋canon）。舊存檔無 `template_id` 當 `rust-lamp` 即可，不必 hop worlds。

## 為何 seed 改子目錄

每套都有 `player.json`，扁平 `kb/seed/` 會撞名。遷酒館進 `rust-lamp/` 是原始碼搬遷，玩家目錄結構不變，故不綁 kb-runtime-upgrade。

## 為何第五套不叫 when-they-cry

商標與原作卡司（含未成年）風險。產品要的是封閉祭典 **結構**。id `mist-rite`、名「霧隱集會所」把參考關係留在 reasoning／backlog，不寫進 UI。

## 為何 commit 必須推導 scene／gm_note，不能只改 copy 路徑

現行 `commitDefaultWorld` 把 `scene.json`、`gm_note`、dirty-set、L2 寫死為酒館。seed 裡的 `tavern.json` 是 **place Entity**，不是 runtime `scene.json`。若只把 copy 改成子目錄、常數不改，選霓虹診所仍會落地瑪拉。psyche 也不可當 seed JSON，否則 `EntitySchema.parse` 失敗。

## 否決

- **主頁仍一顆預設＝隨機模板：** 玩家無法預期卡司；測試也不穩。
- **缺 template_id 當酒館：** HTTP 舊客戶端沉默開錯劇；改為 400 迫使 UI 明示選擇。
- **開 A 讀總表 gm-default.md：** 串台（賽博龐克出現瑪拉）。
- **本版做循環周目：** 與一世界一條紀錄、無戰鬥 POC 衝突。
