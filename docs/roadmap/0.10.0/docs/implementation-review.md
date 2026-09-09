# Implementation review — 0.10.0 L2 NPC 心理深度

- 日期：2026-09-10（Asia/Hong_Kong）
- 輪次：**初審**
- 角色：實作審查（不改程式；只認檔案／working tree／測試）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收；[`../HANDOFF.md`](../HANDOFF.md)；HOW [`npc-l2-psyche.md`](./npc-l2-psyche.md)；WHY [`reasoning.md`](./reasoning.md)；背景 [`design-review.md`](./design-review.md)（非契約）
- 抽樣錨點：`program/schema.ts`、`program/kb.ts`、`program/npc-memory.ts`、`program/compact.ts`、`program/turn.ts`；`prompts/gm-contract.md`、`prompts/compact-npc-psyche.md`；測：`program/npc-memory.test.ts`、`program/compact.test.ts`；出貨文件：`VERSION.md`、`changelog.md`、`AGENTS.md`、`docs/roadmap/backlog/`
- **總評：** Track A–C 主路徑與 INDEX 對齊；`GM_MODE=mock bun test` 全綠（96 pass／0 fail）。**無未關閉 HIGH**。出貨文件（VERSION／changelog／AGENTS）已寫 0.10.0 psyche 句；**backlog 列與 `npc-l2-psyche.md` 尚未刪**（INDEX 驗收寫「待同意出貨」）。M1（超長 clip 語意）、M2（出貨清單）、M3（舊 L2 缺檔缺專測）仍開，不阻擋程式就緒判定。

## Findings（本輪）

### HIGH

（無）

### MEDIUM

#### M1 — `NpcPsycheSchema` 欄位 `.max()` 先於 clip，超長模型輸出走 distill 失敗而非 clip 寫入 — **仍開**

**依據：** INDEX 已定案 **3**／HOW「Parse 後 clip 超限；不因此 fail turn」。`parseNpcPsycheModel`（`program/schema.ts`）先 `NpcPsycheSchema.parse`（各欄 `.max(200|120)`），再 `clipNpcPsyche`；模型回傳超上限字串時 zod 拋錯 → `distillDepartedNpcPsyche` catch → log、保留 compact 前 psyche（不回滾 archive）。行為可接受於「distill 失敗不回滾」，但**未**實現「clip 後寫入」語意；Writer 池節用 `clipEnd` 先截再寫，模式不一致。

**建議：** `parseNpcPsycheModel`／`saveL2Psyche` 改為先接受任意長字串再 `clipNpcPsyche`，或 zod preprocess clip。

#### M2 — 出貨清單：backlog 列與獨立檔未刪 — **仍開（待同意出貨）**

**依據：** INDEX 驗收「**待同意出貨**後刪 backlog 本列」；`docs/roadmap/backlog/INDEX.md` 仍列 [L2 NPC 心理深度](./npc-l2-psyche.md)；`docs/roadmap/backlog/npc-l2-psyche.md` 仍存在。`VERSION.md`＝`0.10.0`、`changelog.md` 0.10.0 節、`AGENTS.md` L2 psyche／compact 句已更新——**程式文件側已就緒**，backlog 清理屬出貨步驟。

#### M3 — 驗收「缺 `psyche.json` 舊 L2」無專測 — **仍開**

**依據：** `loadL2Psyche`（`program/kb.ts`）缺檔 catch → `emptyNpcPsyche`；`assembleNpcMemories` 缺 map 時亦 `emptyNpcPsyche` → 附空六欄 `psyche`。邏輯對齊 INDEX 驗收句，但 `npc-memory.test.ts`／整合測**未**建立「有 `current.json`、無 `psyche.json`」並 assert GM snippet 含空 `psyche`。

