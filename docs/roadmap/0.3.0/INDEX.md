# 0.3.0 執行期只寫 `kb/`：NPC 人設離開 source

- 上游：[0.2.0 世界起始劇本](../0.2.0/INDEX.md)（`shipped`）
- 構想來源：原 `backlog/immutable-source.md`（本版 shipped 後已刪）
- Changelog：出貨時寫根目錄 [`changelog.md`](../../../changelog.md)；同步 `VERSION.md` 與 `AGENTS.md`
- 狀態：`shipped`
- 日期：2026-09-06（Asia/Hong_Kong）

## 產品句

**寫入**只准 `kbRuntimeDir`（預設 `kb/runtime/`；測試用 `VIBE_GAMEVERSE_KB_RUNTIME`）。**讀**仍允許 repo 的 GM／生成器檔（`gm-contract.md`、`gm-default.md`、`world-generate.md`）。**NPC 人設永遠不是 source code**：刪除 `prompts/npc-*.md`；對局人設只讀 **runtime** `entities.json`（不讀 seed、不讀 repo npc 檔）。default 瑪拉／灰與 custom／中途角色一律是該場世界資料。

## 文件地圖

閱讀順序：

1. 本檔（WHAT）
2. [`docs/immutable-source.md`](./docs/immutable-source.md)（HOW）
3. [`docs/reasoning.md`](./docs/reasoning.md)（WHY）
4. [`docs/design-review.md`](./docs/design-review.md)（審查輪次；契約仍以本檔＋HOW 為準）
5. [`HANDOFF.md`](./HANDOFF.md)（本版已 shipped；歷史實作交接，勿再當開工指令）

規格對照（勿當本版契約；僅背景）：`docs/handover.md`、`docs/brainstorm.md`、根目錄 `AGENTS.md`、[0.2.0 INDEX](../0.2.0/INDEX.md)。

## 與上一版對照

| 行為 | [0.2.0](../0.2.0/INDEX.md) | 0.3.0 |
|------|----------------------------|--------|
| Repo `prompts/` | GM 契約＋`gm-default.md`＋**`npc-bartender.md`／`npc-ash.md`**；殘留 `prompts/gm.md` | **僅** GM 契約／`gm-default.md`／`world-generate.md`／（可留）`writer.md`。**禁止** `npc-*.md`。刪殘留 repo `prompts/gm.md` |
| Default 對局 system | `gm-pi.ts` 讀 repo：contract + gm-default + **兩個 npc 檔** | contract + gm-default（仍 repo）+ **runtime** NPC `persona` 區塊。**禁止** `readFile(repo/prompts/npc-*.md)` |
| Custom 對局 system | contract + `kb/runtime/prompts/gm.md` | contract + `kb/runtime/gm_canon.md` + 同樣從 runtime 組 NPC `persona` 區塊（有欄才附） |
| Default 開場人設落點 | seed JSON（短 summary／notes）**另**一份 source markdown | 人設進 `kb/seed/*.json` 的 **`persona`**；setup copy 進 runtime；對局不回讀 seed |
| 0.2.0 已定案 9 | 開場卡司可在 seed **加上** `prompts/npc-*.md` | **推翻該句的 npc 檔部分**。開場卡司只在 `kb/seed`（模板）與 runtime |
| 舊存檔 | 未 public release | **不做 migrate**。不讀舊路徑 `runtime/prompts/gm.md`。缺 `gm_canon.md` 的 custom 局 → `needs_setup` |
| needs_setup | 僅有效 `world.json`（shipped 程式已不指紋） | 仍不指紋；**另**：custom 缺／空 `gm_canon.md` 與無效 world **同形**（見已定案 9） |

**其餘 0.2.0 契約以 shipped 程式＋本版對照表為準**（兩條起始路徑、原子 commit、dispose／createPlaySession、coerce、mock harbor、single-flight 等）。**不要**把 0.2.0 INDEX 裡已作廢的「無 world.json 用 seed id 指紋補 default」實作回來。Compact／`store_version` migrate 仍禁。

## 已定案

