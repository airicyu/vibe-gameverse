# Implementation review — 0.12.0 多套 Default 模板

- 日期：2026-09-10（Asia/Hong_Kong）
- 輪次：**初審**
- 角色：實作審查（不改程式；只認檔案／working tree／測試）
- 對照基準：[`../INDEX.md`](../INDEX.md) **已定案＋驗收**（HOW／HANDOFF／design-review 非契約）
- 抽樣錨點：`kb/seed/{id}/`、`prompts/gm-default/{id}.md`、`program/templates.ts`、`program/templates.test.ts`、`program/kb.ts`（`commitDefaultWorld`、`setupDefaultForTest`、`loadSeedEntities`）、`program/setup.ts`、`program/schema.ts`、`program/gm-pi.ts`、`program/gm-mock.ts`、`program/server.ts`、`program/public/app.js`／`index.html`；出貨：`VERSION.md`、`changelog.md`、`AGENTS.md`、`docs/roadmap/backlog/`
- **總評：** 無未關閉 **HIGH**。主路徑與 INDEX 對齊。`bun test` **全綠**（134 pass／0 fail）。M2 已關（2026-09-11 同意出貨：INDEX `shipped`）。瀏覽器未實點；已用隔離 HTTP mock 代驗非酒館開局（M1 標非阻擋）。已標 `shipped`。

## 各輪

| 輪次 | 日期 | 對照基準 | 總評 |
|------|------|----------|------|
| 初審 | 2026-09-10 | INDEX 現檔已定案＋驗收 | **無未關閉 HIGH**；測全綠；當時不可 `shipped`（M1 瀏覽器；INDEX `in progress`） |
| 修復後自核 | 2026-09-10 | 同上 | M3 補測；L1 改名「岑燧」；L5 錨點表已改。M1 HTTP 代驗。M2 仍待同意。`bun test` 134 pass |
| 出貨同意 | 2026-09-11 | 同上 | M2 關；INDEX → `shipped`；backlog 本列已清 |

## Findings（累加；穩定 ID 不重編號）

### HIGH

無。

### MEDIUM

#### M1 — 瀏覽器驗收未在本輪執行 — **仍開（非阻擋；HTTP 已代驗）**

INDEX 驗收：「瀏覽器：非酒館模板開局可見該套 NPC／場景，不是瑪拉。」本輪無 browser MCP。隔離 `PORT=8799 GM_MODE=mock`：`POST /api/setup/default` `cyberpunk` → `scene_id=rain_clinic`、npc `clinic_doc`、narration 含「地下診所不接官方單」、無瑪拉。同意出貨前仍建議本機實點主頁。

#### M2 — 出貨狀態 — **關閉**（2026-09-11 同意出貨）

`VERSION.md`＝`0.12.0`；`changelog.md` 有 0.12.0 節；`AGENTS.md` 主頁改「選模板」、canon 路徑已改。`docs/roadmap/backlog/default-world-templates.md` 已刪；backlog 表已自本列移除。INDEX 已 `shipped`。

#### M3 — 缺 canon／缺 seed 與 playing 下 templates — **關閉**（修復後）

已測：`loadSeedEntities("nope")` → 500 `missing_seed`；`loadDefaultGmCanon("nope")` → 500 `missing_canon`；playing 後 `listTemplates()` 仍五筆。

### LOW

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| **L1** | **關閉** | 顯示名改「岑燧」，不再含子串「灰」。 |
| **L2** | **記錄** | `mockKind`：無 `world` 且 `scene_id === "tavern"` → `rust-lamp`；default 非法 id 則走 custom 霧港而非 coerce 酒館。`runTurn` 傳 `gate.world`。非法盤上值 load 500／不可玩。 |
| **L3** | **記錄** | `deriveDefaultScene` 的 `present` 為 `player`＋NPC id **字母序**。`rust-lamp` 落地為 `["player","ash","bartender"]`，與舊常數 `INITIAL_SCENE`（bartender 在前）不同。Mock 酒館閒聊仍寫死瑪拉，不依 `present[1]`。 |
| **L4** | **記錄** | `INITIAL_SCENE`／`INITIAL_GM_NOTE` 仍 export（測與酒館預製）。`commitDefaultWorld` **不**再寫死這份 scene／note 給他套；非 rust-lamp 的 L2 用空六欄。 |
| **L5** | **關閉** | INDEX 錨點改為 `kb/seed/{id}/` 與 `prompts/gm-default/{id}.md`。 |
| **L6** | **記錄** | 設計審查 L4（mist-rite 較冷原作姓未列黑名單）仍屬撰文風險；本輪 seed／canon／顯示名通過 HOW 黑名單測。L5 條號 15 插在 7／8 之間＝契約文件，非碼。 |

