# Design review — 0.2.0 世界起始劇本

- 日期：2026-09-06（初審／複審／三審）
- 角色：設計審查（只讀檔案；**不把本檔當已定案**）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收；HOW：[`world-bootstrap.md`](./world-bootstrap.md)；WHY：[`reasoning.md`](./reasoning.md)
- 現行程式抽樣：`program/kb.ts`、`gm-pi.ts`、`schema.ts`、`server.ts`、`public/app.js`、`prompts/gm.md`、`gm-mock.ts`
- 總評（初審）：未關閉 H1–H4 不建議開工。
- 總評（複審）：H5／H6／M10 未關，不建議開工。
- **總評（三審）：H5／H6／M10–M14 已併入 INDEX 22–26 與 HOW。無未關 HIGH。可以開實作 agent。** 僅餘非阻擋 MEDIUM（已定案 7 的「不得留檔」勿在 boot 刪舊酒館庫）。

---

## Findings

### HIGH

#### H1 — 舊局相容會把「半套 custom」當可玩 default

INDEX／reasoning **已預見**反例（entities 已寫、尚無 `world.json`），但 HOW 的判定仍是：

> `needs_setup === true` 當且僅當：沒有有效 `world.json`，**且**沒有「舊局相容」的非空 `entities.json`。

舊局規則：非空 entities + 無 world.json → **寫入 `source: default` 並當 ready**。

這與「生成失敗不落盤／原子寫入」綁在一起才安全。實作若依序寫檔或 crash，半套 custom 會被標成鏽燈酒館、跳過 setup，違反已定案 7 與驗收「壞 JSON 無新 world、仍 needs_setup」。

**建議寫進已定案（擇一或併用，須寫死）：**

1. Custom／default 落盤用暫存目錄 + `rename` 成最終 runtime；`world.json` 為 commit 標記。
2. **無 `world.json` 時不要無條件當 default。** 僅當 entities 的 id 集合與 repo `kb/seed/` 一致（或等價指紋）才補 default `world.json`；其餘視為損壞／未完成 setup（可刪半套或隔離），`needs_setup: true`。
3. 無效／缺欄的 `world.json` 不得走「當 default 覆蓋」；應 needs_setup 或明確錯誤，勿悄悄改 `source`。

#### H2 — `resetPiGm`／new-game 與「先不要對局 session」衝突

現行 `resetPiGm()`（`program/gm-pi.ts`）是 dispose 後 **立刻** `createSession(true)`，且 system 固定讀 repo `prompts/gm.md` + 瑪拉／灰。

HOW 要求：`POST /api/new-game` 清空後 **不要立刻 `createSession`**；custom 成功後才用 **runtime canon** 開對局。

若實作只「在 server 多呼叫一次現有 `resetPiGm`」：

- 新遊戲當下就開酒館對局 session（甚至寫 `pi-sessions/`）；
- Track B 成功後若再 `resetPiGm()`，在 Track C 改載入路徑之前仍是酒館人設。

**須在 HOW／錨點寫明：** `resetPiGm` 拆成「只釋放、不建立」與「依 `world.source` 建立」；`getSession()` 在 `needs_setup` 時不得 lazy 開酒館局。`GM_MODE=mock` 同樣不可在 setup 前假裝已 ready。

#### H3 — 「契約前綴」範圍未寫死，custom 極易混入酒館 canon

現行 `prompts/gm.md` 同時含：JSON 契約、**「tavern POC」**、開場卡司瑪拉／灰、蠟封紙條 canon、NSFW。

INDEX 允許「為抽出契約而拆檔，default 語意等價」。HOW 只說前綴＝「JSON 規則…新角色不要重用開場 id」。實作 agent 很可能整份 `gm.md` 當前綴再加 `gm_canon` → 與 custom 世界觀打架（reasoning 反例第一條）。

**須列出拆檔後兩份內容邊界（建議檔名可改，職責不可含糊）：**

