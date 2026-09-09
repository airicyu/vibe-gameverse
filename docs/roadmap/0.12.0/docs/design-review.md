# Design review — 0.12.0 多套 Default 模板

- 日期：2026-09-10（Asia/Hong_Kong）
- 輪次：**第 2 輪複審**（初審同日）
- 角色：設計審查（不改 INDEX／HOW／reasoning／HANDOFF／程式；不以本檔當已定案）
- 對照基準：[`../INDEX.md`](../INDEX.md) **現檔**已定案＋驗收；HOW [`default-templates.md`](./default-templates.md)；WHY [`reasoning.md`](./reasoning.md)；[`../HANDOFF.md`](../HANDOFF.md)；上游 [`0.11.0`](../../0.11.0/INDEX.md)（狀態仍 `in progress`；樹上契約：`player-memory`、setup 空檔、不偷灌）；構想 [`../../backlog/default-world-templates.md`](../../backlog/default-world-templates.md)（非本版契約）
- 現行程式抽樣：`kb/seed/` 仍扁平五檔、`prompts/gm-default.md`、`program/setup.ts`、`program/kb.ts`（`commitDefaultWorld`、`setupDefaultForTest`、`INITIAL_SCENE`）、`program/gm-pi.ts`、`program/gm-mock.ts`、`program/schema.ts`（`World`）、`program/server.ts`（`/api/setup/default`）、`program/public/app.js`／`index.html`
- **總評：** 無未關閉 **HIGH**。提案在非目標與 POC 禁區內**可自洽**，**非整案不可行**。審查門檻**通過**（H1 已寫進 INDEX 已定案 15＋HOW「Default commit」＋HANDOFF 禁區／starter）。初審應修 MEDIUM（M1–M6）本輪皆已關進契約檔。LOW：L1–L3 已關；**L4 仍開**（非阻擋）。新增 **L5**（條號 15 插在 7／8 之間，非阻擋）。**不得**把本檔當已定案；實作仍須改碼。

## 各輪

| 輪次 | 日期 | 對照基準 | 總評 |
|------|------|----------|------|
| 初審 | 2026-09-10 | 當時 INDEX／HOW（H1 未入已定案） | 可自洽；**H1 仍開**；門檻未過；應修 M1–M6 |
| 第 2 輪複審 | 2026-09-10 | 現 INDEX（含已定案 15）／HOW／HANDOFF | **無未關閉 HIGH**；門檻通過；非整案不可行 |

## Findings（累加；本輪核對關閉）

關閉＝已寫進 INDEX／HOW／HANDOFF；仍開＝契約仍分叉；非阻擋＝記錄即可。穩定 ID 不重編號。

### HIGH

#### H1 — Default commit 的 `scene.json`／`gm_note`／dirty-set／L2 未按模板寫死 — **關閉**（第 2 輪）

**初審問題（保留）：** INDEX／HOW 曾把磁碟寫成「copy 該套 entity JSON」與「僅 L2 建 `l2/`」，未寫死 runtime 開場。現碼 `commitDefaultWorld` 寫死酒館 `INITIAL_SCENE`／`INITIAL_GM_NOTE`／瑪拉／灰 dirty 與 L2。只改 copy 路徑會讓非酒館仍落地瑪拉。

**第 2 輪核對（檔案，非口頭）：**

- INDEX **已定案 15**「Default commit」：copy 僅該目錄 Entity；`scene_id`＝該套唯一 place `id`；`present`＝`player`＋該套開場 NPC；`gm_note` 該套幕＋鉤子；dirty／`l2/` 只為該套 L2；禁止五套共用 `INITIAL_SCENE`／瑪拉／灰常數；psyche 不進 seed。
- HOW **「Default commit（推翻酒館硬編碼）」** 七步與上句對齊；並禁止缺目錄／缺 canon 改 copy 酒館。
- INDEX **驗收**新增「Default commit 後 scene／gm_note／L2 屬於該套，非酒館常數」。
- HANDOFF 禁區與 paste-ready：**commitDefaultWorld 必須依模板推導 scene／gm_note／L2，禁止他套落到酒館常數。**
- WHY「為何 commit 必須推導 scene／gm_note」與已定案一致。

現碼仍寫死酒館＝**尚未實作**，不是本項仍開。

