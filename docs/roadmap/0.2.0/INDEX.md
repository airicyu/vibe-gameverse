# 0.2.0 世界起始劇本（default / custom primer）

- 上游：[0.1.0 鏽燈酒館 POC](../0.1.0/INDEX.md)（`shipped`；當時根目錄版本字串曾為 `0.0.0`，語意即 0.1.0）。
- Changelog：本目錄即本版契約真相；出貨摘要見根目錄 [`changelog.md`](../../../changelog.md)；同步 `VERSION.md` 與 `AGENTS.md`
- 狀態：`shipped`（初審 H1–H4 已收斂；複審 H5／H6／M10–M14 已併入本檔，見 `docs/design-review.md`）
- 日期：2026-09-06（Asia/Hong_Kong）

## 產品句

玩家進遊戲時先選 **預設世界起始劇本**（現行鏽燈酒館 `kb/seed/`）或 **自訂引子**（世界觀／主角／補充 NPC／起始點）；自訂路徑由 **pi-agent 生成** 可玩的 KB seed 與 GM canon，**使用者原文不是 seed**。選完後才進入現有回合迴圈。

## 文件地圖

閱讀順序：

1. 本檔（WHAT）
2. [`docs/world-bootstrap.md`](./docs/world-bootstrap.md)（HOW）
3. [`docs/reasoning.md`](./docs/reasoning.md)（WHY）
4. [`docs/design-review.md`](./docs/design-review.md)（已收斂；契約以本檔＋HOW 為準）
5. [`HANDOFF.md`](./HANDOFF.md)

規格對照（勿當本版契約；僅背景）：`docs/handover.md`、`docs/brainstorm.md`、根目錄 `AGENTS.md`。

## 與上一版對照

| 行為 | [0.1.0](../0.1.0/INDEX.md) | 0.2.0 |
|------|------------------|--------|
| 開服 | `ensureRuntime()` 若 `entities` 空則 **立刻複製** `kb/seed/` | 依 needs_setup 三路：有效 world 繼續；無效 world 進選單；無 world 且 ids ⊇ seed 則補 default 標記 |
| 開畫面 | 直接聊天氣泡「你站在鏽燈酒館門口」 | 先 **起始劇本選擇**；完成 setup 才顯示回合 UI |
| 新遊戲 | 立刻再灌 `kb/seed/` 並立刻 `createSession` | **清空 runtime**（含 `pi-sessions`）→ 只 dispose 對局 session → 回到起始選擇 |
| GM system | 永遠整份 `prompts/gm.md` + 瑪拉／灰 | default：契約前綴 + 酒館 canon + npc 檔。custom：契約前綴 + runtime `gm_canon` |
| 使用者四段文字 | 無 | 只當 **primer**；不得當 entity 正文直接落盤 |
| `resetPiGm` | dispose 後立刻開酒館 session | 禁止此語意；見已定案 17 |

舊 runtime 相容與 `needs_setup` **優先序（寫死）：**

1. **有效** `world.json`（可 parse 且 `source` 為 `"default"` | `"custom"`）→ **ready**，以 world 為準，**不要**再跑指紋、不要改 source。
2. **有** `world.json` 但無效（壞 JSON、缺欄、非法 source）→ **needs_setup**。**不要**用指紋救成 default，**不要**改寫該檔。
3. **無** `world.json` → 才看 entities：**若 id 集合 ⊇ `kb/seed/*.json` 的全部 id**（現行即含齊 `player`、`bartender`、`ash`、`tavern`、`sealed_note`；seed 增檔則跟目錄）→ 視為 0.2.0 之前的酒館局，**保留**多出來的 entity，只補 `world.json` `{ "source": "default", "title": "鏽燈酒館" }`。缺任一 seed id、entities 空、或無法 parse → needs_setup，**不要**標 default。禁止「只要非空 entities 就 default」（初審 H1）。

## 已定案