| 檔（建議） | 誰用 | 可含 | 不可含 |
|------------|------|------|--------|
| 契約前綴 | default 與 custom | keys、narration vs `npc_lines`、events、gm_note 上限、NSFW／未成年人、新開口角色新 id | 鏽燈、瑪拉、灰、紙條、燈手、「你是酒館 POC」 |
| default 專用 | 僅 default | 卡司、酒館 canon、今日 `npc-*.md` | — |
| runtime `prompts/gm.md` | 僅 custom | 生成器 `gm_canon` | 契約 JSON 規則可重複或只放前綴；不要再塞酒館 |

Default 對局＝前綴＋酒館專用＋兩份 npc 檔（或等價合併，但語意須與今日一致）。

#### H4 — 回合 coerce 仍把缺省世界當成酒館

`parseGmOutput`／`normalizeGmPayload` 現況：

- 缺 `npc_id` → `"bartender"`
- 缺 `gm_note` → `"本場：酒館。"`
- `KNOWN_NPC_NAMES` 只認得瑪拉／灰
- `PlayerInputSchema.scene_id` 與 `loadScene()` 後備皆 `"tavern"`
- UI `app.js` 寫死 `scene_id: "tavern"`、進頁氣泡「你站在鏽燈酒館門口」

INDEX Track C 驗收：custom 不得把酒館硬編碼當唯一人設。若只改 prompt 載入、不改 coerce／後備 scene，Flash 漏欄時 custom 局會冒出瑪拉／酒館 note，且 setup 前 `GET /api/state` 若仍走 `loadScene` 後備，UI 會以為已在酒館。

**須定案：** setup 前 `scene === null`、禁止 tavern 後備；coerce 的缺省 `npc_id`／gm_note 不得用酒館專有名詞（可用 `unknown_npc`／通用 note，或拒絕該回合）；display name 用 GM 給的 `name` 或 entity 表，而非寫死兩人。`KNOWN_NPC_NAMES` 可留作 default 補名，但 custom 不可因此把陌生 id 顯示成瑪拉。

---

### MEDIUM

#### M1 — `POST /api/setup/custom` 在已 ready、並發、generating 未定

Default 已 ready → 409。Custom 未寫。並發兩次 custom 會兩次 pi + 互踩檔。狀態機有 `generating`，HTTP／`GET /api/state` 沒有此旗標。

建議：ready 時 custom 亦 409（先新遊戲）；process 內 single-flight（第二請求 409 `generating: true`）；可選在 state 暴露 `setup_status: "idle" | "generating"` 供 UI，不必持久化。

#### M2 — 生成一次 shot、壞 JSON 無重試

驗收要求壞 JSON 不落盤（正確），但 Flash 常包 markdown／缺欄。無「同 job 再要一次 JSON」時，手驗 custom（真模型）會很脆。

建議拍板：parse 失敗可 **同一生成 session** 再要 1–2 次（仍不寫 runtime、不建對局 session）；仍失敗才 4xx。Mock 路徑不走重試。

#### M3 — 「引子不當 seed」校驗過窄

已定案禁止 primer 原文進 `summary`／`private_notes`。HOW 只禁止 **summary 與某一欄 trim 後全等**。實作可把整段 worldview 放進 `private_notes` 或當 summary 的真子集／前後空白以外的拷貝。

建議：任一欄 trim 後長度 ≥ 8 者，不得作為任一 entity 的 `summary` 或 `private_notes` 的全等或「僅前後綴包裝」（至少全等＋包含整欄）。不必上 NLP。

#### M4 — `gm_canon` 無上限

對局 system＝前綴＋canon。無上限時一次生成可塞爆 context，之後每回合都付代價。建議 `gm_canon` 上限（例如 8k–12k 字元），超限視為生成失敗。

#### M5 — Track B 驗收「進入回合」早於 Track C