1. **GM 固定行為可留 source。** `prompts/gm-contract.md`、`prompts/gm-default.md`、`prompts/world-generate.md` 可留在 git。這是程式怎麼當 GM／怎麼生成世界，不隨某一場存檔變。
2. **NPC 人設永遠不准寫在 source。** 禁止 `prompts/npc-*.md`；禁止在 `program/` 內嵌瑪拉／灰／custom NPC 的人設長文（mock 對局短 fixture 台詞除外，與 0.2.0 相同）。Default 瑪拉／灰、custom 開場 NPC、遊玩中 Writer 新角色，都是 **該場世界資料**。
3. **人設欄位：`Entity.persona`（optional string）。** 給 GM system 的角色表（語氣、`npc_id`、何時交線索）。`summary`／`private_notes` 語意不變。preprocess：trim；空或僅空白視為 **缺欄（`undefined`）**，組 prompt 不加區塊；非空才須 length 1–**2000**（UTF-16），否則生成／parse 失敗。缺欄＝無獨立角色表（仍可靠 `gm_canon`／`gm-default`／memory_slice 的 summary）。**本版禁止改 `MemorySlice` 形狀**（仍是 episode 摘要 + entity 的 id／name／summary + relations）。秘密只寫在 `persona`／`gm_canon`／`gm-default`／`gm_note`，不要把 notes／persona 塞進每回合 slice。
4. **Default 模板在 `kb/seed/`。** 將現行 `prompts/npc-bartender.md`、`npc-ash.md` **全文**遷入 `kb/seed/bartender.json`、`ash.json` 的 **`persona`**（劇情等價，不改酒館故事）。**禁止**把 md 與 `private_notes` 併成一欄、禁止用 md 覆寫 notes、禁止只加長 `summary` 充當角色表。`kb/seed/` 執行期**只讀**：僅 `commitDefaultWorld`／`setupDefaultForTest` copy 進 runtime。對局 **禁止**再讀 seed 組 system prompt。
5. **對局只讀 runtime 人設。** `buildPlaySystemPrompt`：先載入 runtime `entities.json`；對每個 `kind === "npc"` 且 `persona` trim 後非空的實體，按 **id 升序** 附加區塊（格式見 HOW）。Default 與 custom **同一慣例**。不要寫死只拼 `bartender`／`ash` 兩個 id（custom 開場 NPC 才吃得到）。
6. **Default system 組成（順序固定）：** `gm-contract.md` + `gm-default.md`（皆 repo）+ runtime NPC persona 區塊。**不要**再讀任何 `npc-*.md`。
7. **Custom system 組成（順序固定）：** `gm-contract.md`（repo）+ `kb/runtime/gm_canon.md` + runtime NPC persona 區塊。生成器 `gm_canon` 仍是世界／場面規則，不是 repo prompt。
8. **Custom `gm_canon` 檔名：`kb/runtime/gm_canon.md`。** 禁止再使用 runtime 子目錄 `prompts/`。`commitCustomWorld` 寫此檔；`loadCustomGmCanon` 只讀此檔。`clearPlaythrough`／原子 commit 前清理須刪 `gm_canon.md`，並 **仍刪** 舊的 `runtime/prompts/`（殘目錄），避免半套與新檔並存。
9. **`syncWorldGate` 是唯一 ready 真相**（優先序寫死，勿拆成「先舊函式再額外」）：
    1. 無 `world.json` 或無效（壞 JSON／缺欄／非法 source）→ `{ needs_setup: true, world: null }`。不改寫該檔。
    2. 有效 world 且 `source === "custom"`，且 `gm_canon.md` 讀不到或 trim 為空 → **同樣** `{ needs_setup: true, world: null }`（與無效 world **同形**）。**禁止** fallback 讀 `runtime/prompts/gm.md`。不要在 boot migrate 或刪 `world.json` 來「修好」缺 canon。
    3. 其餘有效 world（含 default，**忽略** `gm_canon.md` 是否存在）→ `{ needs_setup: false, world }`。
    `loadValidWorld`、`GET /api/state`、`assertCanSetup`、`getSession`／`createPlaySession` **都必須跟這份 gate**。gate 已 needs_setup 時不得組對局 prompt。`loadCustomGmCanon` 缺檔或空不得變成未捕捉 500：應走 409 `needs_setup` 或根本不被呼叫。Default 不需要 `gm_canon.md`。
