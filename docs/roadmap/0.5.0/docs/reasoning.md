# 0.5.0 WHY — 為何此時 compact、為何這些開關

對照：[`../INDEX.md`](../INDEX.md)。

## 為何與 NPC archive 同一拍

0.4.0 已知：沒有封存時 L2 只能截斷。Compact 把活 jsonl 從 GM 眼前拿掉之後，知情必須改由拍摘要與各角主觀檔接上。若只搬 jsonl、角色 archive 後日補，新 session 會對剛封的那幕失憶。故同一管線、整步回滾。

## 為何 `near_cap` 不開 compact

640 表示這份現用該在**下次**封存時優先壓短。酒館長談很容易先碰到 640，若因此切斷還沒結束的語氣，比暫時讓 current 變長更傷。回收靠 judge／N 回合／強制線。

## 為何取消 800 硬截

硬截會在 compact 之前丟掉舊句，archive 補不回來。800 與 640 若都當 soft，只留 640 即可。池 600 仍是升 2 門檻，與 L2 現用無關。

## 為何不問 `gm_note` 變化

`gm_note` 每回合整份覆寫，措辭一變就會每回合問 judge。同幕對質改鉤子不該等於換幕。無人進出的長對質靠 N 回合或強制線。

## 為何 N 回合是問 judge 不是硬封

寫死每 20 回必封，會在同幕中切開。滿 20 只表示該問；否決則再等 20，避免第 21 回起每回都問。

## 為何強制線不是「下一回 token」

無法預知玩家下一則與 GM 輸出。上一回 `usage.input` 或檔案大小只說明已經多肥。DeepSeek V4 Flash 標稱約 1M；預設 10 萬／40 萬位元組是產品「太肥該封」，不是快撞牆。空隙留給未知的下一則；仍可能賭輸。可調 yaml。

## 為何複製再刪、不先 move

與整步回滾一致：剪到一半時活檔已不在原處，復原會變成另一套產品。POC 雙倍磁碟可接受。

## 為何一層 rollup、啟發式才掃

封存次數是「幕」不是「年」。目錄掃 title／summary 已夠。日曆式 year／month 是另一軸，不 duplicate Engram。每回合掃或讓 GM JSON 點名：前者貴且易灌錯幕，後者漏點就找不到。寧可漏召。

## 為何開場帶 3 回對白

摘要記得情節，接不上剛說的半句。近 8 則 episode 是世界事件句，不是對白。3 回夠接語氣；5 回會把剛要封掉的歷史搬回一大截。不接回舊 session 檔。

## 為何改名 `play-sessions`

`pi-sessions` 是函式庫名。換 agent 時路徑會變成謊言。開機改名一次，不當獨立 KB `store_version` 大項。

## 為何 mock 不自動說要封

給人點 mock 酒館若每 20 回切 session，與「無外網可玩」用途打架。封存正確性靠隔離單測與注入。

## 為何回想不用本回合 events

回想必須餵**本回合** GM，故只能在 GM 前跑。此時尚無本回合 `events[]`／`npc_lines`。若改等 GM 後再掃，細節進不了當回裁決；若拿上回合 events 冒充，會召錯幕。故啟發式只認 `player_text` 與盤上名／id。

## 為何 GM JSON 加 `scene`

0.4.0 對局不落盤 `present`，`scene.json` 停在 setup。本版 6(a) 要以進出問 judge，又禁止用 `gm_note` 字串當開關。故對局 JSON 必填既有 `SceneState`，Writer 在 compact 前寫回。這不是多地點狀態機，也不加回想點名欄。

## 為何 distill 仍 ≥640 算整步失敗

目標是離開 `near_cap`。程式再截會重蹈「compact 前先砍句」；留下 ≥640 則 archive 已寫、dirty 語意半套。與「模型失敗則回滾」同一條。

## 為何 N 否決要落盤錨點

否決後沒有新的 `session-archive` 可推起點。只放記憶體則 `continueRecent` 會從第 N+1 回每回都問。`compact-state.json` 與成功 compact 共用同一錨點欄。

| 方案 | 否決 |
|------|------|
| `scene_id` 一變就封 | 走動仍是同一場戲 |
| 每 N 回硬封 | 同幕切開 |
| `near_cap` 準強制 | 長談誤切 |
| 只 distill NPC、不殺 jsonl | 兩套管線，POC 過肥 |
| jsonl 已封、NPC 後日補 | 半套失憶 |
| Engram 式多層時間塊 | 軸不對；首版 index 夠掃 |
| GM JSON `recall_archive_ids` | 加厚契約、漏點 |
| 用 `gm_note` 解析在場名單 | 每回覆寫、假進出 |
| 回想等本回合 events | 餵不到當回 GM |
| distill 後程式截到 <640 | 重蹈硬截 |
| 活目錄繼續叫 pi-sessions | 用供應商命名 |
