# 0.12.0 多套 Default 模板

- 上游：[0.11.0 玩家過強輸入與 GM 控場](../0.11.0/INDEX.md)（實作本版時視為樹上已有 0.11 契約：`player-memory`、setup 空檔、不偷灌 seed）。**勿與未收斂的 0.11 平行改同一套** `setup`／`world.json`／mock／`commitDefaultWorld`；空 `player-memory` 須保留。
- Changelog：根目錄 [`changelog.md`](../../../changelog.md)；同步 `VERSION.md` 與 `AGENTS.md`
- 狀態：`shipped`
- 日期：2026-09-10（Asia/Hong_Kong）

## 產品句

開新 Default 世界時，玩家可從 **多套預寫起始劇本** 選一套（仍 copy 該套 seed → 該 uuid，不是把使用者原文當 seed），或走既有 custom 引子。每套：單場景、小卡司、一條鉤子，規模對齊現行鏽燈酒館。

## 文件地圖

1. 本檔（WHAT）
2. [`docs/default-templates.md`](./docs/default-templates.md)（HOW：目錄、API、UI、mock）
3. [`docs/reasoning.md`](./docs/reasoning.md)（WHY）
4. 開工：[`HANDOFF.md`](./HANDOFF.md)
5. 設計審查：[`docs/design-review.md`](./docs/design-review.md)

## 與上一版對照

| 行為 | 0.11.0／現行 | 0.12.0 |
|------|-------------|--------|
| Seed | 扁平 `kb/seed/*.json` 僅酒館 | `kb/seed/{template_id}/` 五套 |
| `POST /api/setup/default` | `{ save_name }` 固定酒館 | 必帶合法 `template_id` |
| `world.json` | `source: "default"` | 另加 `template_id`；舊檔缺欄＝`rust-lamp` |
| 對局 default system | `gm-contract` + `gm-default.md` | + **該模板** canon 檔；禁讀別套 |
| 主頁 | 「預設世界」一顆 | 列出五套名＋一句導語，再填 `save_name` |
| Mock default | 酒館 fixture | 每套至少一條對局 mock，**禁止**串到瑪拉／灰／`tavern` |

## 已定案

