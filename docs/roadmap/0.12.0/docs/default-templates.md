# 0.12.0 HOW — 多套 Default 模板

契約以 [INDEX](../INDEX.md) 為準。卡司與鉤子正文由實作撰寫；此處鎖結構。例證虛構。

## 模板目錄

```text
kb/seed/rust-lamp/      # 自現行扁平檔遷入，語意不變
kb/seed/cyberpunk/
kb/seed/sword-dungeon/
kb/seed/esper-city/
kb/seed/mist-rite/
prompts/gm-default/{template_id}.md
```

刪除 repo 根層 `kb/seed/*.json`（`git mv` 進 `rust-lamp/`：現行 `player.json`、`tavern.json`、`bartender.json`、`ash.json`、`sealed_note.json`）。測試與程式 **只**掃 `kb/seed/{id}/*.json`，且 **僅** `EntitySchema.parse` 通過者進 `entities.json`。禁止留下扁平檔或 re-export stub。禁止在 seed 目錄放 runtime `scene.json`、`gm_note.txt`、`psyche.json`。

每套至少：`player.json`、恰好一個 place JSON、1–3 個開場 NPC JSON（傾向 2）、一條鉤子物或等價 entity（可選）。`scene_id` 每套唯一，**禁止**五套都叫 `tavern`（酒館可保留 `tavern`）。`rust-lamp` 保留現行 npc_id `bartender`／`ash`；其餘四套必須新 snake_case，禁止重用這兩個 id。

## 顯示表

| `template_id` | 顯示名 | 導語（一句） | 場面鎖死 | 卡司方向 | 鉤子方向 |
|---------------|--------|--------------|----------|----------|----------|
| `rust-lamp` | 鏽燈酒館 | 邊鎮酒館裡，一張蠟封紙條還沒拆開。 | 鏽燈酒館內 | 老闆＋神秘客（現行瑪拉／灰） | 蠟封紙條／北路燈手 |
| `cyberpunk` | 霓虹診所 | 雨夜診所裡，一筆不該接的活還亮著。 | **一間**地下診所，不是整座巨城 | 玩家＋醫師或掮客 1–2 人 | 一筆委託／植入物／被抹的記憶 |
| `sword-dungeon` | 封門前廳 | 地城門還鎖著，通緝令在火邊發脆。 | 地城第一層前廳／篝火，不是樓層地圖 | 玩家＋接案人或同伴 1–2 | 通緝／封門／會動的遺物 |
| `esper-city` | 仲介夜室 | 「市區禁止釋放」的告示還新，傳聞已經舊了。 | **一處**能力仲介所室內 | 玩家＋仲介或目擊者 1–2 | 失控傳聞或禁令告示 |
| `mist-rite` | 霧隱集會所 | 祭日前夜，同一句話對不上三個人的嘴。 | 村裡唯一集會所 | 玩家＋2 名**成年**村民／外人 | 祭典謠言、口徑、今晚不要出門 |

NPC `id` 必須 **新 snake_case**，禁止四套新模板重用 `bartender`／`ash`。

L2：每套至少一名開場 NPC `memory_tier: 2`（傾向兩名）。Default commit 寫 `l2/{id}/current.json`＋`psyche.json`。`rust-lamp` 可沿用 `kb.ts` 現有瑪拉／灰預製常數；新四套在 commit 時寫入（空六欄或短預製皆可），**不要**把 psyche 當 Entity 混進 seed。

`mist-rite`：原創鎮名用「霧隱」。seed／canon／顯示名／導語 **字串黑名單**（測試 grep，大小寫不敏感）：`雛見澤`、`寒蟬`、`ひぐらし`、`Higurashi`、`Rika`、`Satoko`、`Keiichi`、`Rena`、`Mion`、`Shion`、`Hanyuu`、`Oyashiro`。職業寫「祭典委員／外來記錄者」等，並在 persona 或 entity 欄寫明成年（年齡區間或成年職業即可）。兒童不得出現在 seed `present`、開場台詞、或可帶向性描寫對象。

## `world.json`

```text
{ "id", "save_name", "source": "default" | "custom", "template_id"?: string, ...既有欄 }
```

新 default：**必寫** `template_id`。Parse：`source === "default"` 且缺欄或空字串 → 當 `"rust-lamp"`（可寫回檔）。盤上值非五套之一 → 失敗，禁止 coerce。`source === "custom"`：**忽略** `template_id`（有該欄也不 fail parse、不寫入、不 coerce 酒館、對局不讀 `gm-default/*`）。

