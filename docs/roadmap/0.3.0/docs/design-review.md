# Design review — 0.3.0 執行期只寫 kb、NPC 人設在 runtime

- 日期：2026-09-06（Asia/Hong_Kong）
- 輪次：**規劃收斂複核**（第四輪；第三輪獨立核實全文保留。只認檔案；不以本檔當已定案）
- 角色：設計審查（不改 INDEX／HOW／HANDOFF／reasoning／程式）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收；HOW：[`immutable-source.md`](./immutable-source.md)；WHY：[`reasoning.md`](./reasoning.md)；推翻點：[`../../0.2.0/INDEX.md`](../../0.2.0/INDEX.md) 已定案 9
- 現行程式抽樣：本輪只核文件收斂；第三輪已抽樣現碼
- **總評（複核）：無未關閉 HIGH。文件契約通過。M9 關閉。** 未關閉應修 MEDIUM：無。無新 H2／M10。
- **總評（獨立核實，歷史）：無未關閉 HIGH。當時未關閉應修 M9。**
- **總評（複審，歷史）：無未關閉 HIGH。當時碼仍 0.2.0，視為實作範圍。**
- **總評（初審，歷史）：有未關閉 HIGH（H1）。不建議開工。**

---

## Findings

### HIGH

#### H1 — custom 缺 `gm_canon.md` 的 gate 與現行 `syncWorldGate` 會打架；漏改則主路徑不可用

**本輪狀態：關閉**（見下表）。歷史正文保留：

INDEX 已定案 9：有效 `world.source === "custom"` 但缺少可讀的 `gm_canon.md` → **`needs_setup: true`**，與無效／缺 `world.json` **相同門**（不可開打）；禁止 fallback 讀 `runtime/prompts/gm.md`。

初審時 HOW 寫「維持舊 `syncWorldGate` 再額外加 if」、未就緒 custom 可選擇仍帶 `world`。該兩套公式已自 INDEX／HOW 刪除。

---

### MEDIUM

#### M1–M8

**本輪狀態：皆關閉**（見下表）。歷史題旨：M1 擇一 `world` 形狀；M2 生成器 userPrompt／retry；M3 空 persona；M4 指紋偷渡；M5 clear／殘雙檔；M6 BAN 測；M7 MemorySlice／遷欄；M8 產品句只讀寫 kb vs 仍讀 repo GM。

#### M9 — INDEX 錨點與 HANDOFF 仍寫開工前「現行」行為，與狀態 `shipped`、現碼矛盾

**複核狀態：關閉。** 歷史題旨（第三輪未關）：

INDEX 錨點：

> `program/gm-pi.ts` | `buildPlaySystemPrompt` **現行讀 repo npc 檔**

Track C「做」仍寫刪 repo npc。[`HANDOFF.md`](../HANDOFF.md) 仍是 paste-ready **實作** starter（「依 Track A→B→C→D」「先改 loader 再刪 npc」）。

現碼：`buildPlaySystemPrompt` 只讀 `gm-contract.md`／`gm-default.md`／runtime persona／`gm_canon.md`；`prompts/` 僅四檔（無 `npc-*.md`、無 `gm.md`）。`VERSION.md`／changelog／`AGENTS.md` 已是 0.3.0。

風險：新 agent 掃錨點或 HANDOFF 會以為還要實作一輪，或誤判 shipped 是謊報。GUIDELINES 自足：INDEX 狀態欄與錨點「現行」不應互斥。規劃收斂可改錨點為「對局組 prompt 只讀 runtime persona」、HANDOFF 標「本版已 shipped，勿再當開工指令」——**不要把本條當新產品定案寫進 INDEX 已定案表**。

---

### LOW

#### L1 — 多塊 persona 無總長度上限

維持不擋。

#### L2 — `formatNpcPersonas` 只收 `kind === "npc"`

維持不擋。HOW 生成器已註僅 npc 需要時填。

#### L3 — HANDOFF 尚無

**本輪關閉。** [`HANDOFF.md`](../HANDOFF.md) 已存在且含 paste-ready。殘餘開工語氣併入 M9。

#### L4 — `agent-workflow.md` 整包測試未定

**本輪關閉。** 本專案補充已寫 `bun test`。

#### L5 — 0.2.0 INDEX 歷史正文保留 npc 檔句

維持正確（Track D 禁止改寫歷史 INDEX）。推翻點仍在 0.3.0 對照表與已定案 14。

#### L6 — `writer.md` 可留

維持。`prompts/writer.md` 仍在；對局熱路徑不讀。

#### L7 — UI 在 `needs_setup === true` 時不讀 `world.title`

