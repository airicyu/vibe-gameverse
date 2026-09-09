# 0.11.0 玩家過強輸入與 GM 控場

- 上游：[0.10.0 L2 NPC 心理深度](../0.10.0/INDEX.md)（`shipped`）
- 構想來源：[backlog/player-overreach-adjudication.md](../backlog/player-overreach-adjudication.md)（排程後契約以 **本 INDEX＋docs 為準**）
- Changelog：出貨時寫根目錄 [`changelog.md`](../../../changelog.md)；同步 `VERSION.md` 與 `AGENTS.md`
- 狀態：`in progress`
- 日期：2026-09-10（Asia/Hong_Kong）

## 產品句

故事頻道維持自由文字一拍。超過本場合理範圍的行動 **不得** 未經裁決就寫進世界。先做輕量／深層兩層閘門；仍過線則在 **獨立 GM 對話頻道** 談（說服並寫入玩家記憶、切分、或重輸）。未過線與今日相同，側欄不自動跳出。

## 文件地圖

1. 本檔（WHAT）
2. [`docs/overreach.md`](./docs/overreach.md)（HOW：路徑、API、UI、prompt、pending）
3. [`docs/reasoning.md`](./docs/reasoning.md)（WHY）
4. 開工：[`HANDOFF.md`](./HANDOFF.md)
5. 設計審查：[`docs/design-review.md`](./docs/design-review.md)
6. 構想備註：[backlog 本項](../backlog/player-overreach-adjudication.md)（與 INDEX 衝突時 **以 INDEX 為準**）

## 與上一版對照

| 行為 | 0.10.0 現行 | 0.11.0 |
|------|-------------|--------|
| `POST /api/turn` | 一律進對局 GM → Writer | 先輕量／必要時深層；PASS 才進對局 GM；pending 時 409 |
| 過強句 | 模型常順從，events 落地 | 不進對局 session／Writer，直到終態 |
| UI | 送出立刻寫玩家氣泡；busy「處理中」；busy 全鎖含回主頁 | 另 GM 側欄（預設 icon）；待決時「行為待判決」**取代** busy；玩家氣泡／`chat_tail` **僅**故事 GM 成功後寫；待決只鎖故事輸入 |
| 玩家檔 | entity 無 memory_tier；無玩家記憶樹 | `player-memory/current.json`（參考用事實／已承認能力） |
| GM 對話 | 無 | 獨立 meta session；不進故事 jsonl |

## 已定案

