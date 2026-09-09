# 0.11.0 WHY — 控場

## 為何不在故事 log 談規則

對局 session 與 NPC 台詞一旦混入「這超出合理範圍」，會污染 compact、episode、角色記憶，也破壞沉浸。獨立 GM 頻道讓勸說與重輸 **可以當沒發生在故事裡**。

## 為何兩層而不是每句深審

每句都開 meta 延遲與誤報成本高。輕量先放行明顯無害（點酒、問好、開場環顧）。深層先 silent：收回輕量誤報時玩家無感。只有真要談才開側欄。

漏抓（外掛被 pass）比誤報嚴重，故「已成功／改世界」短句也 escalate。

## 為何 `player-memory` 不像 NPC psyche

NPC 記憶是 GM **要演誰**。玩家人格以 **當下 `player_text`** 為準。自動性格摘要會與玩家換人設衝突。檔案只存世界已承認的事實與能力，供裁決參考，避免 (1) 談成的破例下一拍又擋。

不放進 `npc-memory/`：0.4.0 已定 player 無 `memory_tier`。

## 為何選項用聊天不是三按鈕

少一套產品 UI；玩家用自然語言補充設定。程式仍靠 disposition JSON 解鎖，不靠解析「玩家說了二」。

## 為何無 pending 不准 GM 閒聊

否則會變成平行劇情／第二 GM，超出本版控場範圍。側欄平時只是可打開的歷史＋icon。

## 為何深審是獨立短呼叫

對局 `openPiSession` 建立時固定 system，沒有中途改 prompt 的契約。深審要 `decision`，側欄要 `disposition`。若塞進同一 jsonl，不是續出缺 disposition（永遠 `talk`），就是第一則就 `pass_original`（破壞 silent pass）。故深審用 `adjudicate-deep.md` 短呼叫；只有 `discuss` 才建 `gm-meta.md` session，並把深審 `message` 當第一則 GM。

## 為何深審不用 disposition

深審要能 `pass` 且玩家無感。若第一則也套 `talk`｜`pass_original`…，`decision: "pass"` 會變成非法 enum → 被 coerce 成 `talk` → 永遠 pending，輕量誤報收不回。兩套 schema 分階段，比把 `pass` 塞進 disposition 更不容易解錯。

## 為何 skip 仍跑硬拒

(1)(2) 短路是為了同一過線句不要再進側欄迴圈，不是為了放行未成年人／契約攻擊。詞規若漏網進了側欄、或 meta 誤給 `pass_original`，仍必須在進對局 session 前擋住。

## 為何玩家氣泡等故事 GM 成功才留

0.9.0 樂觀寫入在「每句都會成為故事」時合理。本版 pending／(3) 的產品句是「這拍沒發生」。氣泡若先寫、終態再留，故事頻道就承認了未裁決行動；F5 又對不齊 KB。故覆寫送出時機，或樂觀插入後強制撤銷。

## 為何空 patch 當 talk

(1) 的意義是世界承認破例。空白 patch 下一拍同類能力會再被擋，也無法滿足「body 含承認內容」。維持 pending 請補一句，比 silently 放行更可測。

## 為何每次 discuss 新 meta session

續寫舊勸說會把上一場「已結案的破例談判」當成本場證據。獨立 session 與「終態後不把歷史當故事主軸」一致。本頁 client 記憶足夠看最後一則；F5 非 pending 則空，避免假裝 `pending.json` 還在。

## 為何 boot 也清 pending

新 process `bootWorlds` 刪 pointer、一律主頁，語意同被迫回主頁。若留下 `pending.json`，下次 load 會復活未決，與「回主頁＝放棄未決」分叉。同 process F5 不跑 boot，故仍可 hydrate pending。

## 否決

- **只改 prompt、無結構：** 不可測，events 仍會落地。
- **自動切分不經玩家：** 誤踩無法反悔。
- **故事氣泡確認卡：** 與 NPC 對白混淆；0.9.0 已預留「取代 busy」的是狀態列／側欄，不是 `#log`。
- **每回合技能檢定：** POC 非目標。
