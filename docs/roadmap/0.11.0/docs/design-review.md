# Design review — 0.11.0 玩家過強輸入與 GM 控場

- 日期：2026-09-10（Asia/Hong_Kong）
- 輪次：**第 3 輪複審**（初審、第 2 輪複審同日）
- 角色：設計審查（不改 INDEX／HOW／reasoning／HANDOFF／程式；不以本檔當已定案）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收（規劃再收斂 M5–M7 後之**現**稿）；HOW [`overreach.md`](./overreach.md)；WHY [`reasoning.md`](./reasoning.md)；[`../HANDOFF.md`](../HANDOFF.md)；上游 [`0.10.0`](../../0.10.0/INDEX.md)／[`0.9.0`](../../0.9.0/INDEX.md) 已定案 10／14（待判決取代 busy；回應抵達守衛）；構想 [`../../backlog/player-overreach-adjudication.md`](../../backlog/player-overreach-adjudication.md)（非契約）
- 現行程式抽樣：`program/turn.ts`、`program/server.ts`、`program/gm-pi.ts`、`program/schema.ts`、`program/kb.ts`、`program/npc-memory.ts`、`program/setup.ts`、`program/compact.ts`（`runScratchJson`）、`program/public/app.js`、`prompts/gm-contract.md`（本版尚未實作 ≠ 設計 HIGH）
- **總評：** 無未關閉 HIGH。提案在非目標與 POC 禁區內**可自洽**，**非整案不可行**。H1–H3、M1–M7 已寫進 INDEX／HOW／HANDOFF，審查門檻**通過**。應修 **M8**（預設修：放棄未決與進行中 gm-chat／(1)(2) 落盤的完成守衛）。LOW 非阻擋。可開工；建議規劃把 M8 併入 HOW／INDEX 一句後更穩。

## Findings（本輪）

關閉＝已寫進 INDEX／HOW／HANDOFF；仍開＝契約仍分叉；非阻擋＝記錄即可。

### HIGH

#### H1 — 深審第一則與「每一則 meta 輸出 disposition」兩套機器終態 — **關閉**

**初審：** INDEX 定案 3（深審 `{ decision, message }`、silent pass）與定案 8（每一則 meta 輸出 disposition；缺欄→`talk`）互斥；`decision: "pass"` 會被當成 enum 以外值而永遠 pending。

**第 2 輪：** 現稿三套輸出已分階段寫死，無再套用 disposition enum 到深審第一則。

| 階段 | 輸出 | 解析 | 失敗退路 |
|------|------|------|----------|
| 輕量 | `{ "decision": "pass" \| "escalate" }` | 只認 `decision` | 非明確 `pass` → `escalate`（定案 14／HOW 輕量） |
| 深審第一則 | `{ "decision": "pass" \| "discuss", "message" }` | **不**解析 `disposition`；缺該鍵**不得**當 `talk` | 非明確 `pass` → `discuss`（定案 3、14／HOW 深審） |
| `/api/gm-chat` | `disposition` ∈ `talk`｜`pass_original`｜`split`｜`revise`｜`hard_reject` ＋ `message`／patch／constraint | 定案 8 **僅** discuss 之後各則 | 缺欄／enum 以外 → `talk`（定案 8／HOW HTTP） |

INDEX 定案 3、8 與 HOW「深審」「HTTP」、reasoning「為何深審不用 disposition」、HANDOFF 產品摘要／starter 均寫「深審 schema 不是 disposition」。驗收「深審 PASS」亦註 `decision`。

**第 3 輪：** 上列分階段表仍在現稿；定案 3 並改為深審＝獨立短呼叫（見 M5 關閉）。無重開。殘留切換方式曾為 M5，本輪已關。

#### H2 — `skip_overreach` 整段跳閘，與定案 4 硬拒衝突 — **關閉**

**初審：** HOW 把 (1)(2) 寫成整段 skip，可能把未成年人／契約攻擊送進對局 session。

**第 2 輪：** INDEX 定案 4、15 與 HOW「閘門 skip」寫死：`skip_overreach` **只**跳輕量／深審，**仍須硬拒**；命中則不寫對局、回滾本拍 patch、刪 pending、硬拒 HTTP。側欄 `hard_reject` 同形狀。HANDOFF 禁區與 starter 同句。驗收「(1)(2) skip 後仍硬拒」。

