# Implementation review — 0.11.0 玩家過強輸入與 GM 控場

- 日期：2026-09-10（Asia/Hong_Kong）
- 輪次：**第 2 輪複審**
- 角色：實作審查（不改程式；只認檔案／working tree／測試）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收；[`../HANDOFF.md`](../HANDOFF.md)；HOW [`overreach.md`](./overreach.md)；WHY [`reasoning.md`](./reasoning.md)；背景 [`design-review.md`](./design-review.md)（非契約）
- 抽樣錨點：`program/turn.ts`、`program/overreach.ts`、`program/gm-meta.ts`、`program/schema.ts`、`program/kb.ts`、`program/setup.ts`、`program/server.ts`、`program/npc-memory.ts`、`program/gm-mock.ts`、`program/writer.ts`、`program/public/app.js`／`index.html`／`styles.css`；`prompts/gm-contract.md`、`adjudicate-lite.md`、`adjudicate-deep.md`、`gm-meta.md`；測：`program/overreach.test.ts`、`program/npc-memory.test.ts`；出貨文件：`VERSION.md`、`changelog.md`、`AGENTS.md`、`docs/roadmap/backlog/`
- **總評：** 無未關閉 HIGH。定案 17 回滾已改捕獲 uuid 路徑，`loadWorld` 會 bump generation，abandon-after-append 測通過。`GM_MODE=mock bun test` **全綠**（120 pass／0 fail）。M2 已關（2026-09-11 同意出貨：INDEX `shipped`、backlog 列與獨立檔已刪）。M4（瀏覽器實點）仍為非阻擋記錄。已標 `shipped`。

## Findings（本輪）

### HIGH

#### H1 — 定案 17 回滾寫入綁 `activeWorldId`，放棄未決後本拍 patch 可能留下或寫錯檔 — **關閉**

**初審問題：** `runGmChat` catch 以 `savePlayerMemory({ body: prevBody })` 回滾；`activeWorldId == null` 時 no-op。`loadWorld` 不 bump generation，catch 延後可能把 A 的 `prevBody` 寫進 B。

**本輪核對（檔案為準，不盲信「已修待複審」）：**

- `program/gm-meta.ts` 開拍捕獲 `worldId = getActiveWorldId()`。`(1)` 用 `appendPlayerMemoryPatchAt(worldId, …)`；失敗／放棄／硬拒回滾皆 `savePlayerMemoryAt(worldId, { body: prevBody })`，**不**呼叫 pointer 版 `savePlayerMemory`。
- `program/kb.ts`：`savePlayerMemoryAt`／`appendPlayerMemoryPatchAt`／`loadPlayerMemoryAt` 寫 `worldDir(id)/player-memory/`，不依當下 pointer。
- `program/setup.ts` `loadWorld` 在 `setActiveWorld` 前呼叫 `bumpAbandonGeneration()`（home／delete 同樣 bump）。
- 測：`abandon after append rolls back original uuid not the new pointer` — afterAppend 內 `requestHome`＋`loadWorld` 他檔；原 uuid body 回到 append 前、B 的 seed 不變、A 無新 episode；gm-chat 409。本輪該測 **PASS**。

殘留窗口見 **L9**（故事已成功後、刪 pending 前才 abandon 時 catch 仍回滾 patch）；不定案 17 主洞，不擋關閉 H1。

### MEDIUM

#### M1 — 定案 12「破例寫入後同類能力應 PASS」無測；mock fixture 命中仍 escalate — **關閉**

`mockLite`／`mockDeep` 在 `player_text` 含 `OVERREACH_FIXTURE` 時改讀 `loadPlayerMemory()`：`body.trim()` 非空 → `pass`，否則 escalate／discuss。測 `accepted capability then same fixture passes gate` 本輪 **PASS**。Mock 以「非空 body」代理「已承認同類能力」，粒度粗於 PI prompt，給人玩／測同一套已能收回同 fixture。