1. **兩條起始路徑，沒有第三條「空白開打」。** UI 必選其一：`default` 或 `custom`。未完成 setup 時 `POST /api/turn` 回 **409**，body 含 `needs_setup: true`。
2. **Default 世界起始劇本**＝`kb/seed/*.json` + 契約前綴 + 酒館 canon + `prompts/npc-bartender.md` + `prompts/npc-ash.md` + 現行 `INITIAL_GM_NOTE`／`INITIAL_SCENE`。本版 **不改** 酒館劇情；可拆現行 `prompts/gm.md`，合併後語意須與今日等價。
3. **Custom 輸入是引子，不是 seed。** 四欄：`worldview`、`protagonist`、`extras`、`starting_point`。禁止把這四段當世界正文落盤（第 16 條）。
4. **必填與長度（UTF-16）：** 一律 `String#trim()` 後的 `length`（JS code units）。`worldview` 與 `starting_point` ≥ 8 且四欄各 ≤ 4000。超長 400。`protagonist`／`extras` 可空：生成器自補無名外鄉人、1–3 名開場 NPC、一條鉤子。
5. **生成器輸出上限（同上 length）：** `gm_note` ≤ 800；`title` 1–40；`gm_canon` ≤ **8000**。超限＝生成失敗。
6. **生成器與對局分開。** 生成：獨立 pi job、`noTools`、只要 JSON，不寫入對局 `pi-sessions/`。Parse 失敗可在 **同一生成 session** 再要 JSON，模型回覆最多 **3 次**（初回＋2 次重試）；仍失敗 4xx、不落盤。Mock 不重試、不打外網。成功且原子 commit 後才 `createPlaySession`。
7. **原子落盤：** 寫暫存 → 校驗 → `rename` 進 runtime；**有效 `world.json` 是 commit 標記**。失敗刪暫存。無 world 的 entities／prompts 不得留在 runtime。
8. **Custom 仍單場景：** 一個 `scene`／`scene_id`。不做地圖或旅行系統。
9. **開場卡司：** default 只在 seed + default 專用 prompts。custom NPC 只進 runtime，禁止寫 repo `prompts/` 或 `kb/seed/`。
10. **「新遊戲」**＝丟棄本場再選劇本（回選單），不是跳過選單再灌酒館。
11. **「重開畫面」**只清 DOM。
12. **NSFW 可；不可涉及未成年人**（生成器與 GM 皆是）。
13. **標題：** 生成器 `title` ≤ 40；default 固定「鏽燈酒館」。UI header／`<title>`／placeholder 隨 world；setup 畫面用中性標題。
14. **不做**人設編輯器、多世界槽、開打後再跑 primer 生成。
15. **Prompt 拆檔：**
    - 契約前綴（建議 `prompts/gm-contract.md`）：僅 JSON 契約、narration vs `npc_lines`、events、gm_note 上限、NSFW／未成年人、新角色新 id。**不可含**鏽燈、瑪拉、灰、紙條、燈手、「酒館 POC」。
    - Default 專用：卡司與酒館 canon + 兩份 `npc-*.md`。
    - Custom 對局＝前綴 + runtime `prompts/gm.md`（`gm_canon` only）。禁止把整份舊 `gm.md` 當前綴。