10. **生成器與校驗。** `persona` 可省略（空字串當缺欄，見第 3 條）。非空則 trim 後 length 1–**2000**，否則整次生成失敗。引子洩漏檢查擴及 `persona`：任一 primer 欄 trim 後 length ≥ 8，不得與任一 entity 的 `summary`、`private_notes`、**`persona`** 全等，亦不得被這三欄整段包含。`entityLeaksPrimer`、`EntitySchema`／`GeneratedWorld`、`prompts/world-generate.md`、以及 `world-generate.ts` 的 **userPrompt 與 retry 字串** 必須寫同一套三欄＋2000 上限（勿只改 zod）。
11. **Writer 不寫 repo `prompts/`、不寫 `kb/seed/`。** 維持只改 runtime 的 episodes／entities／relations。新 NPC 可不帶 `persona`（與今日「不預寫 npc md」等價）。本版不要求 Writer 從 events 推人格長文。
12. **執行期禁止寫入 `kb/` 以外。** 本 app 的 setup／turn／new-game／Writer **不得** `writeFile` 到 repo `prompts/` 或 `kb/seed/`。測試 runtime 仍只許 `VIBE_GAMEVERSE_KB_RUNTIME`。允許讀 repo `prompts/` 的 GM／生成器檔。
13. **本版刪檔（實作同一 Track 內完成，不要留「之後再刪」）：** repo `prompts/npc-bartender.md`、`prompts/npc-ash.md`、殘留 `prompts/gm.md`（已拆到 contract／default，對局程式已不讀它）。`prompts/writer.md` 可留（目前非對局熱路徑）。
14. **推翻 0.2.0 已定案 9 中「default 開場卡司寫在 seed 加上 `prompts/npc-*.md`」。** 改為只在 seed JSON（含 `persona`）與 runtime。GM 契約與 `gm-default.md` **維持**在 `prompts/`。
15. **測試必須鎖住 BAN。** 必做：
    - (a) 灌 default 後 `buildPlaySystemPrompt` 含 **persona 獨有句**（不得只斷言「瑪拉」——`gm-default.md` 已有該名）；且 repo `prompts/npc-*.md` **不存在**時仍成功。
    - (b) 改 runtime 某 NPC 的 `persona` 後重組 prompt **跟隨 runtime、不跟隨 seed**。
    - (c) custom commit 產生 `gm_canon.md`、**不**產生 `runtime/prompts/gm.md`。
    - (d) setup／turn 測試後 repo `prompts/` **檔名集合不變**、無新 `npc-*.md`（BAN 寫入）。
    - (e) custom 有效 world、無 `gm_canon.md` → `getNeedsSetup() === true`；即便殘留 `runtime/prompts/gm.md` 仍 needs_setup，且組 prompt **不讀**舊檔。
    - (f) new-game／clear 後 `gm_canon.md` 與 `runtime/prompts/` 皆不存在。
    刪檔順序：先改 loader 與測、確認程式不讀 repo npc 路徑，**再**刪 `npc-*.md`／殘留 `prompts/gm.md`。禁止先刪檔、靠「檔還在」讓舊測試綠。
16. **Mock／UI／setup HTTP／coerce：** 不改 shipped 0.2.0 **程式**行為，除非為了讀新檔名、`persona` schema、或已定案 9 的 gate。Harbor fixture **不必**填 `persona`（custom mock 仍靠 `gm-mock.ts` 分支）。**不要**依 0.2.0 INDEX 的指紋句改 `syncWorldGate`。

開工前仍須拍板：無。

## 非目標

- 不重做世界生成器產品流程、不改酒館劇情正文（只搬家設檔位）
- 不做多 NPC agent、不把 Writer 變回第二個模型
- 不把 **GM** 契約從 `prompts/` 整包搬進 `kb/`
- 不做多存檔槽、KB `store_version` migrate（見 [`../backlog/kb-runtime-upgrade.md`](../backlog/kb-runtime-upgrade.md)）
- 不做 session compact（見 [`../backlog/session-compact.md`](../backlog/session-compact.md)）
- 不恢復「無 world.json 用 seed id 指紋補 default」（已作廢；`AGENTS.md`／現行 `syncWorldGate` 已是只認有效 world）
- 不改 OpenRouter 直連；不做人設編輯器 UI

## 驗收