**第 3 輪：** 定案 4／15 與 HOW 閘門 skip／終態表仍寫「只跳輕量／深審、仍硬拒」。無重開。殘留公開入口與失敗 HTTP 曾為 M6，本輪已關。

#### H3 — 故事 log 在裁決前寫入玩家句，pending／(3) 未規定撤銷 — **關閉**

**初審：** 未覆寫 0.9.0 立刻寫氣泡；pending 200 未禁 `gm`。

**第 2 輪：** INDEX 定案 5 寫死：玩家氣泡與 `chat_tail` **僅**故事 GM 成功後寫；pending／硬拒／(3) 不得留該句；樂觀插入須撤；pending 200 **無** `gm`；hydrate 不把 `pending.json` 原文灌進 `#log`。HOW「HTTP」「UI」同文。HANDOFF 摘要同句。0.9.0 已定案 2／13 由定案 5 明示覆寫。

**第 3 輪：** 定案 5／HOW HTTP／UI／HANDOFF 仍同文。無重開。

### MEDIUM

#### M1 — 輕量／深審失敗退路與硬拒 HTTP 未寫死 — **關閉**

INDEX 定案 14（輕量→escalate、深審→discuss，禁止 fall through）。定案 4＋HOW「硬拒」：HTTP **200**，`hard_reject: true`，`adjudication: null`，`notice` 固定「此輸入無法進入本場。」，**無** `gm`。驗收已列此形狀。

**第 3 輪：** 仍在。無重開。

#### M2 — 待決鎖集未排除 0.9.0 busy 全鎖 — **關閉**

INDEX 定案 5：待決只鎖 `#input`／`#send`；文案「行為待判決」取代 busy、禁止兩套；**不**鎖 `#go-home`／`#delete-world`；`#restart` 可點但不清 pending、不把未裁決句寫回 `#log`。HOW UI 同文。

**第 2 輪殘留：** gm-chat **等待期間**若套用現行 `setTurnBusy` 仍會全鎖 → 當時 **M7**。

**第 3 輪：** 待決鎖集仍寫死；M7 本輪關閉。無重開 M2。放棄未決與進行中請求的**伺服器**完成守衛 → **M8**（新）。

#### M3 — mock 預設、meta 續寫、boot 清 pending、終態後側欄歷史 — **關閉**

INDEX 定案 12：未命中輕量／深審 hook → `pass`；未命中 meta → `talk`；測試與給人玩同一套。定案 9：每次 `discuss` 開**新** meta session；同一 pending 內 continue。定案 6：終態後只留本頁 client 記憶；F5 且非 pending 時 `gm_chat.messages` 為空。定案 11＋HOW「Meta session 路徑」：`bootWorlds` 先刪 pointer uuid 的 `pending.json` 再刪 pointer。

**第 3 輪：** 仍在。無重開。

#### M4 — (1) 空 patch、切分 context、gm-chat 故事欄位、提交順序 — **關閉**

INDEX 定案 7：空／空白 patch → `talk`；`split_constraint` 為該拍 `GmContext` 可選字串，不落 `gm_note`、不進對玩家 HTTP、不跨拍。定案 15：硬拒 → 非空 patch 先 append → `runTurn(skip)` → **成功才刪** pending；失敗回滾 patch、保持 pending、無 `gm`。HOW 終態表欄位名 `gm`／`turn_id`／`episodes_written`。禁止先刪 pending 再跑故事 GM。

**第 3 輪：** 仍在。空 patch 的對玩家 `message` 改寫曾為 M7，本輪已關。`split` 空 constraint 降 `talk` 時未比照改 `message` → **L8**（非阻擋）。

#### M5 — 同一 meta session 兩套 schema／兩份 prompt 的切換與深審 pass 後生命週期 — **關閉**

**第 2 輪仍開：** INDEX 當時寫 escalate 則新 meta 的第一則即深審；HOW Prompts 卻是兩檔（`adjudicate-deep.md` vs `gm-meta.md`）。現行 `openPiSession` 建立時固定 `systemPromptOverride`，無中途換 system。同一 jsonl 會讓 gm-chat 續出 `decision`（永遠 `talk`）或第一則就 `pass_original`（破壞 silent pass）。深審 `pass` 後是否立刻釋放亦未寫。

