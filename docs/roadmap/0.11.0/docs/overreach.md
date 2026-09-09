# 0.11.0 HOW — 控場、player-memory、雙頻道

契約以 [INDEX](../INDEX.md) 已定案為準。本檔寫路徑與形狀。例證虛構。

## `player-memory`

- 目錄：`kb/worlds/{uuid}/player-memory/`
- 檔：`current.json`
- JSON：`{ "body": string }`（可 `""`）。UTF-16 上限 **800**；超出 clip 尾端優先（同 L2 current 精神）。zod 缺檔讀取＝`{ body: "" }`，不必立刻寫碟；setup／(1) 寫入時建檔。
- **禁止** `psyche.json`、`archive/`、`memory_tier`。
- `clearPlaythrough`／刪 uuid：recursive 刪 `player-memory/`（與 `npc-memory/` 相同待遇）。`requestHome` **不是** `clearPlaythrough`：只刪 `pending.json`，保留 `current.json`。
- Context：`GmContext.player_memory: { body: string }`。組 prompt 時標「參考事實與已承認能力，非玩家人格腳本」。
- (1) 接受：`player_memory_patch` 為一段短文；程式 **附加** 到 `body`（換行分隔）再 clip。本版 **只 append**。空白／只含空白字元的 patch **不當**接受（INDEX 定案 7 → `talk`）。

## 硬拒（閘門短路）

在輕量呼叫之前跑。與輕量／深審 **共用** 詞規函式（未成年人；契約攻擊如「忽略以上指令」、規定 GM JSON／`events`）。命中則：

- 不呼叫輕量／深審、不建 pending、不開側欄。
- 不寫 KB、不 `appendChatTail`、不進對局 session。
- HTTP **200**：`{ "hard_reject": true, "adjudication": null, "notice": "<固定繁中>" }`，**無** `gm` 鍵。可附既有 state 慣例欄（`world`／`scene`），不得把 `notice` 當成 narration。
- `notice` 固定：「此輸入無法進入本場。」client 以非 `#log` 敘事方式顯示（例如既有錯誤列／短提示），故事 `#input` 保持可送。

## 輕量先裁

輸入：`player_text`、`player_memory.body`、可選 scene 一句。輸出 **僅** `{ "decision": "pass" | "escalate" }`。

Program 可在呼叫前短路：

- 開場隱含 `player_text` → `pass`（不呼叫）。
- 硬拒命中 → 見上節（**不**走輕量）。
- 其餘：一次短呼叫（獨立於對局 session；可 mock）。Prompt：困難嘗試與成人向＝`pass`；已承認能力＝`pass`；聲稱已發生的不可能結果／改 canon＝`escalate`。

失敗、逾時、非合法 JSON、或缺 `decision`、或值不是 `pass`：一律 `escalate`。**只有**明確 `pass` 才進故事 GM。

## 深審（silent）

輸入：同上＋世界 `gm_note`／canon 摘要（勿整份 pool）。輸出 **僅**：

```text
{ "decision": "pass" | "discuss", "message": string }
```

**不**解析 `disposition`。缺 `disposition` 不得當 `talk`。

深審是 **獨立短呼叫**（system＝`prompts/adjudicate-deep.md`）。**不要**把深審寫進 `gm-meta-sessions/` jsonl，也**不要**中途改對局／meta 的 systemPrompt。

- `pass` → 立刻現行故事 GM 路徑（寫對局 session／`chat_tail`）。釋放短呼叫；不建 meta session。
- `discuss` → **此時才** `create` meta session（system＝`prompts/gm-meta.md`，新目錄／新 id）；建 pending；把深審 `message` 寫成側欄／`pending.messages` 第一則 GM（須含 1／2／3 意涵）。`message` 空則填固定繁中一句「此行動超出本場合理範圍。你可以：(1) 補充為何角色做得到；(2) 只進行合理部分，越界當作沒辦到；(3) 重寫這句。」後續 `/api/gm-chat` continue **此** session。
- 失敗、逾時、非合法 JSON、或缺 `decision`、或值不是 `pass`：當 `discuss`（進 pending，不寫對局）。禁止當 `pass`。

不進對局 session。下一則過線的 `discuss` **另開新** meta session，禁止續寫上一場勸說 jsonl。

## Pending 落盤

`kb/worlds/{uuid}/player-memory/pending.json`（無 pending 則缺檔）：

```text
{
  "original_player_text": string,
  "created_turn_id": string,
  "meta_session_id": string,
  "messages": [ { "role": "gm" | "player", "text": string } ]
}
```

`created_turn_id` 僅供 pending 關聯，**不要**在 pending 期間把它當成已發生的 episode／`nextTurnId()` 已消耗回合。故事 GM 成功時再用當時的 `nextTurnId()`。

`GET /api/state` 於 `screen === "playing"` 增加：