- [x] repo **沒有** `prompts/npc-*.md`、**沒有** `prompts/gm.md`。`gm-pi.ts`／`kb.ts` **沒有**讀這類路徑。
- [x] `kb/seed/bartender.json` 與 `ash.json` 有 `persona`，語意與刪除前 npc markdown 等價（瑪拉語氣／灰交紙條）。
- [x] Default setup 後對局 system＝contract + gm-default + **runtime** persona；改 runtime persona 再組 prompt 會變；不讀 seed 檔組 prompt。
- [x] Custom commit 寫 `kb/runtime/gm_canon.md`（測試隔離目錄下等價路徑）；無 `prompts/` 子目錄新檔。
- [x] Custom 有有效 world 但無 `gm_canon.md` → `needs_setup: true` 且 state 的 `world === null`；不讀舊 `runtime/prompts/gm.md`；setup 可重選（非 409 already ready）。
- [x] 引子洩漏檢查含 `persona`；過長 `persona`（>2000）生成失敗。
- [x] `bun test` 全綠；測試用 `VIBE_GAMEVERSE_KB_RUNTIME`；**禁止** `rm` 專案 live `kb/runtime`。
- [x] `AGENTS.md` 檔案樹與 Default／Custom system 句已改成本版路徑。出貨時 `VERSION.md`＝`0.3.0`。

## 實作軌道

### Track A — Schema 與 seed 人設

- **做：** `EntitySchema` 加 optional `persona`（空→undefined，非空 1–2000）；seed 兩名 NPC 的 **persona＝現行 npc md 全文**、notes 不動；`entityLeaksPrimer` 三欄；`world-generate.md` **與** `world-generate.ts` userPrompt／retry 同一套。
- **不做：** 改酒館 summary 劇情；強制 custom 每個 NPC 都有 persona。
- **驗收：** parse seed 過；harbor fixture 無 persona 仍過。

### Track B — Runtime 檔名與清理

- **做：** `paths.gmCanon` → 相對 runtime 的 `gm_canon.md`（`atomicCommitPlaythrough` 的 key 不是 `kb/runtime/...`、不是 `prompts/gm.md`）；`PLAYTHROUGH_FILES`／`clearPlaythrough` 刪 `gm_canon.md` **且** recursive 刪殘 `prompts/`；**改寫 `syncWorldGate`** 如已定案 9；對齊 `loadValidWorld`／`assertCanSetup`／`loadCustomGmCanon`。
- **不做：** 讀舊檔 migrate。
- **驗收：** custom 測試檔落在 `gm_canon.md`；缺檔 needs_setup。

### Track C — 對局只讀 runtime 人設

- **做：** `buildPlaySystemPrompt` 如已定案 6–7；刪 repo `npc-*.md` 與 `prompts/gm.md`；清所有程式引用。
- **不做：** 每回合重讀 seed；把 GM 契約搬進 kb。
- **驗收：** 無 npc 檔仍能組 default prompt；runtime 覆蓋生效。

### Track D — 回歸測與文件

- **做：** 已定案 15 的測試；更新 `AGENTS.md`；出貨時 version／changelog。
- **不做：** 重寫 0.2.0 歷史 INDEX 正文（可在 0.3.0 對照表指出推翻點即可）。

## 錨點檔案

| 路徑 | 用途 |
|------|------|
| `program/gm-pi.ts` | `buildPlaySystemPrompt`：repo 契約／`gm-default.md` + runtime NPC `persona`（不讀 seed、不讀 `npc-*.md`） |
| `program/kb.ts` | `paths.gmCanon`＝`gm_canon.md`、`commitCustomWorld`、`clearPlaythrough`、`PLAYTHROUGH_FILES`、`syncWorldGate`、`loadValidWorld`、`loadCustomGmCanon` |
| `program/setup.ts` | `assertCanSetup` 跟 gate；缺 canon 的 custom 可重選 |
| `program/schema.ts` | `Entity.persona`、`entityLeaksPrimer` 三欄、生成器 entity |
| `program/world-generate.ts`／`prompts/world-generate.md` | zod **與** userPrompt／retry 同一套 persona 規則 |
| `program/writer.ts` | 只寫 runtime JSON；upsert 可不帶 persona |
| `kb/seed/bartender.json`、`ash.json` | 開場人設在 `persona` |
| `prompts/` | 無 `npc-*.md`、無 `gm.md`（僅 contract／default／world-generate／可留 writer） |
| `program/world.test.ts`、`turn.test.ts` | BAN 回歸 |
| `AGENTS.md` | Custom／Default system 句與檔案樹 |

## 行為約束（實作 agent）

- 繁體中文書面語；不 commit 除非使用者要求。
- 勿 `rm` live `kb/runtime`。Fixture 用虛構 harbor。
- 先打穿驗收，勿做 migrate／compact／多存檔。