#### M2 — 出貨清單：backlog 列與獨立檔；INDEX 狀態 — **關閉**（2026-09-11 同意出貨）

`VERSION.md`＝`0.11.0`、`changelog.md` 0.11.0 節、`AGENTS.md` 閘門句已寫。`player-overreach-adjudication.md` 與 backlog 表列已刪；INDEX 已 `shipped`。

#### M3 — 定案 4／14／15 若干退路無專測 — **關閉**

本輪核對測皆 **PASS**：

| 初審缺口 | 測 |
|----------|-----|
| 未成年人硬拒 | `minor harm is hard reject without pending`（`涉及未成年角色`；200 形狀：`hard_reject`、無 `gm`、無 pending） |
| skip 仍硬拒 | `skipOverreach still hard-rejects minor harm`；另 `accept of hard-reject original does not write memory`（(1) 原句硬拒不寫 patch） |
| 深審失敗 discuss | `deep throw becomes discuss not pass`（hook throw → pending、無 `gm`） |
| 故事失敗 200 pending | `story fail keeps pending and rolls back patch`（afterAppend 刪 `scene.json` → `runGmChat` **不拋**、`adjudication.pending`、無 `gm`、body 回空）。HTTP：`server.ts` `Response.json(await runGmChat(body))`，未拋則 **200**；abandon 才 409 |

定案 17 放棄測併入 H1 關閉證據。

#### M4 — 瀏覽器驗收未在本輪執行 — **仍開（非阻擋主路徑；出貨門檻未勾）**

本輪無 browser MCP，**未**開頁點流程。不擋主路徑程式：`app.js` 待判決鎖集與 INDEX 定案 5／16 對齊：

- 故事送出**不**樂觀 `add("你")`；僅 `data.gm` 時 `showStoryGm`
- pending／硬拒無 `gm`；文案「行為待判決」；`turnSpinner.hidden = true`；禁止兩套 busy
- `applyAdjudicationChrome`：鎖 `#input`／`#send`；`#go-home`／`#delete-world`／`#restart` **可點**
- gm-chat 等待**不**呼叫 `setTurnBusy(true)`（全檔僅故事 submit 一處）；只自鎖側欄輸入
- hydrate：`adjudication.status === "pending"` 才展開；不把 pending 原文灌 `#log`

HANDOFF／實作 session 曾用隔離 mock HTTP（localhost）走過無害／過線 pending／revise／split，**本輪未復跑、未當瀏覽器驗收**。INDEX 驗收「瀏覽器：主路徑 + 過線 + 重輸」仍 **未驗證**；同意出貨前須實機點。非 HIGH。

### LOW

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| L1 | **記錄** | `overreach.test.ts` 測名寫「no play-session user line」，仍未讀 `play-sessions/` jsonl；mock pending 不進 `piGm`，風險低。 |
| L2 | **記錄（部分已補）** | `talk keeps pending across two replies` 已補多輪。仍無 `GET /api/state` hydrate pending 專測（`server.ts` 有 `adjudication`／`gm_chat`）；custom setup 空 `player-memory` 無專測（`commitCustomWorld` 有寫檔）。 |
| L3 | **記錄** | `created_turn_id` 恆 `""`；HOW 禁止 pending 消耗 `nextTurnId()`，語意可接受。 |
| L4 | **記錄** | 深審 `discuss` 第一則 GM 只進 `pending.messages`；mock／PI 未把該則寫入 meta jsonl（設計 L8b 允許自決）。 |
| L5 | **記錄** | 側欄 `hard_reject`／`revise` HTTP 另帶 `gm_chat.messages`；HOW 禁的是 `gm` 鍵。 |
| L6 | **記錄** | backlog INDEX「現行產品 0.10.0／0.11.0 `planned`」與 VERSION 0.11.0、本版 INDEX `in progress` 漂移（併 M2）。 |
| L7 | **記錄** | 輕量 PI 呼叫未附 scene 一句（HOW 可選）；深審只送 `gm_note` 前 400 字。 |
| L8 | **記錄** | 切分空 `split_constraint` 已改固定繁中；仍無專測。 |
| L9 | **已修（複審後）** | `runGmChat` 在故事 GM 成功後設 `storyLanded`；其後 abandon／assert 失敗 **不**回滾已發生承認。窗口改為：成功後不抹記憶；home 已刪 pending。 |