1. **範圍。** 做兩層裁決、GM 側欄、pending 狀態、`player-memory/`、硬拒（契約攻擊／未成年人）。不做技能表、戰鬥、玩家 psyche、自動性格 distill、玩家記憶編輯器、故事氣泡確認卡。
2. **合理範圍（類別，相對本場 canon）。** 過線：立刻改寫世界 canon；無代價絕對成功且檔案／canon 未承認該能力；跳過單場景場面；契約攻擊。仍合理：困難嘗試、聲稱強大但未要求世界立刻承認、本場 canon 或 `player-memory` **已承認** 的能力、合法成人向。過線 **不是** 審查 NSFW。
3. **兩層閘門。** `player_text` →（a）硬拒規則 →（b）輕量先裁 `pass`／`escalate` →（c）escalate 則 **獨立短呼叫**深審（prompt＝`adjudicate-deep.md`，**不**建可 continue 的 meta session）且 UI 仍收起 → 深審 `pass` 則故事 GM（玩家無感；立即釋放任何臨時呼叫、**不**留 `gm-meta-sessions/`）→ 深審 `discuss` 才 **新建** meta session（prompt＝`gm-meta.md`），把深審 `message` 寫成 pending／側欄第一則 GM，其後 `/api/gm-chat` continue **此** session。開場隱含句與明顯無害短句應輕量 `pass`。聲稱「已成功／已改世界」即使很短也應 `escalate`。輕量寧可誤報，由深層收回。深審第一則輸出 **僅** `{ "decision": "pass" | "discuss", "message" }`，**不**套定案 8 的 disposition、也**不**因缺 `disposition` 當 `talk`。深審壞 JSON／呼叫失敗／非明確 `pass` → `discuss`（進 pending，不寫對局）；禁止當 `pass`。禁止假設對局 `openPiSession` 能中途改 system；深審與側欄 **兩個** session／短呼叫，不是同一 jsonl 換 schema。
4. **硬拒。** 未成年人、契約攻擊（忽略指令、規定 GM JSON／events）：不開談判側欄；不寫 KB；不進對局 session／`chat_tail`；故事輸入保持可送；不走 (1)(2) 把違禁寫成嘗試。(1)(2) 的 `skip_overreach` **只**跳過輕量／深層過線裁決，**仍須先跑本條硬拒**；命中則不 `runTurn`、不寫對局、已寫的 `player_memory_patch` 須回滾（或硬拒路徑根本不寫）。閘門短路硬拒 HTTP：**200**，`hard_reject: true`，`adjudication: null`，`notice` 為 HOW 固定繁中短句，**無** `gm` 鍵；client 不得插入 narration／玩家氣泡。側欄輪次 `hard_reject`：刪 pending、不 `runTurn`、解鎖故事、同一 `notice` 形狀、無 `gm`。
5. **故事 vs GM 頻道。** 裁決與勸說不進 `#log` 的 narration／NPC 氣泡。玩家氣泡與 `chat_tail` **僅**在故事 GM **已成功**（輕量／深審 PASS，或終態 (1)(2)）後寫入 `#log`。pending、硬拒、(3) 不得留下該句玩家氣泡；若 client 已樂觀插入則須移除。pending 的 HTTP 200 **沒有** `gm` 鍵。開場隱含句仍不顯示玩家氣泡。hydrate 只還原已落盤故事，不把 `pending.json` 的原文灌進 `#log`。待決：故事 `#input`／`#send` disable；輸入列文案固定繁中 **「行為待判決」**（取代 0.9.0 busy，禁止兩套疊加）。`#log` **不**插「待判決」假氣泡。待決 **不**鎖 `#go-home`／`#delete-world`（須能放棄未決）。`#restart` 可點但**不清** pending、不把未裁決句寫回 `#log`。0.9.0 已定案 2「submit 立刻寫玩家氣泡」與已定案 13 busy 全鎖：本版在閘門／pending 路徑覆寫如上；PASS 且無 pending 時仍可先顯示 busy「處理中」，回來後寫氣泡（或等價：成功後一次寫玩家＋敘事）。
6. **側欄。** 預設收成小 icon，不佔主欄。玩家可手動開收。僅深審 `discuss` 時自動展開；終態後自動收起。終態後該場 GM 文字 **只留本頁 client 記憶**（可手動再打開看最後一則）；**不**另存磁碟側欄尾。F5 且非 pending 時 `gm_chat.messages` 為空。選項用 **GM 文字** 列出 1／2／3，玩家自由回覆；**不**做三顆必選按鈕（可選輔助鈕但非門檻）。
7. **側欄三條終態。** (1) 說服：可多輪；接受則程式寫 `player-memory` 後以 **原** `player_text` 跑故事 GM。(2) 切分：故事 GM 帶約束；`events[]` 只反映成立段／失敗嘗試，禁止把過線寫成已發生。(3) 重輸：丟原句，不解進對局 session／`chat_tail`／`#log`。深審第一次 `pass` 不開側欄。`pass_original` 且 `player_memory_patch` 空白或僅空白字元 → 當 `talk`（保持 pending，請補承認內容），禁止無新事實就放行。`split_constraint` 為 **該拍** `GmContext` 可選字串，不落 `gm_note`、不進對玩家 HTTP、不跨拍自動帶入。
8. **側欄機器終態。** **僅** `discuss` 之後的 `/api/gm-chat` 各則使用 disposition：`talk`｜`pass_original`｜`split`｜`revise`｜`hard_reject`（側欄輪次通常不用 `hard_reject`；硬拒走定案 4）。深審第一則 **不是** 本條。另見 HOW 欄位（`message`、`player_memory_patch`、`split_constraint`）。無合法 JSON／缺 disposition／enum 以外值 → 當 `talk`（保持 pending；`message` 缺則 HOW 固定繁中），禁止因此解鎖故事。
9. **Session 隔離。** 對局 `play-sessions/` **禁止**在終態前寫入待裁決的 `player_text`。Meta 用獨立目錄與獨立 pi session（HOW 路徑）。**僅** `discuss` 才建 `gm-meta-sessions/`；同一 pending 內 `/api/gm-chat` continue 該 session；終態後下一則過線再開新 session（禁止把上一場勸說帶進下一場）。`disposePlaySession`／home／load／delete 一併釋放 meta。勸說 jsonl **不**當 Writer 輸入、不進 `npc_memories`、不進對玩家故事 HTTP。
10. **`player-memory/`。** 路徑 `kb/worlds/{uuid}/player-memory/current.json`。形狀見 HOW。不進 `npc-memory/`，不套 L2 psyche 六欄。讀：故事 GM、輕量／深層、meta（context 欄 `player_memory`）。**不**進對玩家 turn HTTP。優先序：本回合 `player_text` ＞ 玩家檔事實 ＞ 世界 KB。禁止用記憶否決這拍人格。本版 **只** 在 (1) 接受時用程式合併 `player_memory_patch`；Writer **不**機械改此檔。Setup 寫空 body。刪世界 recursive 刪該目錄；回主頁保留 `current.json`、刪 `pending.json`。不 hop 舊存檔（缺檔＝空 body）。
11. **Pending。** 存該 uuid（HOW 檔）。F5／同 process hydrate 若仍 pending：故事鎖、「行為待判決」、側欄展開並還原 GM 訊息。pending 時 **對外** `POST /api/turn` → **409** `adjudication_pending`（內部 (1)(2) 的 `runTurn` 不是這條 HTTP，見定案 15）。僅 `POST /api/gm-chat`（或 HOW 等價）推進 meta。回主頁／刪世界／load 他檔須清本場 `pending.json`。新 process `bootWorlds` 在刪 pointer **之前**刪當時 pointer uuid 的 `pending.json`（與 home 相同：放棄未決）。
12. **Mock。** 輕量／深層／meta 皆可 hook；給人玩 mock **可**跑閘門（與自動 compact skip 無關）。未命中輕量 hook → `pass`；未命中深審 hook → `pass`；未命中 meta hook → `talk`。過線／深審／meta 用獨立 fixture 子字串（測試與給人玩同一套，勿靠真模型）。測試：過線句不 Writer；PASS 句與今日 turn 等價；破例寫入後同類能力應輕量或深層 PASS。
13. **測試與出貨。** `VIBE_GAMEVERSE_KB_WORLDS`；禁止 `rm` live `kb/worlds`。出貨：`VERSION.md`＝`0.11.0`；changelog；`AGENTS.md`；刪 backlog 本列與 `player-overreach-adjudication.md`。瀏覽器須走：正常一句不開側欄；過線句開側欄；(3) 重輸；(1) 或 (2) 後故事有敘事。
14. **閘門失敗退路。** 輕量呼叫失敗、逾時、或輸出非明確 `pass` → `escalate`。深審呼叫失敗、逾時、或輸出非明確 `pass` → `discuss`。禁止 fall through 當現行 `runTurn`／當 `pass`。
15. **(1)(2) 提交順序。** 先硬拒（定案 4）→ `pass_original` 非空 patch 先 append 玩家檔（失敗則不繼續）→ 內部 `runTurn`（`skip_overreach` 仍硬拒；**不得**出現在 `POST /api/turn` body／公開 `PlayerInputSchema`）→ **故事 GM 成功**才刪 `pending.json`；`runTurn` 失敗則 **回滾** 本拍 patch、**保持** pending。禁止先刪 pending 再跑故事 GM。`/api/gm-chat` 已跑故事且成功：回應含與 turn 相同的 `gm`／`turn_id`／`episodes_written`，`adjudication: null`。無故事（`talk`／`revise`／`hard_reject`）**不得**帶 `gm`。故事 GM 失敗：gm-chat 仍 **200**，`adjudication: { "status": "pending" }`，無 `gm`，可選 `notice`；禁止只丟 5xx 讓 client 把故事輸入解鎖。
16. **skip 與等待鎖。** `skip_overreach` 僅內部第二參數或內部型別。測試：HTTP 即使帶該鍵仍走完整閘門（zod 剝未知鍵亦同）。gm-chat 請求進行中：故事輸入維持待判決鎖；**不得**對 `#go-home`／`#delete-world` 套 0.9.0 `setTurnBusy` 全鎖；側欄輸入可自鎖防連點。空 patch 被降成 `talk` 時，對玩家 `message` 用 HOW 固定繁中（請補承認內容），**不要**沿用模型「已接受」類句子。
17. **放棄未決的完成守衛。** `POST /api/home`／刪世界／load 他檔**一旦開始**：進行中的 `/api/gm-chat` **不得**再內部 `runTurn`、不得重建 `pending.json`。若本拍 `player_memory_patch` 已 append 而故事 GM **尚未成功**，須 **回滾**該段（與定案 15 失敗相同）。落盤前重讀 `getScreen`／`pending.json`（或等價 AbortSignal）：非 playing 或 pending 已刪則視為放棄；HTTP 可 409 `not_playing`／`not_pending`。Client 已離場則不寫 `#log`（比照 0.9.0 已定案 14，範圍含 gm-chat）。禁止用「home 等到 gm-chat 結束才放行」迴避本條（與定案 16 互斥）。