1. **範圍。** 五套 Default（既有鏽燈＋四套新題材）＋主頁選模板＋`template_id` 進 `world.json` 與 setup。不改 custom 生成器以模板為底。不做模板編輯器、章節切換、寒蟬循環存檔、圖像、多地點。
2. **模板 id（鎖定）。** `rust-lamp`｜`cyberpunk`｜`sword-dungeon`｜`esper-city`｜`mist-rite`。未知 id → setup **400**，**禁止** coerce 成酒館。
3. **顯示名與導語（主頁，繁中鎖定）。** 見 HOW 表。`mist-rite` 產品名 **「霧隱集會所」**，**不用**「寒蟬」商標／原作角色地名。
4. **`mist-rite` 結構邊界。** 只借封閉社區、祭典週、口徑不一、親切表面下的監視、短鉤「今晚不要出門」。**禁止**原作角色名、商標地名、劇情轉寫、循環殺局系統。卡司 **全員明確成年**（職業或年齡區間寫在 seed）。兒童不得 `present`、不得台詞、不得成為可帶向的性描寫對象。
5. **規模。** 每套恰好一個 `scene_id`／一個 place。開場 NPC **最多 3**（傾向 2，與酒館同量）。一條鉤子，無任務日誌。不做樓層／都市旅行／入侵小遊戲。每套開場 **至少一名** `memory_tier === 2`（傾向兩名；上限仍 3 NPC）。僅標 2 者建 `l2/`＋0.10 psyche。路人不要預寫進 seed。
6. **磁碟。** `kb/seed/{template_id}/` **只**放 Entity JSON（player／place／NPC／可選鉤子物；可有同名 `player.json`，互不碰撞）。**禁止**把 runtime `scene.json`／`gm_note.txt`／psyche 當 seed 實體。現行扁平 `kb/seed/*.json` **遷入** `kb/seed/rust-lamp/` 後刪除扁平檔（無 re-export stub），劇情等價。這是 **repo 模板搬遷**，不是玩家 `kb/worlds` hop，也 **不**與 [kb-runtime-upgrade](../backlog/kb-runtime-upgrade.md) 綁成同一版。
7. **`world.json`。** 維持 `source: "default" | "custom"`。Default 新寫入必填 `template_id`。讀取 `source === "default"`：缺欄或空字串 → 視為 `rust-lamp`（coerce 可寫回）；盤上值非五套之一 → load／組 prompt **失敗**（500 `invalid_template`），**禁止** coerce 酒館。Custom 若檔上或 `POST /api/setup/custom` body 帶 `template_id`：**忽略該欄**、**不**寫入 `world.json`、不讀 `gm-default/*`、**不**因此 parse 失敗、**不**寫回酒館。Load／對局組 prompt 用盤上已解析的 `template_id`，禁止用 pointer 猜測。
8. **Canon。** 刪除 repo 根 `prompts/gm-default.md`（**禁止** re-export／轉址雙源）。對局 default system＝`gm-contract.md` + **`prompts/gm-default/{template_id}.md`** + 該 uuid NPC `persona`。禁止開 A 讀 B。Custom 仍契約前綴 + 該 uuid `gm_canon.md` + persona，**不**讀任何 `gm-default/*`。禁止讀 `npc-*.md`。
9. **HTTP。** `POST /api/setup/default` body：`save_name` + `template_id` 皆必填。缺 `template_id`（含空字串）→ 400 `{ "error": "missing_template_id" }`；非法 id → 400 `{ "error": "invalid_template" }`（舊客戶端須改）。`GET /api/templates`：home **與** playing 皆可；回傳 id／display_name／blurb 列表（無 seed 全文）；順序見 HOW 表。`setupDefaultForTest` 維持第一參數為 **存檔顯示名**（現測 `setupDefaultForTest()`／`setupDefaultForTest("overreach")` 仍灌酒館）；第二參數可選 `templateId`，缺省 **`rust-lamp`**；不跑開場。
10. **Mock。** `GM_MODE=mock`：default 依 `template_id` 走該套 fixture。**禁止**非 `rust-lamp` 出現瑪拉／`bartender`／灰／`ash`／鏽燈酒館場景。每套 **至少** 一則測試：setup 該 id 後 mock 一拍，assert 場景／npc_id 屬於該套。Custom 霧港維持獨立。
11. **Coerce。** 缺 NPC／scene 欄 **禁止**填酒館預設（0.3.0 已有）；本版擴到禁止未知模板填 `rust-lamp`。
12. **UI。** 主頁選 Default：先選模板（名＋導語），再填存檔顯示名並送出。不要華麗卡片商城。Header／title 仍跟 `save_name`，不跟模板商標句。
13. **0.11 相容。** `commitDefaultWorld` 不論哪套皆寫空 `player-memory/current.json`（與 0.11 已定案）。控場類別「相對本場 canon」自然吃該模板 `gm-default`＋player-memory；本版 **不**改過線 HTTP。
14. **測試與出貨。** 隔離 `VIBE_GAMEVERSE_KB_WORLDS`；禁止 `rm` live `kb/worlds`。出貨 `VERSION.md`＝`0.12.0`；changelog；`AGENTS.md`（主頁改「選模板」）；刪 backlog 本列與 `default-world-templates.md`。瀏覽器：主頁切一套非酒館 setup 進對局，確認不是瑪拉開場。
15. **Default commit（推翻現碼酒館常數）。** `commitDefaultWorld`／`setupDefault` 依 `template_id` copy **僅**該目錄 Entity。`scene.json`：`scene_id`＝該套唯一 place 的 `id`；`present`＝`player`＋該套開場 NPC id（不得塞他套）。`gm_note.txt` 寫該套幕＋鉤子（`rust-lamp` 可與現行 `INITIAL_GM_NOTE` 劇情等價）。`npc-memory` dirty-set 與 `l2/{id}/` **只**為該套 `memory_tier === 2` 的 NPC 建立。禁止五套共用現碼 `INITIAL_SCENE`／瑪拉／灰 dirty／L2 常數。`rust-lamp` 的 L2 current／psyche 可留現碼預製常數；新四套在 commit 時寫入（空六欄或短預製皆可），**不要**把 psyche JSON 混進 seed 目錄。

## 開工前仍須拍板

無（id、顯示名、霧隱命名、目錄、`template_id` 欄、mock 每套一測已鎖定）。各套 **具體 NPC 名／鉤子正文** 由實作按 HOW 骨架撰寫原創；design-review 可改文案但不得改已定案邊界（尤其 `mist-rite` 禁原作）。

