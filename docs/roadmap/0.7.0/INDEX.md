# 0.7.0 多世界存檔

- 上游：[0.6.0 Compact 分 scope 與同回合平行](../0.6.0/INDEX.md)（`shipped`）
- 構想來源：原 `backlog/multi-world-saves.md`（出貨後已刪；**契約以本 INDEX＋docs 為準**）
- Changelog：出貨時寫根目錄 [`changelog.md`](../../../changelog.md)；同步 `VERSION.md` 與 `AGENTS.md`
- 狀態：`shipped`
- 日期：2026-09-09（Asia/Hong_Kong）

## 產品句

玩家可以同時保留幾個已開打的故事存檔，各自一份完整 KB／pi session／NPC 記憶，從主頁載入或遊玩中回主頁再切。開新故事不得抹掉其他存檔。每個存檔只有一條一直 run 的紀錄——不是同一世界再複製多個 SAVE 槽。

## 文件地圖

閱讀順序：

1. 本檔（WHAT）
2. [`docs/multi-world.md`](./docs/multi-world.md)（HOW：路徑、畫面、HTTP）
3. [`docs/reasoning.md`](./docs/reasoning.md)（WHY）

規格對照（勿當本版契約）：`docs/handover.md`、`docs/brainstorm.md`、根目錄 `AGENTS.md`、[0.6.0 INDEX](../0.6.0/INDEX.md)。Default／custom **生成契約**仍認 [0.2.0](../0.2.0/INDEX.md)／[0.3.0](../0.3.0/INDEX.md)（本版改的是落盤**目錄**與選單，不是 primer 規則）。

**開工前仍須拍板：** 無。

## 與上一版對照

| 行為 | [0.6.0](../0.6.0/INDEX.md) 現行 | 0.7.0 |
|------|-------------------------------|--------|
| 路徑 | 一份 `kb/runtime/` | `kb/worlds/{uuid}/` 各一份完整 runtime；gitignore `kb/worlds/` |
| 開畫面 | 無有效 world → default／custom 二選 | **主頁**：開始新故事／載入存檔故事。不因磁碟上有存檔就自動進對局 |
| 新遊戲 | `POST /api/new-game` 清空**同一** runtime | **廢此語意**。開新＝新 uuid 目錄；回主頁＝dispose、清 pointer、**不清**其他目錄 |
| 重開 `bun start` | ready 則 `continueRecent` 該 runtime | **一律主頁**；不自動 continue。載入後才 continue **該 uuid** 的 jsonl |
| 舊 `kb/runtime/` | 唯一 playthrough | **本版不讀、不搬、不自動刪** |

## 已定案

1. **範圍。** 本版做：多份世界目錄、主頁／載入／遊玩中回主頁、遊玩中刪目前這份（確認字串）、開新故事時使用者自訂**存檔顯示名**。不做同一世界多槽、匯出、雲同步、結構世代 hop、不處理舊 `kb/runtime`。
2. **Parent 路徑鎖定 `kb/worlds/`。** 否決 `kb/stories/`（見 reasoning）。每個存檔：`kb/worlds/{save_id}/*`，其中 `save_id`＝**隨機 UUID**（目錄名＝identifier，禁止 title／存檔名當路徑）。該目錄內容＝今日一份 `kb/runtime/`（`world.json`、entities、play-sessions、npc-memory 等）。
3. **顯示名＝`save_name`，寫在 `world.json`。** 開新故事時使用者輸入 **save_name**（trim 後 UTF-16 長度 1–40；空則 400）。**不再另開 `save.json`，也不再另存 `title`。** Header／`<title>`／對局 placeholder／載入清單皆用 `save_name`。Default／custom 生成器若仍產出 title，**落盤時丟棄**，以使用者 `save_name` 為準。禁止把 `save_name` 寫進 GM prompt／primer／canon（僅 UI／清單）。允許不同存檔同名（靠 uuid 區分）。
4. **`world.json` 形狀。** 每個 `{uuid}/world.json`：`{ "id": "<同一 uuid>", "source": "default"|"custom", "save_name": string, "created_at": string }`。`id` 必須與目錄名一致，否則該目錄不當可載入。
5. **目前在玩哪一個＝pointer。** `kb/worlds/current.json`：`{ "id": "<uuid>" }`。**僅遊玩中**存在且有效。主頁、開機、回主頁後：**刪除或不得留下有效 pointer**（HOW：刪檔）。Turn／Writer／compact／對局 session 只打 pointer 指向的目錄。無有效 pointer 時禁止 `POST /api/turn`（409，畫面為主頁，不是舊的「單一 runtime needs_setup」）。
6. **舊 `kb/runtime/`：本版不處理。** 不 hop、不掃描當存檔、不在啟動時 `rm`。程式預設路徑改讀 `kb/worlds/`。開發者可自行刪舊目錄。禁止把舊 runtime 當第一個世界搬進去。
7. **一存檔＝一目錄＝一條時間線。** 禁止另存新檔、分支周目、產品上「同一 title 開第二條時間線」。重打同一模板＝開始新故事（新 uuid）；舊的仍留。Compact 仍只發生在 **目前 pointer** 那份內（0.5.0／0.6.0 trigger 語意不變）。
8. **開新故事不得刪其他 uuid 目錄。** 禁止把今日 `POST /api/new-game` 的「清空 runtime」做成開新。廢「清空唯一 runtime 再選劇本」為主路徑。
9. **畫面（拍板）。**
    - **主頁：** 兩個入口——「開始新故事」「載入存檔故事」。中性 chrome（非某局 `save_name`）。無對局氣泡、輸入停用。
    - **開始新故事：** 先要合法 save name，再走既有 default／custom（custom 四欄與生成契約不變）。成功才建 `{uuid}`、寫入 `world.json`（含 id／save_name）、原子 commit 只進該目錄、寫 pointer、`createPlaySession`、**自動跑一回合開場**（隱含中性句「我環顧四周。」；回應帶 `opening`；UI 不顯示該玩家句）、進遊玩。失敗不留半套目錄（與 0.2.0 原子 commit 同精神，作用於新 uuid）。
    - **載入存檔故事：** 清單只含 **可玩** 項（該 uuid 通過與現行 `syncWorldGate` 等價的 ready：有效 `world.json`；custom 尚須非空 `gm_canon.md`；且 `world.json.id`＝目錄名）。半套／損壞 **不列出、不可載入**。選中：dispose 若有舊 session → 寫 pointer → 該目錄有 jsonl 則 `continueRecent`，system 依該世界 `world.source`。若尚無 episode（極罕見）同樣跑開場；已有 episode 則 `opening: null`。
    - **遊玩中：** 對局 UI。選項至少：「回到主頁」「刪除此世界」。
    - **回到主頁：** dispose 對局 session；清 pointer；**不刪**該 uuid 目錄。之後可再從載入進入。
    - **刪除此世界：** 僅刪 **目前 pointer** 這一份（本版載入清單不提供刪除）。選取後 dialog；使用者須輸入精確 `delete`（trim 後全等，大小寫敏感）才執行。成功：recursive 刪該 uuid 目錄、dispose、清 pointer、**回到主頁**。確認字不符或取消：不刪。