## 驗收對照

| INDEX 驗收句 | 通過／失敗 | 證據 |
|--------------|------------|------|
| `kb/seed/rust-lamp/` 含原酒館；repo 根無扁平 `kb/seed/*.json`、無 stub | **通過** | 五檔在 `rust-lamp/`；測 `repo has no flat kb/seed json`；根層 `prompts/gm-default.md` 不存在 |
| Default commit 後 scene／gm_note／L2 屬該套；非 rust-lamp 無瑪拉／`bartender`／`tavern` | **通過（測）** | `commitDefaultWorld` 推導；`each default template commit and mock beat stay in-cast` |
| 五套 player＋場景＋≤3 NPC；L2 commit 後有 psyche | **通過** | 每套 2 NPC、皆 `memory_tier: 2`；測 assert L2 檔 |
| `POST /api/setup/default` 無／非法 `template_id` → 400 | **通過** | `missing_template_id`／`invalid_template`；`setup.ts` |
| 新 default 有 `template_id`；system 獨有句不含他套 | **通過** | sentinel：北路燈手／地下診所不接官方單／封門符還熱著／市區禁止釋放／今晚不要出門 |
| 舊 default 無 `template_id` → `rust-lamp` 可玩（可寫回） | **通過** | `legacy default world missing template_id is rust-lamp`（parse＋`syncWorldGate` 寫回） |
| Custom setup 不讀 `gm-default/*` | **通過** | `setupCustom` 忽略 body 鍵；prompt 無 sentinel；`world.template_id` undefined |
| 每套 mock 一拍不串台；`setupDefaultForTest()` 無參＝酒館 | **通過** | 上列迴圈＋無參 helper 測 |
| `GET /api/templates` 五筆與 HOW 一致 | **通過（函式）；HTTP playing 無專測** | `listTemplates` 順序／名／導語；M3 |
| `mist-rite` 無原作角色名與商標地名 | **通過（HOW 黑名單）** | `mist-rite files have no banned original names`；卡司柯嵐／沈衡、成年職業 |
| 刪世界／不偷灌；`bun test`；出貨文件與 backlog | **測通過／出貨未完** | 既有 multi-world／overreach；M2 |
| 瀏覽器非酒館開局不是瑪拉 | **未驗證（本輪）** | M1；INDEX 該項未勾 |

## Track 對照

| Track | 預期 | 實作 | 結果 |
|-------|------|------|------|
| A — Seed 遷徙與目錄 | 子目錄五套；刪扁平與根 `gm-default.md`；只掃 Entity | `kb/seed/{id}/*.json`；`loadSeedEntities`；五份 `prompts/gm-default/{id}.md` | **對齊** |
| B — Setup／world／prompt／mock | `template_id`、400、組 system、mock 分套、helper 雙參數 | `setup.ts`／`schema.ts`／`gm-pi.ts`／`gm-mock.ts`／`kb.ts` | **對齊**；M3 缺口測 |
| C — 主頁 UI | 先選模板再 `save_name`；Custom 不送鍵 | `app.js`／`index.html`／`styles.css` | **程式對齊**；M1 未跑瀏覽器 |
| D — 測試與出貨 | 窄測、VERSION／changelog／AGENTS、刪 backlog | `templates.test.ts`；出貨 trio；backlog 本列已刪 | **部分**（M1／M2） |

## 已定案核對（重點）

