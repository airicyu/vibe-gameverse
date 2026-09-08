# Implementation review — 0.7.0 多世界存檔

- 日期：2026-09-09（Asia/Hong_Kong）
- 輪次：**初審**
- 角色：實作審查（不改程式、不加功能、不 commit）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收；HOW [`multi-world.md`](./multi-world.md)；WHY [`reasoning.md`](./reasoning.md)；[`../HANDOFF.md`](../HANDOFF.md)；設計審查 [`design-review.md`](./design-review.md)（僅參考）
- 現碼抽樣：`program/kb.ts`、`program/setup.ts`、`program/server.ts`、`program/schema.ts`、`program/gm-pi.ts`、`program/turn.ts`、`program/test-runtime-env.ts`、`program/multi-world.test.ts`、`program/public/`、`.gitignore`、`AGENTS.md`、`VERSION.md`、`changelog.md`、`docs/roadmap/backlog/`
- Working tree：相對 `main` 有未提交變更；本輪對**工作區現檔**審查
- **總評：** 無未關閉 HIGH；`bun test` 全綠（89 pass／0 fail）。INDEX 驗收主路徑與現碼一致（`kb/worlds/`、`save.json`、`current.json`、boot 刪 pointer、`screen` home|playing、load 僅 home、delete 確認字 `delete`、setup `save_name`、開新不清兄弟、忽略 `VIBE_GAMEVERSE_KB_RUNTIME`、gitignore、UI 主路徑、VERSION／AGENTS／changelog／backlog 清理）。無未關閉 HIGH；同意的 MEDIUM（M1）已關閉。**可請使用者同意出貨**（INDEX 狀態仍 `in progress` 至同意後改 `shipped`）。L2 瀏覽器手點為建議項。

## Findings（本輪）

### HIGH

（無）

### MEDIUM

| ID | 標題 | 本輪狀態 | 依據 |
|----|------|----------|------|
| M1 | 契約符號 `ensureWorldsParent` 程式中不存在 | **關閉** | INDEX 已定案 13／HOW／錨點表已改寫為 `bootWorlds()`（mkdir parent＋刪 `current.json`）。與現碼一致。 |

### LOW

| ID | 標題 | 本輪狀態 | 依據 |
|----|------|----------|------|
| L1 | INDEX 錨點表仍寫舊單槽「今日」名 | **關閉** | 錨點表已改為 `kbWorldsDir`／`bootWorlds`／`clearPointer`／`setActiveWorld` 等現碼名。 |
| L2 | Track C 瀏覽器點一遍無本輪證據 | **仍開（非阻擋）** | `program/public/` 已接主頁兩入口、`save_name`、load、`POST /api/home`、delete dialog（確認字 `delete`）。本輪未實機點瀏覽器；HTTP／KB 由單測覆蓋。 |
| L3 | turn 409 兼帶 `needs_setup`；舊測名殘留 | **仍開（非阻擋）** | HOW／`multi-world.test.ts` 主碼 `not_playing`。`turn.ts` 非 playing 時 `{ error: "not_playing", needs_setup: true }`；`turn.test.ts` 標題仍寫 needs_setup。非 API path 分叉。 |
| L4 | design-review L4／L5 標記過期 | **關閉（非阻擋）** | INDEX／HOW 已用 `bootWorlds`；`created_at` 已在 HOW。design-review 歷史列可保留。 |

## 特別核對（本輪）

| 項 | 結果 |
|----|------|
| worlds parent、`save.json`、pointer `current.json`、boot 刪 pointer | **通過** — `kbWorldsDir`＋`VIBE_GAMEVERSE_KB_WORLDS`；`save.json` `{id,save_name}`；`current.json`；`bootWorlds`→`clearPointer`；測 bootWorlds clears pointer |
| `screen` home\|playing；load 僅 home；delete 確認字；setup `save_name`；開新不清兄弟 | **通過** — server／setup／UI；對應 multi-world 測 |
| 忽略 `VIBE_GAMEVERSE_KB_RUNTIME`；gitignore `kb/worlds/` | **通過** — kb 只讀 WORLDS；測 RUNTIME ignored；`.gitignore` 含 `kb/worlds/` |
| UI 主路徑；AGENTS／VERSION／changelog／backlog | **通過** — VERSION＝`0.7.0`；changelog 有 0.7.0；AGENTS 寫 worlds／主頁／pointer；`backlog/multi-world-saves.md` 已刪 |
| INDEX↔實作／HOW 用詞致驗收歧義 | **無 HIGH**；僅 M1（`ensureWorldsParent` vs `bootWorlds`）非阻擋。API path、`current.json`、`setup_status`、`created_at` 與 HOW／現碼一致 |

## 驗收對照

| INDEX 驗收句 | 通過／失敗 | 證據 |
|--------------|------------|------|
| 空 `kb/worlds/` 開頁＝主頁；無酒館氣泡；turn 409 | **通過** | multi-world empty parent；UI 依 `screen` |
| 新故事 A 再開 B，A 仍在 | **通過** | two setups coexist |
| 清單 save_name；header＝world.title | **通過** | save_name differs；app 清單／chrome |
| 載入 A→home→再載入 A 接續；home 不刪 A | **通過** | home then reload |
| 刪除須 `delete`；成功無目錄、回主頁 | **通過** | delete requires exact confirm |
| 半套不列出、load 409、不可 turn | **通過** | half world not listed |
| 開機不自動進對局 | **通過** | bootWorlds clears pointer |
| 不讀不搬舊 `kb/runtime/`（decoy） | **通過** | decoy runtime beside parent |
| `bun test` 全綠；VERSION＝0.7.0；AGENTS 寫 worlds／主頁／pointer | **通過** | 見下；`VERSION.md`；`AGENTS.md` |

## 測試結果

- 指令：`bun test`（`/home/airic/airwave/vibe-gameverse`）
- 結果：**89 pass／0 fail**（5 files；292 expect）
- 隔離：`program/test-runtime-env.ts` 設 `VIBE_GAMEVERSE_KB_WORLDS`＝temp parent；未 `rm` live `kb/runtime` 或 live `kb/worlds`
- 專測：`program/multi-world.test.ts`（10）含 boot、decoy、RUNTIME ignore、playing load 409

## 修復追蹤

| ID | 級 | 狀態 | 建議關閉方式 |
|----|----|------|--------------|
| M1 | MEDIUM | **關閉** | INDEX／HOW／錨點 → `bootWorlds` |
| L1 | LOW | **關閉** | 錨點表已更新 |
| L2 | LOW | 仍開 | 出貨前瀏覽器點主路徑 |
| L3 | LOW | 仍開 | 可選統一 turn 409 body／測名 |
| L4 | LOW | **關閉** | 契約已對齊；design-review 歷史可留 |

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-09-09 | 無 HIGH；`bun test` 全綠；驗收皆有測／檔證據。M1 符號名非阻擋。可請 Eric 同意出貨（複審可先收 M1／L2）。 |

| 修復輪（文件對齊） | 2026-09-09 | 關閉 M1／L1／L4；契約名＝`bootWorlds`。L2 瀏覽器手點仍建議出貨前做。 |
