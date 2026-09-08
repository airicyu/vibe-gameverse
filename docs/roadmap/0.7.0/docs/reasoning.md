# 0.7.0 reasoning — 多世界存檔

契約以 [INDEX](../INDEX.md) 為準。本檔只記取捨。例證虛構。

## 為何 `kb/worlds/` 而不是 `kb/stories/`

使用者給兩條路徑。選定 **`kb/worlds/`**：

- 磁碟單位已是 `world.json`／`world.source`／`world.title`；目錄名與既有契約同詞，少一層「story 是存檔還是敘事」的歧義。
- 玩家 UI 用「故事」沒問題（開始新故事／載入存檔故事）；那是 chrome 文案，不必等於資料夾名。
- 遊玩中刪除文案已是「刪除此世界」，與 `worlds/` 一致。

否決 `kb/stories/`：不是錯，只是少對齊 `world.json`。日後若只改文案，不必搬目錄。

## 為何 UUID 目錄 + 另存 save_name

路徑用顯示名會撞名、改名、非法字元。使用者已指定：顯示名自訂、identifier 隨機 UUID。`save.json` 與 `world.title` 分開，避免 custom 生成器 title 覆寫玩家取的存檔名，也避免酒館固定 title 讓清單出現一堆「鏽燈酒館」無法分辨——若玩家把兩個酒館存檔都叫不同 save_name 即可分辨。

允許存檔同名：POC 不做唯一性對話框。

## 為何不 hop `kb/runtime/`

產品未上線。搬遷＝多一套 gate 與失敗模式。開發者可手刪。本版程式當 `kb/runtime/` 不存在即可；測 decoy 以免誤掃。

## 為何廢「ready 則開機 continue」

主頁是第一等畫面。若開機自動進上一局，主頁只在清空後出現，與「載入存檔故事」重複且難切檔。折衷寫在 HOW： **process 啟動刪 pointer**（新 `bun start`＝主頁）；**同 process 內 F5** 仍認 pointer（避免打字中重整掉局）。這是「開機」與「重整」拆開，避免實作 agent 把兩句都做成「每次 GET 都 home」。

## 為何刪除只在遊玩中、且要打 `delete`

載入清單刪除容易誤點。打字確認降低 POC 誤刪；不做成第二個 SAVE 管理後台。

## 為何廢 new-game 清唯一 runtime

那條 API 是單槽時代的「丟棄本場」。多槽下原樣呼叫會變成刪目前 pointer 目錄或誤刪 parent——兩者都要在 HOW 禁掉。回主頁 ≠ 刪存檔。


## 為何併入單一 `world.json`、以 `save_name` 當 title（0.7.0 修訂）

先前拆 `save.json`＋`world.title` 是為了「清單名」與「虛構世界名」分開。實作後二者對玩家重複，且 default 固定「鏽燈酒館」讓清單難辨。改定：只留 `world.json`，`save_name` 同時當存檔名與 UI title；生成器 title 不落盤。
