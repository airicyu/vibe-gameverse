# Design review — 0.7.0 多世界存檔

- 日期：2026-09-09（Asia/Hong_Kong）
- 輪次：**第 2 輪複審**
- 角色：設計審查（不改 INDEX／HOW／reasoning／HANDOFF／程式；不以本檔當已定案）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收（含已定案 12–15 與 HOW 修訂）；[`multi-world.md`](./multi-world.md)（HOW）；[`reasoning.md`](./reasoning.md)（WHY）；HANDOFF：**尚不存在**（設計閘門通過後由規劃寫）
- 現行程式抽樣：`program/kb.ts`、`program/setup.ts`、`program/server.ts`、`program/gm-pi.ts`、`program/schema.ts`、`program/test-runtime-env.ts`、`program/public/`、`.gitignore`
- 上游／構想（非本版契約）：[`../../0.6.0/INDEX.md`](../../0.6.0/INDEX.md)、[`../../backlog/multi-world-saves.md`](../../backlog/multi-world-saves.md)、[`../../backlog/kb-runtime-upgrade.md`](../../backlog/kb-runtime-upgrade.md)
- **總評：** 無未關閉 HIGH；初審 MEDIUM／LOW 同意項已寫進 INDEX／HOW。提案仍**自洽可行**。**設計閘門通過**。HANDOFF 尚未寫——屬規劃下一步，不擋本閘門。現碼仍為單槽 `kb/runtime`——預期落差，**不**構成設計 HIGH。

## Findings（本輪）

關閉＝已寫進 INDEX／HOW／HANDOFF；仍開＝契約仍分叉；非阻擋＝記錄即可。

### HIGH

（無；本輪亦無新增 HIGH）

### MEDIUM

| ID | 標題 | 本輪狀態 | 依據／關閉位置 |
|----|------|----------|----------------|
| M1 | `POST /api/worlds/load` 對不可玩 id 的 HTTP 狀態未鎖死 | **關閉** | INDEX 已定案 **12**：合法 id 但目錄不存在／不可玩 → **409**；非法 body → 400。HOW `POST /api/worlds/load`：同；「本版不用 404」。 |
| M2 | 舊 env `VIBE_GAMEVERSE_KB_RUNTIME` 與新 `VIBE_GAMEVERSE_KB_WORLDS` 並存語意未寫死 | **關閉** | INDEX 已定案 **13**：只認 `VIBE_GAMEVERSE_KB_WORLDS`；RUNTIME **忽略**。HOW 目錄節＋測試 BAN：同。 |
| M3 | 遊玩中可否直接 `load` 另一 uuid（不經 `POST /api/home`）未鎖 | **關閉** | INDEX 已定案 **12**：僅 `screen === "home"` 可載入；**playing → 409**。HOW load：同。 |
| M4 | 廢「already ready＝磁碟上已有任何 ready 世界」宜寫成完整句子 | **關閉** | INDEX 已定案 **12**：parent 下已有其他可玩 uuid **不得**阻擋開新；禁止沿用「已有 ready → already ready」。HOW Setup：同，並點名廢現行 `assertCanSetup` 單槽閘。 |
| M5 | 單 uuid 內 legacy `pi-sessions/`→`play-sessions/` 改名範圍未寫 | **關閉** | INDEX 已定案 **15**：該 uuid **首次**成有效 pointer（load／setup／ensure 該目錄）時改名一次；禁止 parent 根掃。HOW「Legacy `pi-sessions/`」＋ load／Setup 流程：同。 |
| M6 | `POST /api/new-game` 選項 INDEX 含 410、HOW 未列 | **關閉** | INDEX 已定案 **12**：擇一 (a) 刪 route／(b)＝`POST /api/home`；**本版不做 410**。HOW `POST /api/new-game`：同。 |
| M7 | debug `POST /api/debug/session-compact` 與 pointer／playing 未入 HOW | **關閉** | INDEX 已定案 **12**：Turn 與 debug compact 僅 `playing`＋pointer；非 playing → 409。HOW「Turn／debug compact」：同。 |

本輪**無新增 MEDIUM**。

### LOW

| ID | 標題 | 本輪狀態 | 依據／關閉位置 |
|----|------|----------|----------------|
| L1 | 失敗半套／orphan uuid 目錄是否永留 | **關閉** | HOW「失敗／殘目錄」：原子失敗不留可玩項；crash orphan **不**自動 GC；不列出、可手刪。 |
| L2 | UUID 目錄名大小寫／嚴格格式 | **關閉** | HOW 目錄：`crypto.randomUUID()`；掃描只認小寫 `8-4-4-4-12`；其餘略過。 |
| L3 | setup 成功回應是否帶 `save` | **關閉** | HOW Setup：成功回應**建議**對稱帶 `world` 與 `save`（或再 `GET /api/state`）。 |
| L4 | INDEX 13「ensureRuntime 只保證 parent」與已定案 15「ensure 該目錄」用語略撞 | **仍開（非阻擋）** | 讀檔人可能以為不再有「對單一 uuid 的 ensure」。建議規劃收斂時 INDEX 13 改成：`ensureWorldsParent` 只保證 parent；單 uuid 的 ensure／legacy 改名以已定案 15／HOW 為準。不影響主路徑契約。 |
| L5 | `GET /api/worlds` 的 `created_at` 來源未點名 | **仍開（非阻擋）** | HOW 清單含 `created_at`；`save.json` 無此欄。實作應取自該 uuid 的 `world.json.created_at`。建議 HOW 補半句。 |