維持不擋。gate 未就緒 `world === null`。

---

## 本輪關閉狀態（初審 H／M，用 INDEX／HOW **現句**再核）

| ID | 狀態 | 證據（現句） |
|----|------|----------------|
| **H1** | **關閉** | INDEX 已定案 9：「`syncWorldGate` 是唯一 ready 真相（優先序寫死，勿拆成「先舊函式再額外」）」；三階同形 `{ needs_setup: true, world: null }`。HOW：「**改寫** `syncWorldGate`，不要「維持舊語意再額外加 if」」；`loadValidWorld`「僅當 gate 為 ready 時回傳該 `world`，否則 `null`」；`loadCustomGmCanon` 缺檔／空 → 409，「禁止未捕捉 `readFile` 變 500」。抽樣碼：`syncWorldGate` 已三路；`loadValidWorld` 回傳 `gate.world`；`loadCustomGmCanon` 包 409；`assertCanSetup` 見 `needs_setup === true`；`buildPlaySystemPrompt` 先 gate。 |
| **M1** | **關閉** | INDEX 已定案 9「與無效 world **同形**」；HOW「未就緒時 `world === null`」；無「實作擇一」。 |
| **M2** | **關閉** | INDEX 已定案 10：三欄＋2000 含 `world-generate.ts` 的 **userPrompt 與 retry**。HOW「必改字串」同。抽樣：`userPrompt`／retry 皆含 persona；`world-generate.md` Hard rules 同。 |
| **M3** | **關閉** | INDEX 已定案 3：trim；空／空白 → `undefined`；非空 1–2000。HOW Entity.persona 同。抽樣：`optionalPersona` preprocess。 |
| **M4** | **關閉** | INDEX 對照表後：「**其餘 0.2.0 契約以 shipped 程式＋本版對照表為準**……**不要**把指紋句實作回來」。已定案 16：「**不要**依 0.2.0 INDEX 的指紋句改 `syncWorldGate`」。 |
| **M5** | **關閉** | INDEX 已定案 8：刪 `gm_canon.md` 且 **仍刪** `runtime/prompts/`。15(e)(f)。HOW `PLAYTHROUGH_FILES` 含 `gm_canon.md`。碼與 `world.test.ts` 對應。 |
| **M6** | **關閉** | INDEX 15(a) persona **獨有句**、npc 檔不存在仍成功；(d) `prompts/` 檔名集合不變。HOW 測試 1、5 必做。`world.test.ts` 有獨有句、`existsSync` false、setup／turn 後檔名集合。 |
| **M7** | **關閉** | INDEX 已定案 3：「**本版禁止改 `MemorySlice` 形狀**」；已定案 4：禁止 md 與 notes 併欄。抽樣：`buildMemorySlice` 仍 `id, name, summary`；seed `persona` 與 `private_notes` 分欄；Writer `ensureEntity` 不帶 persona。 |
| **M8** | **關閉** | INDEX 產品句：「**寫入**只准 `kbRuntimeDir`。……**讀**仍允許 repo 的 GM／生成器檔。……對局人設只讀 **runtime** `entities.json`（不讀 seed、不讀 repo npc 檔）」。已定案 12。HOW 目錄表同。碼：`readFile(prompts/gm-contract.md)` 等；不讀 seed 組 prompt。 |
| **M9** | **關閉**（複核） | 見文末「規劃收斂＋複核」。 |
| **L3** | **關閉** | `HANDOFF.md` 已寫。 |
| **L4** | **關閉** | `agent-workflow.md` 補充：`bun test`。 |

---

## 驗收對照（設計層；本輪並核現碼是否讓 `shipped` 成立）

| 驗收句 | 文件是否夠客觀 | 本輪 |
|--------|----------------|------|
| repo 無 `npc-*.md`／無 `prompts/gm.md`；不讀這類路徑 | 是 | `prompts/` 僅 contract／default／world-generate／writer；`gm-pi`／`kb` 無 npc 路徑 |
| seed bartender／ash 有 persona，語意≈刪前角色表 | 是 | JSON 有獨立 `persona`；notes 未併入 |
| Default system＝contract + gm-default + runtime persona；改 runtime 會變；不讀 seed | 是 | 測覆蓋句；組 prompt 只 `loadEntities` |
| Custom 寫 `gm_canon.md`；無 runtime `prompts/` 新檔 | 是 | commit key `gm_canon.md` |
| Custom 有效 world 無 canon → needs_setup 且 `world === null`；不讀舊檔 | 是（H1 已關） | gate＋測殘 `prompts/gm.md` 仍 409 |
| 洩漏含 persona；>2000 失敗 | 是 | schema＋測 |
| `bun test`、隔離 runtime | 是 | 測試慣例仍隔離；本輪未重跑整包（設計審查不改碼） |
| `AGENTS.md`／`VERSION.md`＝0.3.0 | 是 | 兩者皆 0.3.0 |