16. **引子校驗：** 任一 primer 欄 trim 後 length ≥ 8，不得與任一 entity `summary` 或 `private_notes` 全等，亦不得被該兩欄整段包含。
17. **禁止沿用現行 `resetPiGm()`。** 拆成 `disposePlaySession()`（new-game／setup 前：只釋放不建立）與 `createPlaySession()`（僅 ready 之後，依 `world.source` 組 prompt）。`getSession()`／`piGm` 在 needs_setup 時禁止 lazy 開局。Mock 同樣。
18. **Coerce／後備不得假設酒館。** `normalizeGmPayload` 缺 `npc_id` 不得 `"bartender"`；缺 `gm_note` 不得「本場：酒館。」（用 `unknown_npc` 與「本場進行中。」或該回合失敗重試）。Setup 前 `loadScene`／state 的 `scene` 為 **null**，禁止 tavern 後備讓 UI 以為已開打。`KNOWN_NPC_NAMES` 僅 default 補名。Turn 的 `scene_id` 來自 state 的 scene，UI 不得寫死 tavern。
19. **Setup HTTP：** 已 ready 時 default **與** custom 皆 409。Process 內 setup **single-flight**；進行中第二請求 409 + `generating: true`。`GET /api/state` 增加記憶體 `setup_status: "idle" | "generating"`。
20. **生成器 system／user prompt** 必須寫明與 zod 相同的硬規則（`player` id、`kind` 枚舉、`scene_id`＝某 place id、`present` 含 player 與 npc 等）。
21. **Relations：** 可不給則 `[]`；有給則須過 `RelationSchema` 且 a／b 皆在 entities，否則整次失敗。
22. **原子 commit 取代、不 merge：** 暫存齊備後，commit 前須清掉（或先搬走）`kb/runtime` 內既有 playthrough 檔再 `rename`。Linux 上 rename 進非空目錄會失敗。半套殘檔 **禁止** 與新 seed merge（custom 殘 entity 不得混進 default）。
23. **`GM_MODE=mock` 對局依世界分支。** Setup 的 harbor fixture 與對局 mock **不是**同一層。`world.source === "custom"`（或 scene 非酒館）時，`runTurn` 的 mock GM **禁止**再出瑪拉／灰／紙條；須用第二套 fixture（讀 entities／scene，例如 `keeper`／`harbor_inn`）。default mock 可維持現行酒館 `gm-mock.ts`。瀏覽器 custom 在 mock 下必須能過 Track C（人設非酒館）。
24. **Ready 後重開 process：** 若 `needs_setup` 為 false 且 `pi-sessions/` 有 jsonl → 對局用 `continueRecent`；`systemPromptOverride` **仍依當前** contract＋canon（`world.source`），與今日「重載 bun 接最近一局」等價。needs_setup 時 **不得** continue。
25. **`setup_status`：** 任何結束路徑（成功、4xx、例外）`finally` 回到 `idle`。`POST /api/new-game` 在 generating 時：能中止 job 則中止並清空；否則 **409** 等到結束，禁止卡死在 generating。
26. **生成 HTTP 時限：** `idleTimeout` **≥ 180** 秒。連線被切斷後仍須 finally 清旗標、不落盤。

開工前仍須拍板：無。

## 非目標

- 多存檔槽／匯出世界包／社群分享劇本
- 生圖、戰鬥、任務日誌、多地點狀態機
- 真・多 agent NPC；Writer 仍不呼叫模型
- 把 Engram 或私人生活寫進 seed
- Compact GM session（仍未做，不塞進本版；構想見 [`../backlog/session-compact.md`](../backlog/session-compact.md)，尚未排程）
- KB runtime 結構版本／migrate（仍未做；構想見 [`../backlog/kb-runtime-upgrade.md`](../backlog/kb-runtime-upgrade.md)，尚未排程）
- 改 OpenRouter 直連（仍只經 pi）

## 驗收

- [x] 清空 runtime 後開頁：**先看到起始選擇**，沒有酒館開場氣泡，`needs_setup: true`，`scene: null`。
- [x] 選 **預設劇本** → 實體 id 集合＝`kb/seed`；瑪拉／灰／紙條 canon 與現行 POC 等價。
- [x] 選 **自訂**（mock 或真模型）→ entities 非 primer 原文／非整段包含；≥1 place、1 player（id `player`）、≥1 npc；可 **在 Track C 完成後** 送出一回合且通過 `parseGmOutput`，且人設不是酒館硬編碼。
- [x] `GM_MODE=mock` custom **不打外網**（harbor fixture）。
- [x] 壞 JSON（含重試仍失敗）：runtime 無新 `world.json`、無半套 entities、`needs_setup` true。
- [x] **新遊戲** → 選單；無舊 `pi-sessions`／episodes；記憶體無對局 session。
- [x] 舊酒館局（無 world.json，entities **⊇ seed ids**，即使多了 Writer 新 id）重開 server **可玩**；缺任一 seed id 的半套 **進 setup**。無效 world.json → setup，不改寫成 default。
- [x] `bun test` 全綠；測試用 `VIBE_GAMEVERSE_KB_RUNTIME`；測試灌 default 須顯式 setup，禁止依賴 boot 偷灌（`setupDefaultForTest` 或等價）。
- [ ] 瀏覽器：setup → default 一回合；新遊戲 → custom 一回合；重開畫面後下一句仍帶記憶。（HTTP／HTML 已過；本環境無 browser MCP 工具，尚未點過真實畫面）