## 驗收對照

| INDEX 驗收句 | 通過／失敗 | 證據（測／檔） |
|--------------|------------|----------------|
| 無害故事句：無側欄自動展開；Writer／對局 session 與 0.10.0 等價 | **通過（測）；UI 未跑瀏覽器** | `harmless mock turn…`。UI：僅 `adjudicationPending` 才 `setGmChatOpen(true)`（M4） |
| 虛構過線句：不寫 events、jsonl／chat_tail／`#log` 無該句直到 (1)(2)；(3) 永不進 | **通過（測部分）** | pending：episodes／chat_tail 0、HTTP 無 `gm`；revise 無 episode。jsonl 未斷言（L1）。UI 送出不先 `add("你")` |
| 待決：state 還原；故事不可送；「行為待判決」；無假氣泡；無第二套 busy；回主頁／刪世界可點 | **通過（程式）；缺 HTTP state 測／瀏覽器** | `GET /api/state` 附 `adjudication`／`gm_chat`；`applyAdjudicationChrome` 文案與鎖集。M4／L2 |
| `POST /api/turn` 於 pending → 409 `adjudication_pending` | **通過** | `pending turn is 409…`；`fromPending` 內部不走此 409 |
| 側欄 1／2／3；`talk` 多輪 | **通過（測＋程式）** | `DEEP_DISCUSS_FALLBACK`；`talk keeps pending across two replies` |
| (1) 接受：body 含承認；同一則原句；側欄收起；空 patch 不得解鎖 | **通過** | `accept writes player-memory…`；`empty patch stays pending`；放棄回滾見 H1 關閉 |
| (2)：故事輸出；events 無「過線已成功」；constraint 不進 `gm_note`／HTTP | **通過（測部分）** | `split story has no overreach-success events`；回應無 `split_constraint` 鍵。無 HTTP 鍵專斷言 |
| (3)：無 episode／對局 session／`#log` 該句；解鎖 | **通過（測）** | `revise drops the line`；其後無害句可 `runTurn` |
| 深審 PASS：不開側欄；schema 為 `decision` | **通過** | `DeepAdjudicationSchema` 無 disposition；`lite failure…deep pass is silent` |
| 契約攻擊／未成年人：200＋`hard_reject`＋`notice`、無 `gm`；skip 後仍硬拒 | **通過** | 契約攻擊既有測；未成年人／skip／(1) 原句硬拒本輪皆 PASS（M3 關閉） |
| 輕量／深審壞 JSON 或失敗：不得當 pass | **通過** | lite catch→escalate；deep throw→discuss 有測 |
| `buildGmContext` 含 `player_memory`；turn HTTP 無該欄 | **通過** | `setup writes empty player-memory…`；`npc-memory.test.ts` `"player_memory" in result` false |
| Default／custom setup 有空 `player-memory/current.json` | **通過（Default 有測；custom 有寫檔）** | Default 測檔存在 body `""`；`commitCustomWorld` 同寫。L2 |
| 刪世界後 uuid（含 `player-memory/`）不在 | **通過** | `delete world removes player-memory directory` |
| `bootWorlds` 清 pointer 的 pending；回主頁刪 pending、保留 `current.json` | **通過** | `bootWorlds drops pending…`；`home deletes pending and keeps…`；abandon 回滾見 H1 |
| `bun test` 全綠；出貨文件與 backlog | **測試通過／出貨未完** | 見測試結果；M2 |
| 瀏覽器：主路徑＋過線＋重輸 | **未驗證（本輪）** | 無 browser MCP；程式鎖集對齊。M4 |