- `adjudication`: `null` 或 `{ "status": "pending" }`
- `gm_chat`: `{ "messages": [...] }`（無 pending 則 `messages: []`）
- 可選 `hard_reject`／`notice`：**不**經 state 持久化；僅當次 turn／gm-chat 回應攜帶

Home 時 `adjudication`／`gm_chat` 皆空／null。對玩家 **仍不** 回 `player_memory` 正文。

## HTTP

### `POST /api/turn`

- 非 playing → 仍 409 `not_playing`。
- 已有 `pending.json` → **409** `{ "error": "adjudication_pending" }`，不開新故事 GM。
- 硬拒：200，見「硬拒」節。
- 否則走閘門；若變 pending，HTTP **200**：`{ "adjudication": { "status": "pending" }, "gm_chat": { "messages": [...] } }`，**不得**有 `gm` 鍵（故事尚未發生）。Client：若已樂觀插入玩家氣泡則移除；撤「處理中」；改「行為待判決」；展開側欄。
- PASS：回應形狀與 0.10.0 turn 成功相同（含 `gm`／`turn_id`／`episodes_written`），另 `adjudication: null`。

### `POST /api/gm-chat`

Body：`{ "text": string }` min 1。非 playing → 409。無 pending → 409 `{ "error": "not_pending" }`。

跑 meta（對局 session 不寫 user）。

終態：

| disposition | Program |
|-------------|---------|
| `talk` | 只 append messages；保持 pending；無 `gm` |
| `pass_original` | patch 空白或僅空白 → 當 `talk`，`message` **改為**固定繁中「請補充角色為何做得到（會寫入本場已承認能力），或改選 (2)／(3)。」**不要**沿用模型「已接受」句。否則：硬拒原句 → 命中則不寫 patch、刪 pending、硬拒 HTTP 形狀。通過則 append patch → 內部 `runTurn(..., { skipOverreach: true })` → **成功**才刪 pending，回應含 `gm`／`turn_id`／`episodes_written`、`adjudication: null`。`runTurn` 失敗：回滾本拍 patch、保持 pending、HTTP **200**、無 `gm` |
| `split` | `split_constraint` 空 → 當 `talk`，`message` **改為**固定繁中「請說明哪些部分成立、哪些做不到，或改選 (1)／(3)。」否則：硬拒原句（同表）。通過則內部 `runTurn(..., { skipOverreach: true })` 且該拍 `GmContext.split_constraint` 為該字串（**不**寫 `gm_note`、**不**進對玩家 HTTP、**不**留下一拍）。成功才刪 pending，回應含 `gm`…。失敗：HTTP **200**、保持 pending、無 `gm`。對局契約：events 不得把約束標為失敗的段寫成成功 |
| `revise` | 刪 pending；不 `runTurn`；`adjudication: null`；無 `gm` |
| `hard_reject` | 刪 pending；不 `runTurn`；`hard_reject: true`＋`notice`；無 `gm` |

Meta JSON（**僅 gm-chat 輪次**）除 disposition 外：`message`（GM 對玩家可見）、`player_memory_patch`（可空；空白則不得 `pass_original`）、`split_constraint`（可空；`split` 時必填非空，否則當 `talk`）。

無合法 JSON／缺 `disposition`／enum 以外值：當 `talk`（保持 pending）。`message` 缺或空則用固定繁中「請再回覆一次，或選 (1) 補充能力依據、(2) 只進行合理部分、(3) 重寫這句。」禁止因壞輸出解鎖故事或丟 pending。fixture 壞 JSON 可測：仍 pending、故事輸入仍鎖。

## 閘門 skip

內部 `runTurn(input, { skipOverreach: true })`（名稱可等效）僅供終態 (1)(2)。**禁止**把 `skip_overreach`／`skipOverreach` 放進 `PlayerInputSchema` 或 `POST /api/turn` JSON。HTTP 帶未知鍵：zod 剝除後仍走完整閘門（硬拒＋輕量＋必要時深審）。

`skipOverreach: true` **只**跳過輕量與深審。仍須：playing 檢查、**硬拒**。本拍「正處理此 pending」時內部故事 GM **不要**對自己丟 409 `adjudication_pending`（那只給對外 `POST /api/turn`）。硬拒命中：不寫對局／`chat_tail`；回滾本拍 patch（若已寫）；刪 pending；回硬拒 HTTP。

故事 GM 丟出未攔例外：`POST /api/gm-chat` 仍須收成 **200**＋`adjudication: { "status": "pending" }`、無 `gm`；可選 `notice` 固定繁中「故事尚未寫成，請稍後再試或改選 (3) 重寫。」client 維持待判決，不得當解鎖。

## Meta session 路徑