B 驗收 `needs_setup: false` 後若立刻手玩，在 C 完成前對局仍是酒館 prompt（疊 H2／H3）。建議 B 的客觀驗收停在「檔案＋mock、不要求正確 GM 人設」；「可送一回合且 parseGmOutput」放到 C 或 B+C 合併門檻。HANDOFF 寫「B 完即可玩 custom」會誤導。

#### M6 — 字數用詞：「8 字」vs「4000 字元」

已定案 4：去空白後至少 **8 字**；5：最多 **4000 字元**。實作會混用 code unit／字素。寫死：一律 JS `trim().length`（UTF-16 code units），最短 8、最長 4000。

#### M7 — 現行測試假設「空庫即酒館」

`ensureRuntime`／`resetPlaythrough` 現在空庫即灌 seed；`turn.test.ts` 等直接 `resetPlaythrough`。Track A 必須改這些語意，否則 `bun test` 與「空庫 needs_setup」對打。HANDOFF 應點名：測試改用 `setupDefaultForTest()`，禁止依賴 boot 偷灌。

#### M8 — 生成器 user prompt 過薄

只寫「四欄＋輸出 JSON、具體化、不要引子當 summary」。未要求：`kind` 枚舉、player id 必須 `player`、`scene_id`＝某 place id、`present` 含 player 與 npc。模型易出 `id: "hero"` 的 player。這些已在 zod 加碼，失敗即整次失敗——與 M2 疊加。生成器 system 應把 **同一份校驗規則**寫進 prompt（可從 schema 生成說明），不要只靠 zod 事後打槍。

#### M9 — 流程：HANDOFF 已寫、design-review 尚未併入

`agent-workflow.md`：待拍板空 → 寫 HANDOFF → 實作。INDEX 寫「開工前仍須拍板：無」，但 H1–H4 顯示契約仍有洞。規劃收斂應先改 INDEX／HOW，再讓實作認 HANDOFF。本檔同意項未併入前，不建議開實作 session。

---

### LOW

#### L1 — `agent-workflow.md` 本專案補充過期

寫「AGENTS.md 待建」「整包測試尚未定」。根目錄已有 `AGENTS.md`，測試指令已是 `bun test`。與 0.2.0 產品無關，之後改 overlay 即可。

#### L2 — 版本號 0.0.0 → 0.2.0

INDEX 已說明。不擋。若有人找 0.1.0，可在 INDEX 加一句「無 0.1.0 出貨」。

#### L3 — header／`<title>`／placeholder

HOW 要求 header 用 `title`。`index.html` 現為鏽燈。Track D 已覆蓋；可補：`<title>` 與 placeholder 亦隨 world 改，setup 畫面用中性標題。

#### L4 — relations 開場可空

合理。生成器若自願給 relations，HOW 說可不填——應加一句：有給則須過 `RelationSchema`，id 皆須存在，否則整次失敗；沒給則 `[]`。

#### L5 — default 的 `created_at`

ISO 字串即可；時區用 UTC。不必拍板。

---

## 驗收對照（設計層，非實作勾選）

| 驗收句 | 文件是否夠客觀 | 風險 |
|--------|----------------|------|
| 空庫先選單、`needs_setup` | 是 | H1／H4 後備 scene 會讓 UI 以為已開打 |
| default 實體集合＝seed | 是 | 測試須改 reset 語意（M7） |
| custom 非 primer 原文、至少 place/player/npc | 是 | M3 可繞過 private_notes |
| mock 不打外網 | 是 | — |
| 壞 JSON 不落盤 | 是 | 與 H1 衝突除非原子＋收緊舊局 |
| 新遊戲回選擇、清 pi-sessions | 是 | H2 可能立刻再建 session 檔 |
| 舊局無 world.json 可玩 | 是 | **過寬** → H1 |
| bun test、隔離 runtime | 是 | M7 |
| 瀏覽器 default＋custom＋重開畫面 | 是 | 真模型 custom 無重試則手驗不穩（M2） |

---

## 文件自足（GUIDELINES）