**第 3 輪核對（獨立短呼叫 vs gm-meta session）：** 規劃已採第 2 輪建議句 **方案 1**，三檔一致，無分叉。

| 檔 | 現稿 |
|----|------|
| INDEX 定案 3 | escalate → **獨立短呼叫**深審（`adjudicate-deep.md`，**不**建可 continue 的 meta）；`pass` → 故事 GM、立即釋放、**不**留 `gm-meta-sessions/`；`discuss` 才 **新建** meta（`gm-meta.md`），深審 `message` 寫成 pending／側欄第一則 GM，其後 `/api/gm-chat` continue **此** session。禁止假設對局 `openPiSession` 中途改 system；深審與側欄 **兩個** session／短呼叫，不是同一 jsonl 換 schema。 |
| INDEX 定案 9 | **僅** `discuss` 才建 `gm-meta-sessions/`；同一 pending 內 continue；終態後下一則過線再開新 session。 |
| HOW 深審 | 獨立短呼叫；不要寫進 `gm-meta-sessions/` jsonl，不要中途改 systemPrompt。`pass` 釋放短呼叫、不建 meta。`discuss` **此時才** create meta。 |
| HOW Prompts | 兩檔職責仍分：深審無 disposition；`gm-meta.md` 才有。與「兩個呼叫」不再衝突。 |
| reasoning | 「為何深審是獨立短呼叫」整節。 |
| HANDOFF | 產品摘要／禁區／starter：深審獨立短呼叫；勿把深審與側欄塞進同一 jsonl。Track B **不做**把深審寫進可 continue 的 meta jsonl。 |

現碼 `gm-pi.ts` 仍無換 system API（未做 ≠ HIGH）。現碼 `compact.ts` `runScratchJson` 已是「fresh `openPiSession`＋`finally` dispose＋刪 scratch」先例，與定案 3 同構。

殘留（非本條、不重開 MEDIUM）：短呼叫 scratch 目錄未點名；discuss 後第一則 GM 是否寫入 meta jsonl → **L8**。

#### M6 — `skip_overreach` 公開入口與 (1)(2) 失敗時 HTTP 狀態 — **關閉**

**第 2 輪仍開：** skip 不得進公開 schema 未寫死；(1)(2) `runTurn` 失敗未寫 HTTP 狀態；client 對 5xx 可能解鎖故事輸入。

**第 3 輪核對：**

| 題 | 現稿 |
|----|------|
| 公開 schema | INDEX 定案 15／16：`skip_overreach` **不得**出現在 `POST /api/turn` body／公開 `PlayerInputSchema`；僅內部第二參數或內部型別。測試：HTTP 即使帶該鍵仍走完整閘門（zod 剝未知鍵亦同）。HOW「閘門 skip」同句。HANDOFF 禁區／starter 同句。 |
| 對外 vs 內部 409 | INDEX 定案 11：pending 時 **對外** `POST /api/turn` → 409；內部 (1)(2) 的 `runTurn` 不是這條 HTTP。HOW：正處理此 pending 時不要對自己丟 409。 |
| (1)(2) 故事 GM 失敗 | INDEX 定案 15：gm-chat 仍 **200**，`adjudication: { "status": "pending" }`，無 `gm`，可選 `notice`；禁止只丟 5xx 讓 client 解鎖。HOW 閘門 skip：可選 `notice` 固定「故事尚未寫成，請稍後再試或改選 (3) 重寫。」 |

現碼 `PlayerInputSchema` 仍僅 `player_text`／可選 `scene_id`（zod 剝未知鍵）；`server.ts` `runTurn(body)` 尚未分支（未做 ≠ HIGH）。契約已寫死，無重開。

#### M7 — gm-chat 等待鎖集；空 patch 改 `talk` 的 `message` — **關閉**

**第 2 輪仍開：** HOW 未寫 gm-chat 進行中禁止 `setTurnBusy`；空 patch 降 `talk` 時可能沿用模型「已接受」句。

**第 3 輪核對：**