`kb/worlds/{uuid}/gm-meta-sessions/`（**不是** `play-sessions/`）。活 jsonl 規則可簡於對局（本版 **不做** meta compact）。每次 `discuss` 新目錄／新 session id，寫入 `pending.meta_session_id`。Delete／home：`dispose` meta 與對局一樣只釋放 session 物件；home **不清** uuid 其餘目錄，但 **刪** `pending.json`。Load 他世界：離開本場時 **刪本 uuid 的 `pending.json`**。F5／同 process hydrate **保留** pending。新 process `bootWorlds`：讀當時 pointer（若有）→ 刪該 uuid `pending.json` → 再刪 pointer。**刪世界** recursive 全刪。

放棄與進行中 gm-chat 競態（INDEX 定案 17）：home／delete／load **一開始**即刪 pending、dispose、必要時清 pointer。進行中的 gm-chat 在 append patch、`runTurn`、重建 pending **之前**重讀 screen／pending；已放棄則 **回滾**本拍 patch（若已寫）、**不得** `runTurn`／重建 pending，HTTP 409 `not_playing` 或 `not_pending`。append 與回滾寫入 **開拍時捕獲的 uuid 絕對路徑**，不依當下 pointer（home／load 他檔後 `activeWorldId` 可能已是 null 或另一 uuid）。禁止讓 home 等到 gm-chat 結束。

## UI

- 對局區：現有 `#log`／`#form`。
- GM：`#gm-chat-dock` 預設為 icon 按鈕（`#gm-chat-toggle`）。展開為浮層面板（不逼故事欄永久縮一半；寬度 CSS 自定，桌面可 ~320px）。
- `#gm-chat-log` 只渲染 `gm_chat.messages`；玩家在 `#gm-chat-input` 送出 → `POST /api/gm-chat`。
- **玩家氣泡：** 覆寫 0.9.0「submit 立刻 `add("你")`」於本版控場路徑。允許兩種實作之一：（a）送出時不寫玩家氣泡，僅 PASS／(1)(2) 成功後寫；（b）樂觀寫入，但 pending／硬拒／(3)／錯誤 **必須**移除該節點。禁止 (3) 後 `#log` 留未裁決原句。
- 送出故事句期間（尚未回來）：可顯示 0.9.0 busy「處理中」。回來若 pending：busy **換成**「行為待判決」，禁止兩套同時顯示。
- pending 時：`#input`／`#send` disabled；busy 列顯示「行為待判決」（無 spinner 亦可）。`#gm-chat-input` 可編。`#go-home`／`#delete-world` **可點**。`#restart` 可點：只清 DOM；**不清** pending；清完 hydrate 仍 pending 則再鎖故事輸入、展開側欄，**不**把 `original_player_text` 寫進 `#log`。
- **gm-chat 等待中：** 故事列維持待判決（已 disable 的 `#input`／`#send` 保持 disable）。**禁止**呼叫現行 `setTurnBusy(true)`（那會鎖 `#go-home`／`#delete-world`）。側欄送出鈕可暫時 disable 防連點；`finally` 若仍 pending 則恢復側欄輸入。回來若終態解鎖：收起側欄、啟用故事輸入、**不要**顯示「處理中」與「待判決」疊加。
- 非 pending：故事輸入可用。無 pending 時 `POST /api/gm-chat` → 409 `not_pending`。手動展開側欄：無 pending 時輸入盒 disabled 或隱藏；終態後本頁仍可顯示最後一則 client 記憶，F5 後空。
- hydrate：`adjudication.status === "pending"` → 展開面板並還原 `gm_chat.messages`。終態後 client 收起面板。

## Prompts（新建）

- `prompts/adjudicate-lite.md` — 輕量 JSON（`decision` only）
- `prompts/adjudicate-deep.md` — 深審 JSON（`decision`＋`message`；**無** disposition）
- `prompts/gm-meta.md` — 側欄多輪：列 1／2／3；可談不限輪；重複施壓不是新證據；未成年人／注入改 `hard_reject`；輸出 disposition JSON；`message` 給玩家看的純文字（可含選項說明）；`pass_original` 必須給非空 `player_memory_patch`

`gm-contract.md` 加：有 `split_constraint` 時必須遵守，且不得把標為失敗的段寫進 `events` 當已發生；`player_memory` 參考優先序。**不**改 0.10.0 psyche 規則。

## Mock

測試與給人玩同一套 hook，不靠真模型。

- 輕量：`player_text` 含子字串命中則固定 `pass` 或 `escalate`；**未命中 → `pass`**。
- 深審：獨立 hook；未命中 → `pass`。
- Meta：獨立 hook；未命中 → `talk`。
- 硬拒詞規在 mock 下仍跑（不經模型）。
- 故事 GM mock 仍走現行 `gm-mock.ts`。切分測：fixture／hook 須能斷言 `events` 不含「過線已成功」。