優點：產品句、與上版對照、已定案、非目標、Track、reasoning 否決表、反例都有；primer≠seed 的 WHY 清楚。

缺口：H2／H3／H4 對現行程式的**具體函式行為**寫不足；實作 agent 只讀 roadmap 仍會「呼叫現有 `resetPiGm`＋整份 gm.md」。GUIDELINES 的自檢（不讀 chat 會不會猜錯）在這三點 **會猜錯**。

---

## 建議規劃收斂（本審查不改 INDEX）

1. 把 H1–H4 寫進 INDEX 已定案或 HOW 對應節（含舊局指紋、`resetPiGm` 語意、拆 prompt 表、coerce／scene 後備）。
2. M1／M2／M3／M4／M6 擇要寫死，避免實作自創。
3. 調整 Track B／C 驗收邊界（M5）；HANDOFF 錨點加上 `normalizeGmPayload`、`resetPiGm`、`ensureRuntime`。
4. 再維持「待拍板：無」之後才開實作 agent。

審查者 **不同意** 在現稿上直接開工。

---

## 規劃收斂（2026-09-06）

規劃 agent 已同意並寫入 INDEX／HOW／HANDOFF／reasoning：

| ID | 處置 |
|----|------|
| H1 | 舊局僅當 entities id 集合＝`kb/seed` 才補 default `world.json`；落盤原子＋`world.json` 為 commit；無效 world.json 不改寫成 default |
| H2 | `disposePlaySession` vs `createPlaySession`；setup 前禁止 lazy 開對局 |
| H3 | 拆 `prompts/gm-contract.md` vs default canon；custom 不得帶酒館 |
| H4 | setup 前 scene null；coerce 禁用酒館缺省 |
| M1–M4、M6 | 已定案（409／single-flight／生成重試 1–2／primer 包含檢查／gm_canon 8000／UTF-16 length） |
| M5、M7、M8 | Track 驗收與測試／生成器 prompt 已改 |
| L2、L4 | 寫入 INDEX／HOW |
| L1、L3、L5 | L1 非本版；L3 Track D；L5 UTC 即可 |

待拍板已空。實作請認更新後的 HANDOFF。

---

## 複審（2026-09-06，規劃收斂後）

對照更新後 INDEX（已定案 15–21）＋ HOW。初審 H1–H4、M1–M8：**關閉**（已成契約，實作審查再對 diff 核）。

### 複審 HIGH（未關）

#### H5 — 舊局指紋「id 集合全等 seed」幾乎救不了真的舊局

已定案用 **id 集合 === `kb/seed` 的 id** 才補 default `world.json`。

POC 玩過一回合後 Writer 常會 upsert 新 npc／item，id 集合變成 seed 的**超集**。依現稿：無 `world.json` 的**已開打酒館存檔**會被當成半套 → `needs_setup`，與「0.2.0 之前還開著的局不要踢進 setup」的 WHY 不符。驗收句只寫「id＝seed 可玩」，等於只保「灌了 seed、還沒長出新 entity」的庫。

**建議（擇一寫死）：** 無有效 world 時，若 entity id 集合 **⊇ seed ids**（含齊 `player`／`bartender`／`ash`／`tavern`／`sealed_note`）→ 視為舊酒館局，補 `source: default`，**保留**多出來的 id。僅當缺任一 seed id（或不交）才當半套／needs_setup。不要用「有非空 entities 就 default」（那是已否決的 H1）。

#### H6 — HOW 的 `needs_setup` 公式與 INDEX「無效 world.json」矛盾

INDEX：無效／非法 `source` 的 `world.json` → needs_setup，禁止改寫成 default。

HOW：

> `needs_setup === true` 當：沒有有效 `world.json` **並且** 不是舊酒館指紋。否則 ready。

若檔案是 **壞的／非法 source 的 world.json** 且 entities 仍是 seed 指紋：HOW 會判 **ready**（第二條件失敗），INDEX 要 **needs_setup**。實作會二選一猜。