## 開工前仍須拍板

無（輕量手段、終態欄、檔名、meta 目錄、側欄浮層、勸說抗壓已寫進本 INDEX／HOW）。實作前建議 [agent-workflow](../agent-workflow.md) design-review，發現契約洞再改本版文件，勿在碼裡另發明語意。

## 非目標

- 完整 D&D 檢定、戰鬥 round、HP
- 審查合法成人向；每回合強迫選項玩法
- 終態前改 `gm_note`／entities／對局 session／Writer
- 玩家 L2 psyche、自動性格摘要、記憶編輯器 UI
- 華麗 IM、Live2D、生圖
- 改 0.10.0 psyche／0.6.0 compact 觸發表（除 turn 閘門插入點）
- KB `store_version` hop（缺 `player-memory` 當空）

## 驗收

- [ ] 無害故事句：無側欄自動展開；Writer／對局 session 行為與 0.10.0 等價（mock 可測）。
- [ ] 虛構過線句（如瞬殺全場）：不寫 `events` 進 KB、對局 jsonl 無該 user 原文、無該句 `chat_tail`／`#log` 玩家氣泡，直到 (1)(2) 終態；(3) 則永不進。
- [ ] 待決：`GET /api/state` 可還原 pending；故事輸入不可送；文案「行為待判決」；無 `#log` 假氣泡與未裁決玩家句；無第二套 busy；`#go-home`／`#delete-world` 可點。
- [ ] `POST /api/turn` 於 pending → 409 `adjudication_pending`。
- [ ] 側欄 GM 文字含 1／2／3 意涵；玩家回覆可 `talk` 多輪。
- [ ] (1) 接受：`player-memory/current.json` body 含承認內容；隨後故事 GM 跑 **同一則** 原句；側欄收起。空 patch 不得解鎖。
- [ ] (2)：故事輸出存在；落盤 events 不含「過線已成功」；`split_constraint` 不進 `gm_note`／對玩家 HTTP；側欄收起。
- [ ] (3)：無新 episode／無該句對局 session／無該句 `#log` 玩家氣泡；故事輸入解鎖。
- [ ] 深審 PASS（輕量誤報）：不開側欄、故事正常一拍（深審 schema 為 `decision`，不是 disposition）。
- [ ] 契約攻擊／未成年人：不開 (1)(2) 談判；不落盤；HTTP 200＋`hard_reject`＋`notice`、無 `gm`；(1)(2) skip 後仍硬拒。
- [ ] 輕量／深審壞 JSON 或失敗：不得 fall through 當 pass（輕量→escalate，深審→discuss）。
- [ ] `buildGmContext` 含 `player_memory`；turn HTTP **無** 該欄。
- [ ] Default／custom setup 有空 `player-memory/current.json`（或等價缺檔當空且下一寫入建檔）。
- [ ] 刪世界後該 uuid 目錄（含 `player-memory/`）不在。
- [ ] `bootWorlds` 清當時 pointer 的 `pending.json`；回主頁刪 pending、保留 `player-memory/current.json`。
- [ ] `bun test` 全綠；出貨文件與 backlog 清理。
- [ ] 瀏覽器：主路徑 + 過線 + 重輸至少各走一次。