## HTTP

`GET /api/templates` → `{ "templates": [ { "id", "display_name", "blurb" } ] }` 順序依上表。home 與 playing 皆 200；不需 playing。不回 seed 全文。

`POST /api/setup/default` `{ "save_name", "template_id" }`。僅 `screen === "home"`（非 home 維持現行 409）。缺 `template_id` 或 trim 後空字串 → 400 `{ "error": "missing_template_id" }`。非五套之一 → 400 `{ "error": "invalid_template" }`。成功則 `commitDefaultWorld(saveName, templateId)`（見下節），開場隱含句仍為「我環顧四周。」（不進 UI 氣泡），規則同 0.7／0.11。

`POST /api/setup/custom` 若 body 帶 `template_id`：忽略、不寫入 `world.json`、不讀 `gm-default/*`。

`setupDefaultForTest(saveName = "test", templateId = "rust-lamp")`。第一參數仍是存檔顯示名：既有 `setupDefaultForTest()` 與 `setupDefaultForTest("overreach")` **必須**仍灌 `rust-lamp`。測非酒館時用第二參數，例如 `setupDefaultForTest("test", "esper-city")`。不跑開場。

## Default commit（推翻酒館硬編碼）

現碼 `commitDefaultWorld` 寫死 `INITIAL_SCENE`（`tavern`＋`bartender`／`ash`）、`INITIAL_GM_NOTE`、dirty-set `["bartender","ash"]`、瑪拉／灰 L2。本版必須按 `template_id` 推導，禁止他套落到這些常數。

1. 讀 `kb/seed/{template_id}/*.json` → Entity 陣列（恰好一個 `kind: "place"`）。
2. `scene.json`：`scene_id`＝該 place 的 `id`；`present`＝player id＋該套全部開場 NPC id（不含他套、不含僅存在於別套的 `bartender`／`ash`）。
3. `gm_note.txt`：該套開場幕＋鉤子一句至數句。`rust-lamp` 正文可與現行 `INITIAL_GM_NOTE` 等價。
4. `entities.json`＝上列 Entity；`world.json` 含 `source: "default"` 與 `template_id`。
5. `npc-memory/dirty-set.json` 的 `touched`＝該套 `memory_tier === 2` 的 npc id 列表（可空則僅當該套無 L2——但本版契約要求至少一名 L2，故非空）。
6. 對每個 L2 npc：寫 `npc-memory/l2/{id}/current.json` 與 `psyche.json`。`rust-lamp` 可複製現碼預製；新套寫空或短六欄。
7. 一律寫空 `player-memory/current.json`（0.11）。缺 seed 目錄或缺 canon 檔 → 失敗，禁止改 copy `rust-lamp`。

## 對局 prompt

刪除 `prompts/gm-default.md`。Default：`gm-contract.md` + `prompts/gm-default/{world.template_id}.md` + runtime personas。`template_id` 來自盤上已解析 world（缺欄／空字串已 coerce 為 `rust-lamp`；非法值不得進這條路徑）。檔不存在 → setup／組 prompt **失敗**（HTTP 500 `missing_canon` 或等價內部錯誤），**禁止**改讀酒館檔。合法 id 而缺 seed 目錄同理，禁止 coerce。Custom **零**讀 `prompts/gm-default/`。

Mock：`gm-mock.ts` 依 `template_id` 選 fixture（非 switch-fallthrough 到酒館）。非 rust-lamp 的 fixture **零** `bartender`／`ash`／瑪拉／灰／`tavern`。每套至少一拍：場景 `scene_id` 與 npc_id 屬於該套 seed。Harbor custom 霧港維持獨立。

## UI

主頁「開始新故事」Default 路徑：渲染 `#template-list`（五鈕或五列，文案＝顯示表），**必須先選中一套**再填 `save_name` 送出；未選不得 POST（前端禁用送出即可，勿默默送 `rust-lamp`）。按鈕／placeholder 勿再寫死「預設：鏽燈酒館」「例如：第一次酒館」；可改為「選一套起始劇本」與「存檔顯示名」。Custom 路徑不出現模板列表；body **不含** `template_id`（即使誤帶，server 忽略）。進行中 header／`<title>` 仍只顯示 `save_name`。

## 測試 BAN

- 未知 `template_id` 不得變成酒館實體。
- `esper-city` setup 後 entities 無 `bartender`。
- `mist-rite` 檔案 grep 禁詞。
- 不 `rm` live `kb/worlds`。