## Track 對照

| Track | 預期 | 實作 | 結果 |
|-------|------|------|------|
| A — player-memory 與 context | schema、path、setup 空檔、`buildGmContext` 附 `player_memory`、刪世界／clear | `PlayerMemorySchema`、`kb.ts` load／save／clip 800、`*At` 路徑、兩條 commit 空檔、`gm-contract` 優先序；Writer 不碰此檔 | **對齊** |
| B — 閘門插入 `runTurn` | 硬拒形狀；lite／deep；silent pass 或 discuss；失敗退路；mock hooks | `overreach.ts`；閘門在 `nextTurnId` 前；scratch 在 `compact-scratch` | **對齊**；M1／M3 測已補 |
| C — Meta／pending／gm-chat | 僅 discuss 建 session；disposition；空 patch→talk；(1)(2) 順序；skip 不進公開 schema；home／boot 清 pending；失敗 200 pending | `gm-meta.ts`、捕獲 uuid 回滾、`loadWorld` bump、`PlayerInputSchema` 無 skip | **對齊**（H1 關閉） |
| D — Web UI 雙頻道 | icon／浮層；待判決取代 busy；氣泡僅成功後；gm-chat 勿 `setTurnBusy` 全鎖 | `app.js` 鎖集與定案 16 對齊 | **程式對齊**；M4 未跑瀏覽器 |
| E — 測試與出貨文件 | 窄測、VERSION／changelog／AGENTS、刪 backlog | `overreach.test.ts` 22 則；出貨 trio 已寫；backlog 未刪 | **部分**（M2） |

## 已定案核對（重點）

| 已定案 | 實作 | 結果 |
|--------|------|------|
| 1 範圍 | 無技能表／玩家 psyche／確認卡 | 對齊 |
| 2 合理範圍類別 | prompt＋mock fixture；非 NSFW 審查 | 對齊 |
| 3 兩層閘門；深審獨立短呼叫＋`decision` | `adjudicateLite`／`adjudicateDeep`／`scratchJson`；discuss 才 `createMetaSession` | 對齊 |
| 4 硬拒；skip 仍硬拒 | 硬拒在 skip 之前；未成年人／skip 有測 | **對齊** |
| 5 氣泡僅故事成功；pending 無 `gm`；待判決取代 busy；不鎖回主頁 | turn／gm-chat 分支；`app.js` | 對齊（UI 未實機，M4） |
| 6 側欄 icon；discuss 展開；終態收起；F5 非 pending 則 messages 空 | state 無 pending→`messages: []`；client 終態 `setGmChatOpen(false)` | 對齊 |
| 7 (1)(2)(3)；空 patch→talk；`split_constraint` 該拍 context | `gm-meta.ts`＋`runTurn` opts | 對齊 |
| 8 僅 gm-chat 用 disposition；壞 JSON→talk | `GmMetaOutputSchema`；parse 失敗→talk | 對齊 |
| 9 對局 jsonl 終態前不寫待裁決句；僅 discuss 建 meta | pending 不呼叫 `piGm` | 對齊（L1） |
| 10 `player-memory/` 形狀、不進 HTTP、只 (1) append | clip／Writer 無寫入 | 對齊 |
| 11 pending 落盤；對外 turn 409；boot 先刪 pending | `kb.ts` `bootWorlds`；`runTurn` 409 | 對齊 |
| 12 mock 未命中 lite／deep→pass、meta→talk；承認後同類 PASS | `mockLite`／`mockDeep` 讀 body | **對齊**（M1 關閉） |
| 13 測試隔離 | `test-runtime-env.ts` 設 `VIBE_GAMEVERSE_KB_WORLDS`；強制 mock；未 `rm` live `kb/worlds` | 對齊 |
| 14 失敗不得當 pass | lite→escalate；deep→discuss 有測 | **對齊** |
| 15 (1)(2) 先硬拒、非空 patch、成功才刪 pending；失敗 200 pending | 順序正確；`STORY_FAIL_NOTICE`；故事失敗測 PASS | **對齊** |
| 16 skip 不進公開 schema；gm-chat 勿 `setTurnBusy` | schema＋server `runTurn(body)`；gm-chat 只鎖側欄 | 對齊 |
| 17 放棄未決完成守衛 | 捕獲 uuid 寫入；`loadWorld` bump；abandon 測 | **對齊**（H1 關閉；L9 窗口） |