### LOW

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| L1 | **記錄** | Default 測只 assert `bartender` 兩欄＋檔存在；`ash` 六欄未逐欄對 HOW 表（`DEFAULT_L2_PSYCHE` 常數與 HOW 一致，風險低）。 |
| L2 | **記錄** | promote 回滾測以 `promoteL2FailHook`（在 `saveL2Psyche` **之後**）覆蓋共用 catch；未單獨注入 `saveL2Psyche` throw。 |
| L3 | **記錄** | L0／L1 snippet 無 `psyche` 鍵：程式 `assembleNpcMemories` L235 僅 push `{ npc_id, tier, body }`；無 tier 0／1 斷言測。 |
| L4 | **記錄** | 無 `clipNpcPsyche`／超長欄位窄測（與 M1 相關）。 |
| L5 | **記錄** | `docs/roadmap/backlog/INDEX.md` 現行產品仍寫「0.9.0 in progress」，與 `VERSION.md` 0.10.0 漂移；不影響 runtime。 |
| L6 | **記錄** | `docs/roadmap/0.10.0/INDEX.md` 狀態仍 `in progress`（待同意出貨）屬預期。 |
| L7 | **記錄** | `gm-contract.md` psyche 優先序為英文；INDEX／HOW 允許繁中或英。 |

## 驗收對照

| INDEX 驗收句 | 通過／失敗 | 證據（測／檔） |
|--------------|------------|----------------|
| Default 新開：兩份 `psyche.json` zod 合法、六欄符合 HOW | **通過** | `npc-memory.test.ts`「default setup L2 files…」；`kb.ts` `DEFAULT_L2_PSYCHE`＋`commitDefaultWorld` 寫入 map |
| 遊玩中 1→2：升 2 後空 psyche；`current.json` 同 0.9.0 | **通過** | promote 測 `scribePsyche` 六欄 `""`；既有 L2 body／dirty 行為未改 |
| 在場 L2：`buildGmContext` snippet 含 `psyche`；L0／L1 無鍵 | **通過（測部分）** | `buildGmContext only includes present…` assert L2 `psyche` 物件；L0／L1 無鍵靠程式路徑（L3） |
| 缺 `psyche.json` 舊 L2：讀取不 fail；GM 附空六欄 | **通過（缺專測）** | `loadL2Psyche` 缺檔 → `emptyNpcPsyche`（M3） |
| Session compact 含 `sessionNpcWrites`：`psyche.json` 不變 | **通過** | `compact.test.ts`「session near_cap compact does not update psyche」 |
| promote：`saveL2Psyche` 失敗回滾 | **通過（測間接）** | `promoteToL2` try 含 `saveL2Psyche`；失敗 `removeL2Dir`；inject hook 測回滾（L2） |
| NPC compact（**離場** scope）後 psyche 更新；失敗不回滾 archive | **通過** | `departed npc compact distills psyche…`；`psyche distill fail` log 後 archive 仍在 |
| `near_cap` 仍只依 `body.length` | **通過** | `dirty near_cap follows L2 body length 640` |
| `POST /api/turn` 無 `npc_memories`；`gm-contract` 含優先序 | **通過** | `runTurn HTTP result has no npc_memories key`；`gm-contract.md` L22 psyche 段 |
| `bun test` 全綠；VERSION＝0.10.0；backlog 待刪 | **通過／待出貨** | 見下節；M2 backlog |

## Track 對照

| Track | 預期 | 實作 | 結果 |
|-------|------|------|------|
| A — Schema／kb／promote／Default seed | `NpcPsycheSchema`、path、load/save、空檔、promote 空 psyche、Default 預製 | `schema.ts`、`kb.ts` `loadL2Psyche`／`saveL2Psyche`／`DEFAULT_L2_PSYCHE`、`promoteToL2` | **對齊** |
| B — GM context／contract | L2 snippet 附 `psyche`；`gm-contract` 規則 | `assembleNpcMemories`、`turn.ts` `loadL2PsycheMapForPresent`、`gm-contract.md` | **對齊** |
| C — Compact psyche distill | 僅 `departedWrites` 後；mock 同級；失敗不回滾 | `compact.ts` `distillDepartedNpcPsyche` 在 L638–646；`compact-npc-psyche.md`；`modelNpcPsyche` hook | **對齊** |
| D — 測試／出貨文件 | 窄測、VERSION／changelog／AGENTS | 新增 compact／npc-memory 測；出貨 trio 已寫；backlog 未刪 | **部分**（M2） |