**建議寫死優先序：** (1) 有效 `world.json` → ready（以 world 為準，不要再套指紋）；(2) 有 `world.json` 但無效 → needs_setup，**不要**用指紋救成 default、不要改寫該檔；(3) 無 world.json → 才用 H5 指紋決定補 default 或 setup。

### 複審 MEDIUM

#### M10 — `GM_MODE=mock` 的回合仍是鏽燈劇情

HANDOFF／驗收允許「瀏覽器 custom（mock 可）」且 Track C 要求 custom 人設非酒館硬編碼。現行 `program/gm-mock.ts` 只產出瑪拉／灰／紙條。setup 的 harbor fixture 與 **對局 mock** 不是同一層。

若不改：mock custom 一回合必冒酒館卡司，C／瀏覽器驗收對打。

**建議拍板：** custom + mock 的 `runTurn` 走第二套 fixture（讀 `scene`／entities，例如 `keeper`／`harbor_inn`）；或明確「瀏覽器 custom 必須 `GM_MODE=pi`；mock 只驗 setup commit＋coerce 單測」。預設建議前者，否則 mock 手驗 crocked。

#### M11 — 已 ready 時重啟 process 的對局 session

現行 `getSession`＝`continueRecent`。0.2.0 只寫 setup 成功才 `createPlaySession`、needs_setup 禁止 lazy。沉默：已 ready 重開 `bun start` 是否仍接 `pi-sessions/`、system 是否依 **當前** `world.source` 重組（continueRecent 會否沿用舊 system 字串）。

**建議：** ready 且存在 jsonl → `continueRecent`，但 `systemPromptOverride` 仍依現在的 contract＋canon（與今日「重載 server 接最近一局」等價）；needs_setup 則不得 continue。寫進 HOW 一節即可。

#### M12 — 半套殘檔 + 下一次 setup 的取代語意

HOW 允許「留著半套但不得開打」，原子 commmit 又是暫存目錄 `rename`。Linux 上 rename 到**已存在且非空**的 `kb/runtime` 會失敗。須寫：commit 前清掉 runtime 內 playthrough 檔（或先搬走再 rename），**與半套 merge 禁止**（否則 custom 殘 entity 混進 default seed）。

#### M13 — generating 的 `finally` 與 new-game

`setup_status` 是記憶體。請求崩潰若沒 `finally → idle`，會永遠 409 `generating`。進行中是否允許 `POST /api/new-game` 取消 job：未寫。建議：任何結束路徑都回到 idle；new-game 可中止並清空（若做不到至少 409 等到結束）。

#### M14 — 三次生成 vs `idleTimeout: 120`

三次模型往返可能超過 120s，HTTP 斷、記憶體仍 generating（疊 M13）。建議 HOW 寫 idleTimeout **≥ 180** 或「生成中以 job 為準、斷線後 finally 清旗標、不落盤」。

### 複審 LOW

#### L6 — `unknown_npc` 可能被 Writer upsert

缺 id 的 line 變成 `unknown_npc` 後若進 events，KB 會長出怪 id。可接受；實作審查盯即可。

#### L7 — INDEX 狀態寫「設計審查已收斂」

複審仍有 H5／H6。收斂後再改這句，避免實作 agent 以為本檔已過時。

#### L8 — primer「整段包含」假陽性

極短且普通的 8 字 worldview 可能被正常 summary 包含。POC 可接受；測試 primer 用足夠長的虛構句（harbor 已朝這走）。

### 複審驗收對照

| 項 | 複審 |
|----|------|
| 初審 H1–H4 | 已進契約 |
| 舊局可玩 | **H5**：玩過、id 變超集則不可玩 |
| 無效 world.json | **H6**：HOW 公式錯 |
| mock custom 一回合 | **M10**：mockGm 未納入契約 |
| 空庫選單、原子、拆 session、coerce | 夠客觀 |

### 建議再收斂（仍不直接改 INDEX）