### MEDIUM

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| **M1** | **關閉** | INDEX 驗收 1 與 HOW 同句：遷入 `rust-lamp/` 後 repo 根無扁平 `kb/seed/*.json`、無 re-export stub。INDEX 已定案 6 同。 |
| **M2** | **關閉** | INDEX 已定案 7：default 缺欄或空字串 → `rust-lamp`（可寫回）；盤上非五套之一 → load／組 prompt 失敗（500 `invalid_template`），禁止 coerce 酒館。HOW `world.json`／對局 prompt 同（缺 canon／seed → 500 `missing_canon` 等價，禁止改讀酒館）。 |
| **M3** | **關閉** | INDEX 已定案 7：custom 檔上或 `POST /api/setup/custom` body 帶 `template_id` → 忽略、不寫入、不讀 `gm-default/*`、不因此 parse 失敗、不寫回酒館。HOW HTTP／UI 同。Track C：Custom 不送該鍵。 |
| **M4** | **關閉** | INDEX 已定案 5：每套開場至少一名 `memory_tier === 2`（傾向兩名，上限仍 3）。HOW L2 同句。 |
| **M5** | **關閉** | INDEX 已定案 15＋HOW：`rust-lamp` 可留 `kb.ts` 預製；新四套 commit 時寫空六欄或短預製；psyche 不混進 seed Entity。 |
| **M6** | **關閉** | INDEX 開頭：勿與未收斂的 0.11 平行改同一套 `setup`／`world.json`／mock／`commitDefaultWorld`；空 `player-memory` 須保留。HANDOFF 禁區與 starter 同。`0.11.0/INDEX.md` 仍 `in progress`＝此句仍有效，不是未關洞。 |

### LOW

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| **L1** | **關閉** | INDEX 錨點：`setupDefaultForTest`／`commitDefaultWorld` 在 `program/kb.ts`（與 `setup.ts`）；`test-runtime-env.ts` 註明僅 `VIBE_GAMEVERSE_KB_WORLDS`、非 helper 定義處。 |
| **L2** | **關閉** | HOW「1–3 個開場 NPC JSON（傾向 2）」與 INDEX「最多 3、傾向 2」對齊。 |
| **L3** | **關閉**（設計層） | HOW UI：勿再寫死「預設：鏽燈酒館」「例如：第一次酒館」；未選不得 POST。現碼 `index.html`／`app.js` 仍舊文案＝Track C 實作，非契約漏。 |
| **L4** | **仍開**（非阻擋） | `mist-rite` 黑名單已鎖主要角色／商標；較冷原作姓氏未列。實作撰文仍禁原作（INDEX 已定案 4）。不擋開工。 |
| **L5** | **仍開**（本輪新增，非阻擋） | INDEX 已定案條號在 7 之後插入 **15**，再接 8–14。契約句已自足；實作若只掃「1–14」可能漏 Default commit。建議規劃收斂時改順號，**勿**當本檔已定案去改 INDEX（本輪不改）。 |

## 驗收對照

| 驗收句 | 設計層是否可測 | 第 2 輪缺口 |
|--------|----------------|------------|
| `kb/seed/rust-lamp/` 含原酒館；扁平刪除、無 stub | 是 | M1 已關 |
| Default commit 後 scene／gm_note／L2 屬該套；非 rust-lamp 無瑪拉／`bartender`／`tavern` | 是 | **H1 已關**；現碼未做 |
| 五套 player＋場景＋≤3 NPC；L2 於 commit 後有 psyche | 是（目錄＋commit 後檔） | H1／M4／M5 已關 |
| setup 無／非法 `template_id` → 400 | 是 | 錯誤碼已鎖 |
| 新 default 有 `template_id`；system 獨有句 | 是 | HOW 未預置 sentinel 正文；實作撰 canon 後測（非 HIGH） |
| 舊 default 無欄 → `rust-lamp` 可玩 | 是 | M2 已關（空字串／非法盤上值已寫） |
| Custom 不讀 `gm-default/*` | 是 | M3 已關 |
| 每套 mock 一拍不串台；無參 helper＝酒館 | 是 | 已定案 9／10；現碼仍 `source==default`→酒館 |
| `GET /api/templates` 五筆與 HOW 一致 | 是 | 現無此 API（未實作 ≠ HIGH） |
| `mist-rite` 無原作名地名 | 是（HOW 黑名單） | L4 仍開、非阻擋 |
| 刪世界／不偷灌；`bun test`；出貨文件 | 是 | M6 時序約束已寫 |
| 瀏覽器非酒館開局不是瑪拉 | 是 | 設計主路徑已寫死；待實作 |