| 題 | 現稿 |
|----|------|
| 等待鎖集 | INDEX 定案 16：gm-chat 請求進行中，故事輸入維持待判決鎖；**不得**對 `#go-home`／`#delete-world` 套 0.9.0 `setTurnBusy` 全鎖；側欄可自鎖防連點。HOW UI「gm-chat 等待中」禁止呼叫現行 `setTurnBusy(true)`；`finally` 若仍 pending 則恢復側欄輸入；終態解鎖時不要「處理中」與「待判決」疊加。HANDOFF 禁區／starter 同句。Track D 同句。 |
| 空 patch `message` | INDEX 定案 16：對玩家 `message` 用 HOW 固定繁中，不要沿用「已接受」類句子。HOW 終態表 `pass_original`：改為「請補充角色為何做得到（會寫入本場已承認能力），或改選 (2)／(3)。」 |

現碼 `setTurnBusy(true)` 仍 disable `#go-home`／`#delete-world`（未做 ≠ HIGH；實作須另鎖故事列、勿複用該函式於 gm-chat）。

殘留：`split` 且 `split_constraint` 空 → 當 `talk`（M4 已關）時，HOW **未**比照改固定 `message` → **L8**。放棄未決與進行中 gm-chat 的**伺服器**落盤守衛未寫 → **M8**。

#### M8 — 放棄未決與進行中 `/api/gm-chat`／(1)(2) 落盤的完成守衛 — **仍開**

定案 5／11／16：待決與 gm-chat 等待 **必須能** `#go-home`／`#delete-world`（放棄未決）；home 刪 `pending.json`、保留 `player-memory/current.json`。定案 15：(1) **先** append 非空 patch **再**內部 `runTurn`，成功才刪 pending。

0.9.0 已定案 13 用 `setTurnBusy` 全鎖避開「等待中回主頁」；本版定案 16 **禁止**該鎖。0.9.0 已定案 14 只寫 **client** 對 `/api/turn` 的回應抵達守衛（非 playing 則不寫 `#log`）。HOW gm-chat 開頭「非 playing → 409」，**未**寫：請求已過該檢查、meta／append／`runTurn` 進行中時，home／delete／load 插入會怎樣。

競態（虛構路徑，不必真跑）：gm-chat 已 append 本拍 patch → 使用者回主頁（刪 pending、dispose、清 pointer、保留 `current.json`）→ 進行中的 `runTurn` 仍可能對該 uuid 寫對局／Writer，或 409 後留下「已承認、故事沒發生」的 `current.json`。此與「回主頁＝放棄未決」（定案 11、reasoning boot 清 pending）分叉。

**為何是 MEDIUM：** 非主路徑（放棄發生在數秒等待內）；產品語意「放棄」已有，缺的是完成守衛。不是整案不可行。預設修。不是 HIGH：主路徑 (1)(2) 成功／`talk` 多輪仍自洽。

**建議寫進 INDEX 或 HOW（擇一須寫死）：**

`POST /api/home`／刪世界／load 他檔一旦開始：進行中的 `/api/gm-chat` **不得**再 `runTurn`、不得重建 `pending.json`。若本拍 `player_memory_patch` 已 append 而故事 GM **尚未成功**，須 **回滾**該段 patch（與定案 15 `runTurn` 失敗相同），不得留下「已承認但本拍沒進故事」的 `current.json`。落盤前重讀 `getScreen`／`pending.json`（或等價 AbortSignal）：非 playing 或 pending 已刪則視為放棄；HTTP 可 409 `not_playing`／`not_pending`。Client 已離場則不寫 `#log`（比照 0.9.0 已定案 14，範圍擴到 gm-chat）。

禁止發明「home 也鎖到 gm-chat 結束」來迴避本條（與定案 16 互斥）。