1. 指紋改 **⊇ seed ids**（H5）。
2. needs_setup 改三路優先序（H6）。
3. mock 對局依 `world.source`／scene 分支，或從 mock 瀏覽器驗收拿掉 custom 對局（M10）。
4. HOW 補：ready 重啟 continueRecent＋現行 prompt；commit 取代不 merge；generating finally（M11–M14）。

**複審結論：** 比初審可開工得多，但 **H5／H6 仍應先改文件**。M10 若不補，Track C 用 mock 手驗會失敗。其餘 MEDIUM 可進 HOW 一句、實作自決細節。

---

## 複審收斂（2026-09-06）

規劃 agent 已併入 INDEX 22–26 與 HOW：

| ID | 處置 |
|----|------|
| H5 | 指紋改 **⊇ seed ids**，保留多餘 entity |
| H6 | needs_setup 三路優先序：有效 world → 無效 world → 無 world 才指紋 |
| M10 | mock 對局依 `world.source` 分支（custom＝harbor NPC，不是瑪拉） |
| M11 | ready 重啟 `continueRecent` + 當前 systemPromptOverride |
| M12 | commit 前清 runtime，禁止與半套 merge |
| M13 | generating `finally` → idle；new-game abort 或 409 |
| M14 | `idleTimeout` ≥ 180 |
| L6–L8 | 不擋；測試 primer 用夠長虛構句 |

待拍板已空。

---

## 三審（2026-09-06，H5／H6 收斂後）

對照 INDEX 優先序 1–3、已定案 22–26、HOW 狀態表與 mock／重啟節。複審 H5、H6、M10–M14：**關閉**。

### HIGH

無。

### MEDIUM（非阻擋；實作時認 INDEX 優先序即可）

#### M15 — 已定案 7 的「無 world 不得留 entities」不要在 boot 執行

第 7 條寫失敗刪暫存，並說「無 world 的 entities／prompts 不得留在 runtime」。若 boot 先依此 **刪掉** 無 `world.json` 的 entities，指紋 ⊇ seed（H5）永遠走不到，舊酒館局被清光。

第 7 條只約束 **setup／生成 commit 失敗**（暫存刪掉、不得把半套 rename 進 runtime）。Boot：**先跑優先序 1→2→3**；合法舊局只補 `world.json`，禁止當垃圾刪。半套（缺 seed id）仍不得 ready；可留到下次 setup 取代（第 22 條）。

HANDOFF 已強調三路優先序；實作審查盯 `ensureRuntime` 不要 `rm` 無 world 的 live entities。

#### M16 — 指紋 ready 但缺 `scene.json`

舊 POC 幾乎一定有 scene。若只補 world、scene 檔遺失，HOW 要求 state 的 scene 為 null → 對局 409，使用者卡在「已 ready 卻不能說話」。可接受：缺 scene 則視為未就緒／needs_setup，或補 `INITIAL_SCENE` 且僅當指紋成立。實作自決其一並測一筆即可。

### LOW

#### L9 — ready 開頁系統氣泡

Track D：ready 用「世界：{title}」。舊局續玩不要再寫「你站在鏽燈酒館門口」裝成新進門。

#### L10 — seed 指紋讀 `.id` 不是檔名

測試應 parse `EntitySchema.id`。

#### L11 — reasoning 反例仍偏初審

可補「無效 world + ⊇ seed 仍 setup」「mock custom 仍出瑪拉」。不擋開工。

### 三審驗收對照

空庫選單、default＝seed、custom 非 primer、壞 JSON 不落盤、新遊戲、舊局 ⊇ seed、無效 world 不救、mock custom 非酒館：文件已夠客觀。

GUIDELINES 自檢：H5／H6 不再兩套公式。M15 是唯一還能誤讀的句子，優先序表已夠壓過。

**三審結論：同意開工。** 用 HANDOFF paste-ready prompt 開**新**實作 session。本審查不改程式。