10. **開機／重整。** **新 process** 啟動時刪 `current.json` → 第一次 state 為主頁，不自動 continue（推翻 0.2.0「ready 則 continueRecent」）。同 process 內瀏覽器重整：有有效 pointer 則仍 `playing`。啟動時若 pointer 指向缺失／不可玩目錄：刪 pointer，主頁，不 500。
11. **兩個存檔禁止共用**同一 pi session 或 merge KB。切檔必須 dispose 再開／continue **目標 uuid**。
12. **HTTP 形狀（鎖定，細節見 HOW）。** `GET /api/state` 帶 `screen: "home" | "playing"`（開始新故事的 default／custom 子步可仍屬 home，用既有 `setup_status`）。`GET /api/worlds` 清單。`POST /api/worlds/load` `{ id }`：僅 `screen === "home"`（且非 generating）可載入；**playing 時 load → 409**（須先回主頁再切）。id 字串合法但目錄不存在／不可玩 → **409**（與驗收一致；非法 body → 400）。`POST /api/home` 回主頁。`POST /api/worlds/delete` `{ confirm: "delete" }` 只作用於目前 pointer。Setup：`POST /api/setup/default` 與 `/custom` **必帶** `save_name`（custom 另帶 primer）；僅 home 可 setup。**parent 下已有其他可玩 uuid 不得阻擋開新**；禁止沿用「磁碟已有任何 ready 世界 → already ready」閘。廢或改寫 `POST /api/new-game`：不得再清空全部 worlds；實作擇一寫死——(a) 刪除此 route，前端改 `/api/home`；或 (b) 語意完全等於 `POST /api/home`。禁止清 parent；本版不做 410。Turn 與 debug `POST /api/debug/session-compact` 僅 `screen === "playing"`，且只碰 pointer 那份 uuid（非 playing → 409）。
13. **測試／執行期 env。** 執行期只認 `VIBE_GAMEVERSE_KB_WORLDS`＝**parent**（缺則倉庫 `kb/worlds/`）。舊鍵 `VIBE_GAMEVERSE_KB_RUNTIME` **忽略**（不讀、不當單一 runtime、不當 parent）。測試用 WORLDS 指到 temp parent（其下建兩個 uuid 子目錄）。禁止 `rm` 專案 live `kb/runtime` 或 live `kb/worlds`。`bootWorlds()`（server 新 process 啟動呼叫）＝`mkdir` parent 並刪 `current.json`（故開機一律主頁）；平時只保證 parent 存在、空 parent＝主頁／無存檔。禁止空 parent 偷灌 seed。單 uuid 目錄的 ensure／legacy `pi-sessions` 改名以已定案 15／HOW 為準（不是「只保證 parent」就夠）。
14. **gitignore** 加 `kb/worlds/`。不要把玩家存檔推進 git。
15. **單 uuid 內 legacy session 目錄。** 若某 `{uuid}/` 仍有舊名 `pi-sessions/`，在該 uuid **首次**成為有效 pointer（load／setup 成功寫 pointer／ensure 該目錄）時做一次改名為 `play-sessions/`。禁止在 parent 根掃改名；本版仍不處理舊 `kb/runtime/`。