### LOW

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| L1 | **關閉** | HOW Pending：`created_turn_id` 勿當已發生 episode；故事成功再用當時 `nextTurnId()`。現行 `runTurn` 開頭即 `nextTurnId()`（遞增落盤）；閘門須在消耗 id **之前**結束（pending 空轉不加號）。實作跟 HOW 即可。 |
| L2 | **非阻擋** | 深審 `discuss` 且 `message` 非空但不含 1／2／3：仍靠 GM 文字；不必解析玩家是否說了「二」。HOW 空 `message` 已有固定繁中含 1／2／3。 |
| L3 | **關閉** | HOW 已寫 `requestHome` 不是 `clearPlaythrough`；只刪 `pending.json`。 |
| L4 | **關閉** | HANDOFF 摘要／禁區／starter 已點 skip 仍硬拒、深審非 disposition、氣泡僅成功後保留、gm-chat 等待勿全鎖。 |
| L5 | **非阻擋** | 對玩家 (3)「重輸」＝機器 `revise`。 |
| L6 | **非阻擋** | 0.10.0 `psyche.disposition`（性格）與本版 meta `disposition`（終態 enum）重名。型別／zod 須分開（例如 `GmMetaDisposition`），禁止 overlap 進 `NpcPsyche`。 |
| L7 | **非阻擋** | 硬拒／過線 mock 子字串未在 HOW 列最低集合；驗收已有「瞬殺全場」例。Track E 鎖測試字串即可，瀏覽器過線須用同一套。 |
| L8 | **非阻擋** | （本輪新）(a) 深審短呼叫的 scratch 目錄未點名；禁止寫入 `play-sessions/`（定案 9 已禁終態前寫待裁決原文；定案 3 已禁塞進 `gm-meta-sessions/`）。現碼 `compact.ts` `runScratchJson` 可作同構，不必再發明產品語意。(b) `discuss` 新建 meta 時，深審 `message` 是否寫入 jsonl 一則 assistant、或只放 `pending.messages` 而 gm-chat user 帶 `original_player_text`：未寫死時側欄已顯示的第一則可能與 continue 後 GM 重說；pending 已有原文，實作可自決。(c) `split` 空 `split_constraint` 降 `talk` 時未比照空 patch 改固定 `message`；畫面可能像已切分、輸入列仍待判決。Track C 可比照 M7 一句，非本版新語意。 |

## 驗收對照

| 驗收句（INDEX） | 設計層是否可測 | 缺口 |
|-----------------|----------------|------|
| 無害故事句：無側欄自動展開；Writer／對局 session 與 0.10.0 等價（mock 可測） | 可 | M3 關閉（未命中→pass） |
| 虛構過線句：不寫 events、jsonl／chat_tail／`#log` 無該句直到 (1)(2)；(3) 永不進 | 可 | H3 關閉 |
| 待決：state 還原；故事不可送；「行為待判決」；無假氣泡與未裁決玩家句；無第二套 busy；回主頁／刪世界可點 | 可 | M2／M7 關閉；M8：點回主頁時若 gm-chat 仍在飛，伺服器是否放棄 |
| `POST /api/turn` 於 pending → 409 `adjudication_pending` | 可 | M6 關閉（對外 HTTP；內部 skip 例外已在定案 11／15） |
| 側欄 1／2／3；`talk` 多輪 | 可 | M5 關閉（pi continue 走 `gm-meta.md` disposition） |
| (1) 接受：body 含承認；同一則原句；側欄收起；空 patch 不得解鎖 | 可 | M7 關閉（降 talk 的 message）；M8：放棄時已 append 的 patch |
| (2)：故事輸出；events 無「過線已成功」；constraint 不進 `gm_note`／HTTP | 可 | mock 故事 fixture 仍須 Track E 斷言；L8c 空 constraint 的 message |
| (3)：無 episode／對局 session／`#log` 該句；解鎖 | 可 | H3 關閉 |
| 深審 PASS：不開側欄；schema 為 `decision` | 可 | H1／M5 關閉 |
| 契約攻擊／未成年人：200＋`hard_reject`＋`notice`、無 `gm`；skip 後仍硬拒 | 可 | M1／H2／M6 關閉 |
| 輕量／深審壞 JSON 或失敗：不得當 pass | 可 | M1 關閉 |
| `buildGmContext` 含 `player_memory`；turn HTTP 無該欄 | 可 | 無 |
| setup 空 `player-memory/current.json`（或缺檔當空） | 可 | 無 |
| 刪世界後 uuid（含 `player-memory/`）不在 | 可 | 無 |
| `bootWorlds` 清 pointer 的 pending；回主頁刪 pending、保留 `current.json` | 可 | M3 關閉；現碼 `bootWorlds` 尚未刪 pending（未做 ≠ HIGH）；M8：保留的 `current.json` 勿含未成功本拍 patch |
| `bun test`／出貨文件／backlog | 出貨時 | Track E。定案 16 的 skip HTTP／gm-chat 200 pending／等待不套 `setTurnBusy` 已在已定案本文，驗收清單未逐條列——Track E 仍須覆蓋，不另開 MEDIUM |
| 瀏覽器：主路徑＋過線＋重輸 | 可 | L7 用同一 fixture |