**規劃文件狀態：** `shipped` 與現碼一致。不是 HIGH「虛報 shipped」。

---

## 文件自足（GUIDELINES）

優點：INDEX／HOW 同一套 needs_setup 優先序；產品句已分寫／讀；待拍板空；推翻 0.2.0 已定案 9 有對照表；BAN 測試句可客觀判斷；reasoning 否決 migrate／指紋／改 MemorySlice。新實作 agent **只讀已定案＋HOW 公式**幾乎不會猜錯 gate／persona／canon 檔名。

缺口（獨立核實時）：錨點「現行讀 npc」與 HANDOFF 開工口吻（**M9**）。複核後該缺口已關，見文末。

待拍板：INDEX「開工前仍須拍板：無」為真；無另藏擇一。

---

## 現行程式接點（本輪抽樣＝已落地，非「仍是舊行為當設計洞」）

- `syncWorldGate`：無效 world → setup＋`world: null`；custom 缺／空 `gm_canon.md` 同形；default 忽略 canon。
- `loadValidWorld`／`getNeedsSetup`／`GET /api/state`／`assertCanSetup`／`getSession`／`buildPlaySystemPrompt` 跟 gate。
- `loadCustomGmCanon`：只讀 `gm_canon.md`；缺／空 → 409。
- `Entity.persona` preprocess；`entityLeaksPrimer` 三欄；生成器 md／user／retry 同套。
- `formatNpcPersonas`：runtime npc、id 升序、區塊格式與 HOW 一致；零塊無空白標題。
- Writer 只寫 runtime JSON；新建 NPC 可不帶 persona。
- `MemorySlice` 未加 persona／notes。
- 不做舊 `runtime/prompts/gm.md` 讀取或 boot migrate。

---

## 建議規劃收斂（本審查不改 INDEX）

1. 維持 H1／M1–M8 關閉；**不要**把已關 ID 當新洞重開。
2. 修 **M9**：錨點改為描述 shipped 行為；HANDOFF 標已出貨或改為「勿再開實作 session」。
3. 勿把本檔提議寫進已定案。勿恢復指紋／migrate／讀舊 `prompts/gm.md`／改 MemorySlice。

**審查閘門（獨立核實）：PASS。** 當時未關閉應修 MEDIUM：M9（複核已關）。

---

## 複審（2026-09-06，歷史）

對照：更新後的 INDEX／HOW。當時規劃宣稱已收斂；碼仍 0.2.0 行為，複審視為實作範圍、非未關設計洞。新 HIGH／MEDIUM：無。L3：當時尚無 HANDOFF。結論：**可以開工**。

---

## 初審（歷史全文摘要）

有未關閉 H1（INDEX 與 HOW 兩套 needs_setup）。M1–M8 見上表題旨。當時不同意開工。

---

## 規劃收斂＋複核（2026-09-06）

對照更新後的 [`../INDEX.md`](../INDEX.md)、[`immutable-source.md`](./immutable-source.md)、[`../HANDOFF.md`](../HANDOFF.md)。未改程式。未重編號。

### M9

**關閉。** 第三輪缺口是導航句（錨點「現行讀 npc」、HANDOFF 當開工、HOW 祈使「改寫 gate」），不是已定案公式。現句：

- INDEX 文件地圖 5：`HANDOFF.md`「本版已 shipped；歷史實作交接，勿再當開工指令」。
- INDEX 錨點 `gm-pi.ts`：「repo 契約／`gm-default.md` + runtime NPC `persona`（不讀 seed、不讀 `npc-*.md`）」；`prompts/`「無 `npc-*.md`、無 `gm.md`」。
- HANDOFF 開篇「不要再開實作 session 重做 Track A–D」；paste-ready：「本版 0.3.0 已 shipped。不要依本 prompt 重做 Track。」
- HOW needs_setup：`syncWorldGate`「**已是**下列唯一公式」；`loadValidWorld` 為描述句；刪檔順序標「（歷史）」且「出貨後該等檔不得再出現」。

Track A–D 區塊仍是歷史「做／不做」清單，與 shipped 並讀時可當已完成軌道；HANDOFF 已禁止當新開工。不另開 MEDIUM。

### 新洞

無 H2、無 M10。L1／L2／L5／L6／L7 維持不擋。

### 閘門

**PASS。** 無未關閉 HIGH。無未關閉應修 MEDIUM。