## 開工前仍須拍板

無。

## 非目標

- `kb/stories/`、同一世界多 SAVE 槽、匯出世界包、雲同步、社群分享
- 搬遷／讀取舊 `kb/runtime/`；[kb-runtime-upgrade](../backlog/kb-runtime-upgrade.md) 結構世代標記
- 載入清單上刪除、容量自動刪最舊
- 開機「繼續上次」捷徑（本版只有主頁→載入）
- 多地點／戰鬥／真・多 agent、華麗產品 UI、完整生圖
- 改 compact trigger／兩個 scope

## 驗收

- [x] 空 `kb/worlds/` 開頁＝主頁；無酒館氣泡；turn 409。
- [x] 開始新故事 A（有 save name）→ 只出現 `kb/worlds/{uuidA}/`；再開 B → A 的檔與 session 仍在。
- [x] 載入清單與遊玩中 header／`<title>`／placeholder 皆為 **save_name**（無另存 title）。
- [x] 載入 A 後回主頁再載入 A：KB／pi 接續；回主頁不刪 A。
- [x] 遊玩中刪除：未輸入 `delete` 不刪；輸入 `delete` 後該 uuid 目錄不存在、回主頁、清單不再有 A。
- [x] 半套 uuid 目錄不出現在清單、load 409、不可 turn。
- [x] 開機不自動進對局（即便有完整存檔）。
- [x] 程式不讀、不搬舊 `kb/runtime/`（單測可在測試 parent 旁放 decoy `runtime`，assert 未當存檔）。
- [x] `bun test` 全綠；出貨 VERSION＝`0.7.0`；AGENTS 寫 worlds／主頁／pointer。
- [x] Setup／首次進入無 episode 時自動開場回合；UI 顯示 narration／台詞、不顯示隱含玩家句；已有 episode 的 load 不重跑。

## 實作軌道

### Track A — 目錄、pointer、env

- **做：** `kb/worlds/{uuid}`、`current.json`、env parent、gitignore；對局路徑改跟 pointer；忽略 `kb/runtime`。
- **不做：** hop 舊 runtime；HTTP／UI。
- **驗收：** 兩子目錄並存；無 pointer 時 turn 失敗；測試不碰 live 目錄。

### Track B — HTTP 與 setup commit 目標

- **做：** state `screen`、清單／load／home／delete；setup 帶 `save_name` 寫入新 uuid；廢清空-parent 的 new-game。
- **不做：** 改 custom 生成器劇情規則。
- **驗收：** 開 B 不清 A；delete 確認字；load 半套 409。

### Track C — UI

- **做：** 主頁兩鈕；新故事名稱＋既有 default／custom；載入列表；遊玩中回主頁與刪除 dialog（須輸入 `delete`）。
- **不做：** 清單內刪除、華麗殼。
- **驗收：** 瀏覽器把主頁→新故事／載入／回主頁／刪除點一遍。

### Track D — 測試與出貨文件

- **做：** 上列驗收單測；changelog／VERSION／AGENTS；出貨後 backlog 本列與 `multi-world-saves.md` 刪除。
- **驗收：** `bun test`；契約同步。

## 錨點檔案

| 路徑 | 用途 |
|------|------|
| `program/kb.ts` | `kbWorldsDir`、`bootWorlds`、`clearPointer`／`setActiveWorld`、`syncWorldGate`、`atomicCommitPlaythrough` |
| `program/setup.ts` | default／custom（必帶 `save_name`）、`requestHome`、load／delete／list |
| `program/server.ts` | `/api/state`（`screen`）、`/api/worlds`、load／home／delete、setup、turn；`/api/new-game`＝home |
| `program/gm-pi.ts` | dispose／create／continueRecent；session 目錄跟 active uuid |
| `program/schema.ts` | `WorldSchema`；`SaveMeta`／pointer／state.screen |
| `program/public/` | 主頁兩入口、載入列表、回主頁、刪除 dialog |
| `program/test-runtime-env.ts` | `VIBE_GAMEVERSE_KB_WORLDS`→temp parent |
| `.gitignore` | `kb/runtime/`（舊）；加 `kb/worlds/` |

## 行為約束（實作 agent）

- 繁體中文書面語；不 commit 除非使用者要求。
- 勿 `rm` live `kb/runtime` 或 live `kb/worlds`。例證虛構。
- 先打穿驗收。勿做非目標。
- INDEX 已定案不要再問；沉默才提問。