## 實作軌道

### Track A — `player-memory` 與 context

- **做：** schema、path、setup 空檔、`buildGmContext` 附 `player_memory`、gm-contract 優先序、刪世界／clear 一併刪目錄。
- **不做：** 閘門（B）、側欄（D）。

### Track B — 輕量／深層閘門插入 `runTurn`

- **做：** 硬拒 HTTP 形狀；輕量 `pass`／`escalate`；深審獨立短呼叫＋`decision` schema；silent pass 或 discuss 才建 meta；失敗退路（定案 14）；PASS 路徑接現行 GM。Mock hooks（定案 12）。
- **不做：** 側欄 UI（D）；把深審寫進可 continue 的 meta jsonl。

### Track C — Meta session、pending、`/api/gm-chat`

- **做：** 僅 discuss 建 session；pending 落盤；gm-chat API 與 disposition；空 patch→talk 且改 message；(1)(2) 提交順序；內部 skip 勿進公開 schema；home／load／delete／boot 清 pending；dispose meta；故事 GM 失敗仍 200 pending。
- **不做：** 產品 UI 細節（D）。

### Track D — Web UI 雙頻道

- **做：** icon／浮層；自動開收；「行為待判決」取代 busy；hydrate pending；玩家氣泡僅故事成功後寫（或樂觀插入後在 pending／硬拒／(3) 撤銷）；待決與 gm-chat 等待只鎖故事輸入（定案 16）；回主頁／刪世界可點；重開畫面不清 pending。
- **不做：** 華麗 IM。

### Track E — 測試與出貨文件

- **做：** 窄測覆蓋驗收；VERSION／changelog／AGENTS；刪 backlog。

## 錨點檔案

| 路徑 | 用途 |
|------|------|
| `program/turn.ts` | 閘門插入點、pending 時禁故事 turn |
| `program/server.ts` | `/api/turn`、`/api/state`、新 `/api/gm-chat` |
| `program/gm-pi.ts` | 對局 session；本版另接 meta 或新模組 |
| `program/schema.ts` | player-memory、meta 輸出、pending |
| `program/kb.ts` | `player-memory/`、clear／delete |
| `program/writer.ts` | **不**改 player-memory（本版） |
| `prompts/gm-contract.md` | 玩家記憶優先序；切分時 events 禁過線成功 |
| `program/public/app.js`／`index.html`／`styles.css` | 雙頻道 UI、busy 取代 |
| `docs/roadmap/0.9.0/INDEX.md` 已定案 10 | 預覽取代 busy |

## 行為約束

- 繁體中文書面語；不 commit 除非使用者要求。
- 勿 `rm` live `kb/worlds`。例證虛構。
- 狀態 `planned`：實作開始改 `in progress`。
