# 0.3.0 HOW — 執行期只寫 kb、NPC 人設在 runtime

對照基準：[`../INDEX.md`](../INDEX.md)。

## 目錄職責

| 路徑 | 誰寫 | 對局 GM 讀？ |
|------|------|----------------|
| repo `prompts/gm-contract.md` | 開發者（git） | 是（固定契約） |
| repo `prompts/gm-default.md` | 開發者（git） | 僅 `world.source === "default"` |
| repo `prompts/world-generate.md` | 開發者（git） | 否（只給生成 job） |
| repo `prompts/npc-*.md` | **不得存在** | — |
| `kb/seed/*.json` | 開發者（git 模板） | **否**（只在 default setup copy） |
| `kb/runtime/entities.json` | setup copy 或生成器；之後 Writer | 是（組 persona 區塊） |
| `kb/runtime/gm_canon.md` | 僅 custom setup | 僅 custom |
| `kb/runtime/prompts/` | **不得新寫**；清理時刪殘 | **禁止讀** |

執行期寫入範圍：僅 `kbRuntimeDir`（預設 `kb/runtime`，測試覆寫 env）。**不要**寫 repo `prompts/`、`kb/seed/`、`program/`。

## Entity.persona

```text
persona?: string
// preprocess：trim；""／僅空白 → undefined（缺欄）
// 非空：length 1–2000（JS UTF-16），否則 parse／生成失敗
```

組 system 時的區塊格式（每個合格 NPC 一塊，id 升序）：

```text
## NPC <id> (<name>)
<persona 正文>
```

多塊之間空一行。零塊時不要附加空白標題。

**不要**把 `private_notes` 另拼進 system（0.2.0 也沒有把 notes 放進 `memory_slice`；本版不順便改記憶切片契約）。GM 若需秘密，應寫在 `persona` 或 `gm_canon`／`gm-default`／`gm_note`。

## `buildPlaySystemPrompt`

前置：**`syncWorldGate().needs_setup === false`**；否則 409 `needs_setup`。不要在 gate 未就緒時靠 `loadValidWorld` 只看 `world.json` 就組 prompt。

```text
parts = [ gm-contract.md ]

if source === "custom":
  // gate 已保證 gm_canon.md 非空；此處讀失敗仍須 409，禁止 500
  parts += gm_canon.md 正文
else:
  parts += gm-default.md

parts += formatNpcPersonas(runtime entities)
return parts.join("\n\n")
```

`createPlaySession`／ready 後 `continueRecent` 的 `systemPromptOverride` **仍每次依當前檔重組**（與 0.2.0 已定案 24 等價，只是組成來源改為上式）。

## needs_setup（唯一公式＝INDEX 已定案 9）

`syncWorldGate` **已是**下列唯一公式（不要退回「只看 world.json 再額外加 if」）。

| 優先 | 條件 | 回傳 |
|------|------|------|
| 1 | 無／無效 `world.json` | `{ needs_setup: true, world: null }`（不改寫檔） |
| 2 | 有效 `source === "custom"` 且 `gm_canon.md` 缺檔或 trim 空 | `{ needs_setup: true, world: null }`；**不讀** `runtime/prompts/gm.md` |
| 3 | 其餘有效 world（default **忽略** canon 檔） | `{ needs_setup: false, world }` |

`loadValidWorld`：僅當 gate 為 ready 時回傳該 `world`，否則 `null`。

`GET /api/state`：`needs_setup` 與 `world` 皆來自 gate。未就緒時 `world === null`（與無效 world 同形），setup 畫面中性標題；**`assertCanSetup` 見 `needs_setup === true` 才允許 default／custom**，缺 canon 的 custom 不得 409 already ready。

`getSession`／`createPlaySession`：`needs_setup` 則禁止 lazy／continue。

`loadCustomGmCanon`：只讀 `gm_canon.md`。缺檔／空：呼叫方應已在 gate 擋下；若仍被呼叫 → `HttpError 409 { needs_setup: true }`，禁止未捕捉 `readFile` 變 500。

Default **不要**因缺 `persona` 打回 setup（欄位 optional；seed 有欄靠測試斷言）。缺 persona 只讓區塊變短。

Boot **禁止** migrate 舊 `prompts/gm.md`、禁止為缺 canon 而刪 `world.json`。

## 原子 commit／new-game 清單

`PLAYTHROUGH_FILES`（或等價）須含 **`gm_canon.md`**。`clearPlaythrough` 至少刪：

- 既有 playthrough 檔（0.2.0 的 json／txt）
- `gm_canon.md`
- 目錄 `prompts/`（recursive，相容舊殘檔）
- `pi-sessions/`（new-game／取代 commit 時，與 0.2.0 相同）

`commitCustomWorld` 的 map key 為 `gm_canon.md`，**不是** `prompts/gm.md`。

`commitDefaultWorld` **不要**寫 `gm_canon.md`。

## 生成器

- JSON 欄 `gm_canon` 字串上限仍 8000（0.2.0）。
- entities[] 可含 `persona`（僅 `kind === "npc"` 需要時填；player／place 上的 persona 進 schema 與洩漏檢查，但不進 system）。Harbor mock **可省略**。
- 校驗順序：schema（含空 persona→undefined、非空 1–2000）→ `entityLeaksPrimer`（summary／private_notes／**persona**）→ 其餘 0.2.0 規則。
- **必改字串：** `prompts/world-generate.md` 的 entity 欄說明與 Hard rules；`world-generate.ts` 的 **userPrompt 與 retry**，與 zod 同一套（三欄＋2000）。勿只改 schema。

## 測試要點（對應 INDEX 已定案 15；皆必做）

1. 隔離 runtime；`setupDefaultForTest`；prompt 含 **persona 獨有句**（例如現行 npc md 裡、且 **不在** `gm-default.md` 的句子）；`existsSync(repo/prompts/npc-bartender.md) === false`。
2. 改 runtime `bartender.persona` 存回，重組 prompt 含新字、不含舊 persona 獨有句；過程不讀 `kb/seed`。
3. mock custom commit：`join(kbRuntimeDir, "gm_canon.md")` 存在；`join(kbRuntimeDir, "prompts", "gm.md")` 不存在。`atomicCommitPlaythrough` 的 map key 是相對 runtime 的 `gm_canon.md`。
4. 有效 custom `world.json`、無 `gm_canon.md` → `getNeedsSetup() === true`，`syncWorldGate().world === null`。再放一個殘留 `runtime/prompts/gm.md`：仍 needs_setup，且 `buildPlaySystemPrompt` 不讀該檔（應 409）。
5. setup／turn 測完後 repo `prompts/` 檔名集合與測前相同、無新 `npc-*.md`。
6. `resetPlaythrough`／`clearPlaythrough` 後無 `gm_canon.md`、無 `prompts/` 目錄。

刪檔順序（歷史）：先改 loader 與測試，再刪 repo `npc-*.md` 與 `prompts/gm.md`。出貨後該等檔不得再出現。

## 文件同步（Track D）

`AGENTS.md` 須改的句子（大意，實作時寫準）：

- Default 對局 system＝`gm-contract.md` + `gm-default.md` + **runtime NPC persona**
- Custom 對局 system＝契約前綴 + **`kb/runtime/gm_canon.md`** + runtime NPC persona
- 檔案樹：`prompts/` 無 npc 檔；runtime 無 `prompts/` 子目錄

**不要**把 0.2.0 `INDEX.md` 改成假裝當日已無 npc 檔；對照表已說明推翻點。