## 非目標

- 玩家／社群上傳模板；以模板為底再 primer
- 五套變成同一世界的可切換章節
- 真・循環周目、戰鬥、多地點狀態機
- 圖像管線；華麗模板商店 UI
- `kb/worlds` store_version hop（與 kb-runtime-upgrade 分開）
- 改 0.11 控場契約

## 驗收

- [x] `kb/seed/rust-lamp/` 含原酒館實體；repo 根 **無** `kb/seed/*.json`（扁平檔已刪，無 re-export stub）。
- [x] Default commit 後 `scene.json`／`gm_note.txt`／L2 目錄屬於該套，非酒館常數（非 `rust-lamp` 無瑪拉／`bartender`／`tavern`）。
- [x] 五套目錄皆有 player＋場景＋≤3 NPC；L2 者有 `memory_tier: 2` 與 psyche 檔於 Default commit 後。
- [x] `POST /api/setup/default` 無 `template_id` → 400；非法 id → 400。
- [x] `world.json` 新 default 含正確 `template_id`；對局 system 含該套 `gm-default/{id}.md` 獨有句、不含其他套獨有句。
- [x] 舊 default 存檔無 `template_id` → 當 `rust-lamp` 可玩。
- [x] Custom setup **不**讀 `gm-default/*`。
- [x] 每套 mock 一拍不串台；`setupDefaultForTest()` 無參＝酒館。
- [x] `GET /api/templates` 五筆顯示名與 HOW 一致。
- [x] `mist-rite` seed／canon **無**原作角色名與商標地名。
- [x] 刪世界／new default 不偷灌；`bun test` 全綠；出貨文件與 backlog 清理。
- [x] 瀏覽器：非酒館模板開局可見該套 NPC／場景，不是瑪拉。（出貨同意；隔離 HTTP mock setup 已代驗非酒館開局）

## 實作軌道

### Track A — Seed 遷徙與目錄契約

- **做：** 遷 `rust-lamp`（刪扁平 `kb/seed/*.json`）；建四套 seed JSON＋`prompts/gm-default/{id}.md`；讀 seed 只掃子目錄。
- **不做：** UI（C）、mock 全文（B 可並行 fixture）。
- **本軌驗：** repo 無扁平 seed；五套目錄可被 copy；`mist-rite` grep 無禁詞。

### Track B — Setup／world／對局 prompt／mock

- **做：** `template_id`、setup HTTP 錯誤碼、組 system、mock 分套、`setupDefaultForTest` 雙參數。
- **不做：** 主頁選單視覺（C）。
- **本軌驗：** 缺／非法 id 400；無參測試 helper＝酒館；每套 mock 一拍不串台；對局 system 不含他套獨有句。

### Track C — 主頁 UI

- **做：** 模板列表＋導語＋既有 `save_name`；接 `GET /api/templates`。
- **不做：** 商城風。
- **本軌驗：** Default 路徑須選模板才送出；Custom 不送 `template_id`。

### Track D — 測試與出貨文件

- **做：** 補齊驗收窄測；VERSION／changelog／AGENTS；刪 backlog。
- **本軌驗：** `bun test` 全綠；瀏覽器非酒館開局。

## 錨點檔案

| 路徑 | 用途 |
|------|------|
| `kb/seed/` | 改為 `kb/seed/{template_id}/` Entity JSON；無扁平根檔 |
| `prompts/gm-default/{template_id}.md` | 該套 Default canon；已刪根層 `gm-default.md` |
| `program/setup.ts`、`program/kb.ts` | `commitDefaultWorld`、`setupDefaultForTest`、copy seed；推翻酒館 `INITIAL_SCENE`／`INITIAL_GM_NOTE` |
| `program/gm-pi.ts` | default system 前綴 |
| `program/gm-mock.ts` | 分套 fixture |
| `program/schema.ts` | `world.json` `template_id` |
| `program/server.ts` | setup／templates |
| `program/public/app.js`、`index.html` | 主頁選模板 |
| `program/test-runtime-env.ts` | 測試隔離 `VIBE_GAMEVERSE_KB_WORLDS`（非 helper 定義處） |

## 行為約束

- 繁體中文書面語；不 commit 除非使用者要求。
- 勿 `rm` live `kb/worlds`。例證與卡司皆原創虛構。
- 狀態已 `shipped`；後續改動另開版本。