## 測試結果

- 指令：`GM_MODE=mock bun test`（repo 根；`program/test-runtime-env.ts` 隔離 tmp parent 並強制 `GM_MODE=mock`；**未** `rm` live `kb/worlds`／`kb/runtime`）
- 結果：**120 pass，0 fail**，416 `expect()`；7 files；約 1.46s
- 本版 `program/overreach.test.ts`：22 則（初審 14 則＋本輪修復後 8 則：承認後同 fixture PASS、未成年人硬拒、skip 硬拒、(1) 原句硬拒、深審 throw→discuss、故事失敗 pending、abandon-after-append、`talk` 兩輪）
- 既有全包未回歸（opening／multi-world／npc-memory／compact／world／turn）

## 出貨文件核對

| 項 | 狀態 |
|----|------|
| `VERSION.md` = `0.11.0` | **是** |
| `changelog.md` 0.11.0 節 | **是** |
| `AGENTS.md` 閘門／pending／gm-chat／player-memory | **是** |
| backlog 列與 `player-overreach-adjudication.md` 已刪 | **是**（M2 關） |
| `prompts/adjudicate-lite.md`／`adjudicate-deep.md`／`gm-meta.md` | **是** |
| INDEX 狀態 `shipped` | **是** |

## 修復追蹤

| ID | 級 | 狀態 | 建議關閉方式 |
|----|----|------|--------------|
| H1 | H | **關閉** | `appendPlayerMemoryPatchAt`／`savePlayerMemoryAt`；`loadWorld` bump；測「abandon after append…」本輪 PASS |
| M1 | M | **關閉** | mock 讀 `player_memory.body`；測「accepted capability then same fixture passes gate」PASS |
| M2 | M | **關閉** | 2026-09-11 同意出貨：backlog 列與獨立檔已刪；INDEX → `shipped` |
| M3 | M | **關閉** | 未成年人、skip 硬拒、深審 throw→discuss、故事失敗 200 pending、定案 17 放棄：本輪皆 PASS |
| M4 | M | **仍開（非阻擋主路徑；出貨門檻未勾）** | 瀏覽器實點：無害／過線／(3)／(1) 或 (2)。本輪無 browser MCP；`app.js` 鎖集已對齊 |
| L1–L8 | L | 記錄 | L2 已補 `talk` 多輪；其餘見上表 |
| L9 | L | **已修（複審後）** | `storyLanded`：Writer／故事 GM 已成功則 catch **不**回滾；僅尚未成功才 `savePlayerMemoryAt` |

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-09-10 | 主路徑與 mock 測全綠（112 pass）。**有未關閉 HIGH（H1）**（定案 17 回滾綁 pointer）。M1–M4 仍開。不可出貨。 |
| 第 2 輪複審 | 2026-09-10 | **無未關閉 HIGH。** H1／M1／M3 核對成立並關閉。M2 當時待出貨、M4 瀏覽器未點。`bun test` 120 pass／0 fail。 |
| 出貨同意 | 2026-09-11 | M2 關；INDEX `shipped`；backlog 列與 `player-overreach-adjudication.md` 已刪。M4 仍為非阻擋記錄。 |