## 與現碼抽樣

現碼未實作本版 ≠ 設計 HIGH。下列為與提案**互斥或必須覆寫**的現行行為。

| 錨點 | 現行 | 0.11.0 現稿 | 與提案關係 |
|------|------|-----------|------------|
| `turn.ts` `runTurn` | 非 playing 才 409；開頭 `nextTurnId()`；一律 GM → Writer → `appendChatTail`；單參數 `raw` | 先硬拒／輕量／深審；pending 不進對局；PASS／(1)(2) 成功才接現行路徑；第二參數 `skipOverreach` 仍硬拒 | 插入點須在 `nextTurnId`／`piGm`／`writeFromGm`／`appendChatTail` **之前**（L1／HOW）。內部 skip 勿走 HTTP 409（M6 關閉）。簽名變更是實作項 |
| `turn.ts` 開場 | `runTurn({ player_text: "我環顧四周。" })` | 開場短路輕量 `pass`；氣泡仍 `hide_player` | HOW 已寫；現碼 `hide_player` 已存在 |
| `server.ts` `POST /api/turn` | `runTurn(body)`，成功必有 `gm`；未攔例外再拋（易 500） | pending 200 無 `gm`；硬拒 200 無 `gm`；已 pending 則 409 | 須分支。body 不得當 skip 入口（M6 關閉） |
| `server.ts` `GET /api/state` | 無 `adjudication`／`gm_chat`；有 `gm_note` | playing 附 pending／`gm_chat`；**不**回 `player_memory` | 未做 ≠ HIGH |
| `gm-pi.ts` `openPiSession` | 單一 `play-sessions/`；`disposePlaySession` 只放對局；`systemPromptOverride` 建立時固定 | 深審：獨立 scratch 短呼叫（比照 compact），dispose、不留 meta。僅 `discuss` 另 `gm-meta-sessions/`；home／load／delete 一併 dispose meta | 未做 ≠ HIGH。M5 關閉：禁止同一 jsonl 換 schema。現碼確實無換 system API |
| `compact.ts` `runScratchJson` | fresh session＋parse JSON＋`finally` dispose＋`rm` jobDir | 深審短呼叫同構可用；**不要**把 scratch 指到 `play-sessions/` 或 `gm-meta-sessions/` | 先例，非契約。L8a |
| `schema.ts` `PlayerInputSchema`／`GmContext` | 無 skip、無 `player_memory`／`split_constraint` | 內部 skip 勿進公開 schema；context 加兩欄 | M6 關閉。現碼 `PlayerInputSchema` 已剝未知鍵，與定案 16 測試句相容 |
| `npc-memory.ts` `buildGmContext` | 只組 NPC 記憶 | 另附 `player_memory: { body }` | 未做 ≠ HIGH |
| `kb.ts` `bootWorlds` | 只 `mkdir`＋`clearPointer()` | 先刪 pointer uuid 的 `pending.json` 再清 pointer | 未做 ≠ HIGH（定案 11 已寫） |
| `setup.ts` `requestHome` | dispose＋`clearPointer`；不刪 uuid 檔 | 另刪該場 `pending.json`；保留 `current.json`；dispose meta | 未做 ≠ HIGH。L3 關閉。M8：若 in-flight 已 append patch，保留的 `current.json` 須回滾本拍 |
| `public/app.js` | submit 先 `add("你")`；成功必讀 `data.gm`；`setTurnBusy` 鎖回主頁／刪世界；`finally` 必撤 busy | 氣泡僅成功後留（或樂觀後撤）；pending 無 `gm`；待判決取代 busy；待決與 gm-chat 等待不鎖回主頁 | **仍互斥**，契約已覆寫（H3／M2／M7）。gm-chat 勿呼叫 `setTurnBusy(true)`。0.9.0 已定案 14 僅 turn fetch；gm-chat 成功後寫氣泡可再 `GET /api/state` 吃 `chat_tail`（定案 5 hydrate 已落盤故事） |
| `prompts/gm-contract.md` | psyche／persona／body；無 `player_memory`／`split_constraint` | 加優先序與切分約束；**不**改 psyche 段 | 未做 ≠ HIGH。L6 命名 |
| `writer.ts` | 不碰玩家檔 | 本版仍不改 `player-memory` | 一致 |