## 驗收對照

| 驗收句（INDEX） | 設計層是否可測 | 缺口 |
|----------------|----------------|------|
| 空 `kb/worlds/` 開頁＝主頁；無酒館氣泡；turn 409 | 可 | HOW：`not_playing`；UI 認 `screen`（可選保留 `needs_setup`） |
| 新故事 A 再開 B，A 檔與 session 仍在 | 可 | M4 已關；HOW 測試 BAN：開 B 不因 A ready 而 409 |
| 清單顯示 `save_name`；header＝`world.title` | 可 | 無 |
| 載入 A→回主頁→再載入 A 接續；回主頁不刪 A | 可 | M3 已關：須經 home 再 load |
| 刪除須輸入 `delete`；成功目錄沒有、回主頁、清單無 A | 可 | 無 |
| 半套不列出、load 409、不可 turn | 可 | M1 已關：與驗收 409 對齊 |
| 開機不自動進對局 | 可 | 新 process 刪 `current.json`；同 process F5 仍 playing（reasoning／HOW） |
| 不讀不搬舊 `kb/runtime/`（decoy） | 可 | 無 |
| `bun test`；VERSION／AGENTS | 可（出貨） | AGENTS／gitignore 出貨時同步；勿當本版契約 |

## 與現碼抽樣

現碼未做本版 ≠ 設計 HIGH。與提案**互斥、實作時必須推翻**的現行行為（複審複核，仍成立）：

| 錨點 | 現行 | 0.7.0 提案 |
|------|------|------------|
| `kb.ts` `kbRuntimeDir` | 模組級單一路徑；env `VIBE_GAMEVERSE_KB_RUNTIME`；預設 `kb/runtime/` | parent `kb/worlds/`＋`current.json` pointer；路徑隨目前 uuid |
| `clearPlaythrough`／`requestNewGame` | 清空**該**唯一 runtime（`setup.ts`→`resetPlaythrough`） | 開新≠清 parent；`/api/new-game`＝刪或＝`/api/home`；clear 只許打單一 uuid 內部 |
| `atomicCommitPlaythrough` | staging 後 `clearPlaythrough` 再寫入單一 runtime | 新 uuid 目錄原子落盤（含 `save.json`）；禁止清兄弟 |
| `syncWorldGate`／turn／setup | `needs_setup`＝無有效唯一 world；`assertCanSetup`→`already ready` | `screen`＋pointer；home 可開新即使已有其他 uuid |
| `ensureRuntime`／`gm-pi` boot | ready 則可接續近期 session | **新 process** 刪 `current.json`→主頁；載入後才 continue／create **該** uuid |
| `server.ts` state／routes | 無 `screen`／worlds／home／delete；setup 無 `save_name` | HOW HTTP 表 |
| `test-runtime-env.ts` | 只設 `VIBE_GAMEVERSE_KB_RUNTIME` temp | `VIBE_GAMEVERSE_KB_WORLDS` temp **parent** |
| `.gitignore` | 僅 `kb/runtime/` | **加** `kb/worlds/`（可保留 runtime 行） |
| `public/` | 「新遊戲」→`/api/new-game` 清盤；`needs_setup` 二選一 | 主頁兩入口；遊玩中回主頁／刪除確認（`delete`） |

與非目標一致：不碰 `kb-runtime-upgrade` hop；compact trigger／兩 scope 不改。

## 修復追蹤表

| ID | 級 | 狀態 | 關閉位置（INDEX 條／HOW 節） |
|----|----|------|------------------------------|
| M1 | MEDIUM | **關閉** | INDEX 已定案 12；HOW `POST /api/worlds/load` |
| M2 | MEDIUM | **關閉** | INDEX 已定案 13；HOW 目錄／測試 BAN |
| M3 | MEDIUM | **關閉** | INDEX 已定案 12；HOW load |
| M4 | MEDIUM | **關閉** | INDEX 已定案 12；HOW Setup |
| M5 | MEDIUM | **關閉** | INDEX 已定案 15；HOW Legacy `pi-sessions/` |
| M6 | MEDIUM | **關閉** | INDEX 已定案 12；HOW `POST /api/new-game` |
| M7 | MEDIUM | **關閉** | INDEX 已定案 12；HOW Turn／debug compact |
| L1 | LOW | **關閉** | HOW 失敗／殘目錄 |
| L2 | LOW | **關閉** | HOW 目錄（UUID 格式） |
| L3 | LOW | **關閉** | HOW Setup（建議帶 `save`） |
| L4 | LOW | 仍開（非阻擋） | 建議 INDEX 13 用語對齊 15 |
| L5 | LOW | 仍開（非阻擋） | 建議 HOW 清單點名 `world.json.created_at` |

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-09-09 | 可行；無 HIGH；7 MEDIUM／3 LOW 建議規劃收斂後寫 HANDOFF 再開工 |
| 第 2 輪複審 | 2026-09-09 | M1–M7、L1–L3 已關；無新 HIGH／MEDIUM；L4–L5 非阻擋。**設計閘門通過**；下一步寫 HANDOFF 後開工 |