| 已定案 | 實作 | 結果 |
|--------|------|------|
| 1 範圍五套＋選模板；不改 custom 生成器為底 | 無模板編輯器／章節／圖像 | 對齊 |
| 2 id 鎖定；未知 400 不 coerce | `isTemplateId`；400 `invalid_template` | 對齊 |
| 3 顯示名／導語 | `TEMPLATE_CATALOG`＝HOW 表 | 對齊 |
| 4 `mist-rite` 結構邊界、成年、禁原作 | seed／canon；黑名單測 | 對齊（L6） |
| 5 單場景 ≤3 NPC、至少一名 L2 | 每套 2 NPC 皆 L2 | 對齊 |
| 6 seed 只 Entity；扁平遷入刪除 | 無 `scene.json`／psyche 進 seed | 對齊 |
| 7 world.json 欄；舊缺＝酒館；非法 500；custom 忽略 | preprocess＋`isInvalidDefaultTemplate`；`loadWorld` 500 | 對齊 |
| 8 canon 拆檔；禁開 A 讀 B；custom 零讀 | `buildPlaySystemPrompt` | 對齊 |
| 9 HTTP＋`setupDefaultForTest` 第一參數仍 saveName | 無參＝`rust-lamp`；`overreach` 第一參仍顯示名 | 對齊 |
| 10 mock 分套不串台 | `mockByTemplate`；非 switch-fallthrough 酒館 | 對齊 |
| 11 禁止未知模板填酒館；缺 npc 不 coerce 酒館 | `unknown_npc` 測仍在 | 對齊 |
| 12 UI 先選再送 | disabled＋守衛 | 對齊（M1） |
| 13 空 `player-memory`；不改過線 HTTP | `commitDefaultWorld` 寫空檔；overreach 測仍綠 | 對齊 |
| 14 測試隔離；出貨文件 | `test-runtime-env.ts` tmp parent；未 `rm` live | 對齊（M2 狀態字） |
| 15 commit 推導 scene／gm_note／dirty／L2 | `deriveDefaultScene`＋`TEMPLATE_GM_NOTES`；L2 只該套 | **對齊** |

## 測試結果

- 指令：`GM_MODE=mock bun test`（repo 根 `/home/airic/airwave/vibe-gameverse`；`program/test-runtime-env.ts` 設隔離 `VIBE_GAMEVERSE_KB_WORLDS` 並強制 mock；**未** `rm` live `kb/worlds`／`kb/runtime`）
- 結果：**134 pass，0 fail**，610 `expect()`；8 files
- 本版 `program/templates.test.ts`：扁平 seed、catalog、setup 400、helper 無參＝酒館、五套 commit＋mock 不串台、esper-city 無 bartender、mist-rite 黑名單、舊檔 coerce 寫回、非法盤上 500、custom 忽略 `template_id`、`mockGm` 非酒館
- 既有全包未回歸（opening／multi-world／overreach／npc-memory／compact／world／turn）

## 出貨文件核對

| 項 | 狀態 |
|----|------|
| `VERSION.md` = `0.12.0` | **是** |
| `changelog.md` 0.12.0 節 | **是** |
| `AGENTS.md` 選模板／五套／canon 路徑 | **是** |
| backlog 列與 `default-world-templates.md` 已刪 | **是**（獨立檔與表列） |
| INDEX 狀態 `shipped` | **是**（M2 關） |
| 瀏覽器非酒館開局 | **否**（M1） |

## 修復追蹤

| ID | 級 | 狀態 | 建議關閉方式 |
|----|----|------|--------------|
| M1 | M | **仍開（非阻擋）** | HTTP mock 已代驗；本機實點仍建議 |
| M2 | M | **關閉** | 2026-09-11 同意出貨：INDEX → `shipped` |
| M3 | M | **關閉** | `templates.test.ts` 缺檔 500＋playing listTemplates |
| L1 | L | **關閉** | 岑燧 |
| L5 | L | **關閉** | INDEX 錨點 |

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 修復後自核 | 2026-09-10 | M3／L1／L5 已關。無 HIGH。134 pass。當時待同意 shipped（M2）；M1 非阻擋。 |
| 出貨同意 | 2026-09-11 | M2 關；INDEX `shipped`；backlog 本列已清。M1 仍為非阻擋記錄。 |