## 已定案核對（重點）

| 已定案 | 實作 | 結果 |
|--------|------|------|
| 1 範圍僅 L2；L0／L1 無 psyche | pool snippet 無 `psyche` 鍵 | 對齊 |
| 2 另檔 `psyche.json` | 不併入 `current.json` | 對齊 |
| 3 六欄 clip | `clipNpcPsyche` 存在；parse 路徑見 M1 | **部分** |
| 4 缺檔不 hop | `loadL2Psyche` 記憶體空物件 | 對齊 |
| 5 升 2 六欄空 | `promoteToL2` → `emptyNpcPsyche` | 對齊 |
| 6 Default 預製 | `DEFAULT_L2_PSYCHE` 語意同 HOW | 對齊 |
| 7 `assembleNpcMemories` 附 psyche | L2 且 `current` 存在 | 對齊 |
| 8 gm-contract 優先序 | L22 tier-2 psyche 規則 | 對齊 |
| 9–10 僅離場 compact 後 psyche；session 不改 | `departedWrites` 迴圈；session 測 assert 不變 | 對齊 |
| 11 distill 輸入／輸出／失敗不回滾 | `distillDepartedNpcPsyche` payload；catch log | 對齊 |
| 12 `near_cap` 只看 body | `recountNearCap` 未改 | 對齊 |
| 13 測試隔離 | `VIBE_GAMEVERSE_KB_WORLDS`；未 `rm` live `kb/worlds` | 對齊 |
| 14 出貨文件 | VERSION／changelog／AGENTS 已寫 | 對齊；backlog 待 M2 |

## 測試結果

- 指令：`GM_MODE=mock bun test`（repo 根；`program/test-runtime-env.ts` 隔離 tmp parent；**未** `rm` live `kb/worlds`／`kb/runtime`）
- 結果：**96 pass，0 fail**，330 `expect()`；6 files；約 1.8s
- 本版新增／擴充：`npc-memory.test.ts`（Default psyche、promote 空 psyche）；`compact.test.ts`（離場 psyche distill、session 不更新、失敗不回滾 archive）
- 既有全包未回歸

## 出貨文件核對

| 項 | 狀態 |
|----|------|
| `VERSION.md` = `0.10.0` | **是** |
| `changelog.md` 0.10.0 節 | **是** |
| `AGENTS.md` L2 psyche 落盤／compact／不進 HTTP | **是**（一回合、檔案節） |
| backlog 列與 `npc-l2-psyche.md` 已刪 | **否**（M2；待同意出貨） |
| `prompts/compact-npc-psyche.md` | **是**（Track C） |

## 修復追蹤

| ID | 級 | 狀態 | 建議關閉方式 |
|----|----|------|--------------|
| M1 | M | **仍開** | `parseNpcPsycheModel` 先 clip 再 persist；補超長窄測 |
| M2 | M | **仍開（待出貨）** | 同意出貨後刪 backlog 列與 `npc-l2-psyche.md`；INDEX → `shipped` |
| M3 | M | **仍開** | 加「有 current、無 psyche.json」integraton 測 |
| L1 | L | 記錄 | 可 assert `ash` 全欄或 trust 常數 |
| L2 | L | 記錄 | 可 mock `saveL2Psyche` throw |
| L3 | L | 記錄 | tier 1 pool snippet 無 `psyche` 鍵 assert |
| L4 | L | 記錄 | 併 M1 |
| L5 | L | 記錄 | 出貨時更新 backlog INDEX 現行版本句 |
| L6 | L | 記錄 | 出貨改 INDEX 狀態 |
| L7 | L | 記錄 | 可選繁中 gm-contract 句 |

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-09-10 | **無 HIGH**。Track A–C 對齊 INDEX；`bun test` 96／0 全綠。M1 clip 語意、M2 backlog 出貨、M3 舊 L2 缺檔缺專測仍開。程式側可作出貨就緒判定；同意出貨前處理 M2，建議修 M1／補 M3。 |