上游 0.10.0 psyche／0.6.0 compact 觸發表與本版正交。backlog 仍寫「深層／側欄 meta 每一則 disposition」等舊句；與 INDEX 衝突時以 INDEX 為準（backlog 已聲明非契約）。

## 修復追蹤表

| ID | 級 | 狀態 | 關閉位置（INDEX 條／HOW 節） |
|----|----|------|------------------------------|
| H1 | HIGH | **關閉** | INDEX 定案 3、8；HOW 深審／Prompts；reasoning 深審不用 disposition；HANDOFF；驗收深審 PASS |
| H2 | HIGH | **關閉** | INDEX 定案 4、15；HOW 閘門 skip／終態表；HANDOFF 禁區／starter |
| H3 | HIGH | **關閉** | INDEX 定案 5、7；HOW HTTP／UI；HANDOFF |
| M1 | MEDIUM | **關閉** | INDEX 定案 4、14；HOW 硬拒／輕量／深審 |
| M2 | MEDIUM | **關閉** | INDEX 定案 5；HOW UI |
| M3 | MEDIUM | **關閉** | INDEX 定案 6、9、11、12；HOW Mock／Meta session 路徑 |
| M4 | MEDIUM | **關閉** | INDEX 定案 7、15；HOW 終態表／player-memory |
| M5 | MEDIUM | **關閉** | INDEX 定案 3、9；HOW 深審／Prompts；reasoning 獨立短呼叫；HANDOFF 摘要／禁區／starter／Track B |
| M6 | MEDIUM | **關閉** | INDEX 定案 11、15、16；HOW 閘門 skip／終態表；HANDOFF 禁區／starter |
| M7 | MEDIUM | **關閉** | INDEX 定案 16；HOW UI「gm-chat 等待中」／終態表空 patch `message`；HANDOFF 禁區／starter；Track D |
| M8 | MEDIUM | **仍開** | — |
| L1 | LOW | **關閉** | HOW Pending 落盤 |
| L2 | LOW | **非阻擋** | — |
| L3 | LOW | **關閉** | HOW player-memory／`requestHome` |
| L4 | LOW | **關閉** | HANDOFF 摘要／禁區／starter |
| L5 | LOW | **非阻擋** | HOW 終態表 `revise` |
| L6 | LOW | **非阻擋** | — |
| L7 | LOW | **非阻擋** | — |
| L8 | LOW | **非阻擋** | — |

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-09-10 | 無「整案不可行」。**有未關閉 HIGH（H1–H3）**，審查門檻未過，不要開實作。應修 M1–M4。 |
| 第 2 輪複審 | 2026-09-10 | 規劃收斂後核對：H1–H3、M1–M4、L1／L3／L4 **關閉**。**無未關閉 HIGH**，門檻通過，**非整案不可行**。應修 **M5**（meta session／prompt 切換）、**M6**（skip 公開入口與失敗 HTTP）、**M7**（gm-chat 等待鎖集與空 patch 的 message）。 |
| 第 3 輪複審 | 2026-09-10 | 再收斂後核對：M5（定案 3／9：獨立短呼叫，僅 discuss 建 meta）、M6（定案 15／16：skip 不進公開 schema；(1)(2) 失敗 HTTP 200 pending）、M7（定案 16：gm-chat 勿 `setTurnBusy` 全鎖；空 patch 固定 message）**關閉**。H1–H3、M1–M4 仍關閉。**無未關閉 HIGH**，門檻通過，**非整案不可行**。應修 **M8**（放棄未決與進行中 gm-chat／(1)(2) 落盤守衛）。L8 非阻擋。 |