## 實作軌道

### Track A — Setup 閘門與 default

- **做：** `world.json`；指紋為 **⊇ seed ids**；無效 world 三路優先序；原子 default 落盤（取代不 merge）；`POST /api/setup/default`；new-game 只清空 + dispose；`ensureRuntime` 不再偷灌；測試改顯式 default setup。
- **不做：** custom 生成；沿用 `resetPiGm` 立刻建 session。
- **驗收：** 空庫 needs_setup；default 後 id 集合＝seed；setup 前 getSession 不開局。

### Track B — Custom primer → seed

- **做：** primer／generated seed zod；harbor mock；pi 生成 job（含最多 2 次 JSON 重試）；原子 commit；引子包含檢查；`gm_canon` 上限；single-flight。
- **不做：** 把 primer 當 GM 第一句；接續對局 session；要求此時 custom 對局人設已正確。
- **驗收：** mock 測試；壞 JSON 不落盤；成功後 `needs_setup: false` 且檔案齊。 **不要求** 此時送 turn 的 GM 已是 custom canon（那是 Track C）。

### Track C — 對局 GM 讀本場 canon + coerce

- **做：** `createPlaySession` 依 source 組 prompt；拆 gm-contract；改 coerce／scene；**mock 對局第二套 harbor fixture**；ready 重啟 continueRecent＋現行 prompt；custom 一回合非酒館卡司。
- **不做：** 每回合重跑 seed 生成。
- **驗收：** default 仍瑪拉／灰；custom 載入 gm_canon；缺欄 coerce 不冒出 bartender／「本場：酒館。」

### Track D — Web UI

- **做：** 兩選一；四欄說明；`setup_status` loading；header／title／placeholder；新遊戲回選單。
- **不做：** 華麗 wizard。
- **驗收：** 瀏覽器清單。

### Track E — 文件與版本

- **做：** `VERSION.md` → `0.2.0`；更新 `AGENTS.md`；根目錄 `changelog.md`。
- **不做：** 重寫 brainstorm。

## 錨點檔案

| 路徑 | 用途 |
|------|------|
| `program/kb.ts` | `ensureRuntime`／`loadScene`；指紋與 world.json |
| `program/gm-mock.ts` | 現行只酒館；custom mock 須另分支 |
| `program/server.ts` | routes；將加 setup |
| `program/gm-pi.ts` | **現行 `resetPiGm` 必須拆**；prompt 載入；seed job |
| `program/schema.ts` | `normalizeGmPayload`、`KNOWN_NPC_NAMES`、`PlayerInputSchema` |
| `program/turn.ts` | `scene_id` 後備 `"tavern"` |
| `program/public/{index.html,app.js,styles.css}` | 寫死酒館 |
| `program/turn.test.ts` | 依賴 `resetPlaythrough` 灌庫 |
| `kb/seed/` | Default 劇本與舊局指紋 |
| `prompts/gm.md` | 拆契約 vs default canon |
| `program/test-runtime-env.ts` | 測試隔離 |

## 行為約束（實作 agent）

- 繁體中文書面語；不 commit 除非使用者要求。
- Fixture 用虛構 harbor。勿 `rm` live `kb/runtime`。
- 先打穿驗收，勿做多世界槽。