## 與現碼抽樣

現碼未做本版 ≠ 設計 HIGH。下列為**提案必須推翻的現行行為**（實作預期 diff）。與初審表一致；H1 契約已補，碼尚未動。

| 錨點 | 現行（2026-09-10 抽樣） | 與 0.12 現契約 |
|------|------|----------------|
| `kb/seed/*.json` | 扁平五檔：`player`／`tavern`／`bartender`／`ash`／`sealed_note`；`loadSeedEntities` 掃根層 `*.json` | 遷入 `rust-lamp/`；只掃 `kb/seed/{id}/*.json` |
| `prompts/gm-default.md` | 單一酒館 canon；`buildPlaySystemPrompt` default 讀此檔 | 刪檔；改 `prompts/gm-default/{id}.md` |
| `WorldSchema` | 無 `template_id` | 可選欄；default 新寫必填；缺／空 coerce；非法失敗 |
| `commitDefaultWorld(saveName)` | copy 全扁平 seed；**寫死** `INITIAL_SCENE`／`INITIAL_GM_NOTE`／`touched: bartender,ash`／瑪拉灰 L2；已寫空 `player-memory` | 須收 `templateId`；依已定案 15 推導；保留空 player-memory |
| `setupDefaultForTest(saveName = "test")` | 僅一參＝顯示名 | 第二參可選，缺省 `rust-lamp`；`setupDefaultForTest("overreach")` 仍灌酒館 |
| `setupDefault`／`POST /api/setup/default` | 只讀 `save_name`；無 `/api/templates` | 必帶 `template_id`；缺→`missing_template_id`；非法→`invalid_template` |
| `gm-mock.ts` | `source==default`（或非 custom 且 `scene_id===tavern`）→瑪拉／灰；`split_constraint` 非 custom 亦 `bartender` | 依盤上 `template_id`；非 `rust-lamp` 零瑪拉／`tavern`；custom 霧港獨立 |
| `app.js`／`index.html` | `{ save_name }`；鈕「預設：鏽燈酒館」；placeholder「例如：第一次酒館」 | 先選模板再送；未選不得 POST；勿默送 `rust-lamp` |
| `ensureRuntime`／boot | 不偷灌 | 維持 |
| `0.11.0` | INDEX `in progress` | 勿平行改同一套 setup／world／mock／commit |

## 修復追蹤表

| ID | 級 | 狀態 | 關閉位置（INDEX 條／HOW 節） |
|----|----|------|------------------------------|
| H1 | HIGH | **關閉** | INDEX 已定案 **15**；HOW「Default commit」；驗收第 2 條；HANDOFF 禁區／starter |
| M1 | MEDIUM | **關閉** | INDEX 已定案 6＋驗收 1；HOW「模板目錄」 |
| M2 | MEDIUM | **關閉** | INDEX 已定案 7；HOW `world.json`／對局 prompt |
| M3 | MEDIUM | **關閉** | INDEX 已定案 7；HOW HTTP／UI；Track C |
| M4 | MEDIUM | **關閉** | INDEX 已定案 5；HOW 顯示表後 L2 |
| M5 | MEDIUM | **關閉** | INDEX 已定案 15；HOW L2 落點 |
| M6 | MEDIUM | **關閉** | INDEX 開頭上游句；HANDOFF 禁區／starter |
| L1 | LOW | **關閉** | INDEX 錨點表 |
| L2 | LOW | **關閉** | HOW 模板目錄 NPC 數量 |
| L3 | LOW | **關閉** | HOW UI（碼仍待 Track C） |
| L4 | LOW | 仍開 | 非阻擋；HOW 黑名單＋已定案 4 |
| L5 | LOW | 仍開 | 本輪新增；INDEX 條號 15 插隊；非阻擋 |

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-09-10 | 可自洽、非整案不可行；**H1 仍開**故門檻未過；應修 M1–M6 |
| 第 2 輪複審 | 2026-09-10 | 規劃關閉項已核對進檔；**無未關閉 HIGH**；門檻**通過**；非整案不可行；應修 MEDIUM 已全關；L4／L5 非阻擋 |
