# 0.5.0 Session compact（封存活對局 + L2 archive + 一層回想）

- 上游：[0.4.0 NPC 分層記憶](../0.4.0/INDEX.md)（`shipped`）
- 下游：[0.6.0 Compact 分 scope 與同回合平行](../0.6.0/INDEX.md)（`shipped`；不覆寫本版已定案）
- Changelog：根目錄 [`changelog.md`](../../../changelog.md)；`VERSION.md` 與 `AGENTS.md`
- 狀態：`shipped`
- 日期：2026-09-07（Asia/Hong_Kong）

## 產品句

長局把活著的對局 jsonl **封存**、開新 session，並在同一拍寫入重要性 2 角色的 archive、壓短其現用記憶。目錄上的摘要可掃；像在問舊事時再打開少數細節。本版一併改活目錄名、取消 L2 800 硬截斷、新增根目錄 `config.yaml`。

## 文件地圖

閱讀順序：

1. 本檔（WHAT）
2. [`docs/session-compact.md`](./docs/session-compact.md)（HOW：路徑、yaml、一回合插入點、zod）
3. [`docs/reasoning.md`](./docs/reasoning.md)（WHY）
4. 開工：[`HANDOFF.md`](./HANDOFF.md)
5. [0.4.0 npc-memory HOW](../0.4.0/docs/npc-memory.md)（archive 欄位；本版才寫入）

規格對照（勿當本版契約）：`docs/handover.md`、`docs/brainstorm.md`、根目錄 `AGENTS.md`、[0.4.0 INDEX](../0.4.0/INDEX.md)。

開工前仍須拍板：無。

## 與上一版對照

| 行為 | [0.4.0](../0.4.0/INDEX.md) | 0.5.0 |
|------|----------------------------|--------|
| 活 jsonl | `kb/runtime/pi-sessions/` 只增不壓 | `play-sessions/`；成功 compact 後換成新檔；舊檔在 `session-archive/` |
| L2 `current` | UTF-16 **800 硬截斷** | **不截 800**；≥640 仍進 `near_cap`（不當 trigger） |
| NPC `archive/` | 只 zod、禁止建檔 | compact 成功才寫；格式仍認 0.4.0 HOW |
| `dirty-set.since_session_archive` | Writer／kb **恒 null** | 成功 compact 後寫入該次 `archive_id`；日常 Writer **不得**再抹成 null |
| 回想 | 無 | 啟發式才掃 index；最多 2 份細節 |
| 設定 | 僅 `.env` | 另加 `config.yaml`（缺檔啟動失敗） |
| 場景 present | setup 寫入後對局不改 `scene.json` | 每回合 GM 必填 `scene`；Writer 在 compact 前落盤 |

**其餘 0.4.0 契約維持**（gate、persona、canon、npc_memories 組裝、trivial／升等／L0 遺忘、池 600、custom 無酒館 L2、測試隔離 runtime）。

## 已定案

1. **範圍。** 本版做：compact 觸發與整步落盤、L2 archive 寫入與 distill、`play-sessions` 改名、`config.yaml`、新 session 開場、一層回想。不做人可點的歷史 UI、不多存檔槽、不做第二層「章」rollup。
2. **一條管線。** 日常 Writer（世界 KB＋池／current／dirty）每回合照舊，**不是** compact。成功 compact 順序：本回合 `writeFromGm`（含記憶）已落盤 → 組齊暫存（複製 jsonl、session summary、資格內 L2 archive、distill current、dirty）→ 校驗通過才從活目錄去掉舊 jsonl、寫入正式封存、dispose、開新對局 session。L0／L1 無獨立 archive。禁止把整份 jsonl 複製進每個 NPC 目錄。
3. **整步失敗＝沒發生。** summary／zod 壞、複製失敗、任一 L2 寫入／distill 失敗 → 刪暫存、不 dispose、活 jsonl 原位、本回合當普通回合結束。不得半套。強制路徑同樣。
4. **`near_cap`。** L2 body UTF-16 ≥ **640** 列入，只當此次 compact **優先 distill 誰**。不觸發 judge、不硬封、不開新 session。
5. **取消 L2 800 硬頂。** 廢 0.4.0 current／zod／升 2「再截 800」。日常 Writer 不因 800 砍 `current`。池節 **600**（L1→2）與 L0 遺忘 **12**、池 L0 合計 **4000** 不變。無更高日常硬頂。
6. **問 judge（非 hard）。** 獨立短呼叫（臨時目錄，**不**寫入 `play-sessions`），zod，不污染對局 GM JSON。輸出：`should_compact`（boolean）、`reason`（短句、不給玩家）、可選 `title`。無 `beat_kind` 枚舉。輸入：本回合 `events[]`、`scene.present` 相對上回合的差、近 **8** 則 episode 摘要（與對局 `memory_slice` 同一窗口）；**不要**整份 jsonl；**不要**用 `gm_note` 字串是否變化當開關。問的時機僅：(a) 本回合 GM 輸出並落盤後的 `scene.present`（成員集合，與順序無關）相對**本回合開始時**盤上快照有進出（含 L2 離場；離場只當輸入，**不**等於必封）；或 (b) 自 compact **錨點**起回合差 ≥ `max_turns_without_compact`（新局 setup 後錨點 `anchor_turn_n = 0`，第一回合差為 1）。**(b) 若 `should_compact === false`：把錨點設為本回合 `turn_id` 的數字，再等 N。** (a) 與 (b) **同一回合都成立**且 judge 否 → **同樣**改錨點（因 (b) 已成立）。僅 (a) 成立而 judge 否 → **不**改錨點。`scene_id` 微變、只走動、僅 `gm_note` 覆寫、`present` 成員不變 → 不問。錨點落盤見已定案 18。
7. **Hard 僅強制線。** 本回合 GM 已寫入活 jsonl 之後（HOW 步驟 4，在 Writer／scene 落盤後），讀該檔**最後一則** assistant 的 `usage.input` ≥ `force_after_input_tokens`，**或**（無用量欄）該活 jsonl 位元組 ≥ `force_after_jsonl_bytes`。比較的是**剛結束這一回**已發生的大小，不是「再上一 HTTP 回合」，也**不是**預測下一回 token。跳過 judge 否決。summary 必須 `truncated: true` 且 title／body 寫明非自然換幕。`near_cap` 與滿 N 回合都不是 hard。
8. **`config.yaml`。** 倉庫根目錄，可 git。開機 zod 讀；缺檔、缺鍵、型別不對 → **process 啟動失敗**。`.env` 仍只管密鑰／`GM_MODE`／`PI_MODEL`。本版鍵與預設（整數，可調）：

```yaml
compact:
  max_turns_without_compact: 20
  recent_turns_to_keep: 3
  force_after_input_tokens: 100000
  force_after_jsonl_bytes: 400000
```

`max_turns_without_compact` 勿與 L0 的 12 混用。測試可設 `VIBE_GAMEVERSE_CONFIG` 指向隔離 yaml（缺此 env 則讀倉庫根目錄 `config.yaml`），**禁止** `rm` live `kb/runtime`。
9. **活目錄。** `kb/runtime/play-sessions/` 取代 `pi-sessions/`。程式識別子可留 `createPlaySession`；**磁碟路徑禁止再出現 `pi-sessions`**（開機遷移舊對局目錄除外）。開機：若存在舊 `pi-sessions/` 且尚無 `play-sessions/` → 改名一次再 `continueRecent`。**兩邊都有**則以 `play-sessions/` 為準、**不**自動合併、**不**刪舊 `pi-sessions/`（測須覆蓋）。生成 job 暫時 session 在臨時目錄（目錄名不得再叫 `pi-sessions`，例如 `generate-sessions`），不得寫進 playthrough 的 `play-sessions`。新遊戲／clear：刪 `play-sessions/`、`session-archive/`、`compact-scratch/`、`compact-state.json`。
10. **封存目錄。** `kb/runtime/session-archive/index.json` 與 `session-archive/{archive_id}/session.jsonl`、`summary.json`。`archive_id` 格式 `^sa_[0-9]{3,}$`（例 `sa_001`）。summary 用 JSON＋zod，不用 markdown。jsonl：**先複製**進暫存／封存，整步成功再從活目錄去掉舊檔。
11. **新 session 開場。** 給 GM、不進玩家氣泡。System 仍依 `world.source` 組 contract＋canon＋persona，**禁止**整份舊 jsonl 貼回 system。第一則含：已封存與 `archive_id`；本拍 summary.body（UTF-16 **1–800**，空字串非法）；現行 `gm_note`、scene、present；在場 L2 distill 後 current；舊 jsonl **尾端最近 `recent_turns_to_keep` 回**對白（不滿則全帶；是對白不是再貼近 8 則 episode）。從 jsonl **解析不到**使用者／助理配對時：**省略對白段，仍可 compact**（summary 仍必有）。開場不打開更早 jsonl 或 NPC archive。尾端 3 回可能含離場後密談——接受，不另做刪句。
12. **誰寫 NPC archive。** 僅 `memory_tier === 2`。從 dirty `touched` 篩，禁止對 L0／L1 建 `l2/`。另須本段（自上次 compact 或開局至本回合）該 id 曾可寫 body（event `actors` 或自己的 `npc_lines`）。整段僅 trivial、未改 `current` 則跳過。路徑／zod 以 0.4.0 HOW 為準（`npc-memory/l2/{id}/archive/`）。正文**不是**機械複製 `current`：每名資格 L2 **另開**短呼叫（`prompts/compact-npc-archive.md`，臨時目錄、不進對局 jsonl），輸出該筆 archive（`title`／`summary`／`salient_quotes`）與 distill 後 `current.body`；zod 失敗或 distill 後 body UTF-16 **仍 ≥640** → **整步 compact 失敗**（**禁止**程式再截 distill 冒充成功）。同一拍填 `session_archive_id`。成功後收拾 dirty：`since_session_archive`＝本次 id；**`touched` 清空再把本回合剛寫過的 id 寫回**（與 Writer 本回合合併），`near_cap` 依 distill 後重算。
13. **回想：啟發式才掃。** 預設不掃。不每回合掃。不在對局 GM JSON 加點名欄。命中才掃 index 的 title／summary（不計打開次數）。啟發式在**本回合 GM 之前**跑（本回合 `events[]`／`npc_lines` 尚不存在，**不得**用它們、也**不得**改用「上回合 events」冒充）。程式、**不**另開分類模型。命中任一支即可：（i）`player_text` 含 HOW 詞表子字串；（ii）`player_text` 出現盤上某 entity 的 **名或 id**，且該名或 id 出現在某筆已存在 archive 的 title／summary，且該名／id **不**出現在近 8 則 episode `summary` 正文。寧可漏召。
14. **回想打開上限。** 同一回合最多 **2** 份細節餵 GM。優先：若**本回合 `player_text`** 提到在場某 L2（名或 id）→ **1 份 session 封存 + 該角 1 份 NPC archive**；否則 **分數最高的最多 2 份 session 封存**。不得 2 份都是 NPC 還外加 session（總數仍 ≤2）。每份：summary 可整段；另外最多 **3** 段原文，每段 UTF-16 **≤120**。jsonl 只抽相關列。摘錄進當回合 GM context，不進玩家 HTTP。
15. **Mock。** `GM_MODE=mock` 給人玩 **不**假裝每段 compact（檔很小通常碰不到強制線；滿 20 回合仍可問 judge——mock 的 judge **測試注入或固定 `should_compact: false`**，避免酒館 mock 無故切 session）。單測：隔離 runtime、fixture、compact 函式、judge／強制注入。
16. **UI。** 不為 archive 做產品面。header／氣泡不變。compact 失敗不向玩家解釋內部暫存。
17. **測試 BAN。** 只用 `VIBE_GAMEVERSE_KB_RUNTIME`。禁止 `rm` live `kb/runtime`。例證虛構。非 compact 回合仍不得建立 `npc-memory/**/archive/**`；**僅成功 compact** 才建。舊 0.4.0「任何回合都不建 archive」測規本版改為此句，不必改寫 0.4.0 INDEX 正文。
18. **`present` 落盤與 compact 錨點。** 本版對局 GM JSON **必填** `scene`（形狀同現有 `SceneState`：`scene_id`、`present`、`visible`）。`parseGmOutput` 缺欄／非法 → 該回合失敗，**不**用 `gm_note` 字串解析冒充 present，**不**coerce 預設酒館名單。必須改 `prompts/gm-contract.md`（及 default 對局會讀到的契約）列出每回合輸出 `scene`；mock 路徑同樣產出合法 `scene`。Writer 在 compact 判斷**之前**把新 `scene` 寫入 `scene.json`；judge／(a) 比較用的「上回合」＝本回合開始時讀到的快照。N 回合錨點持久化於 `kb/runtime/compact-state.json`（`anchor_turn_n: number`，setup／new-game 寫 `0`），**禁止**只放行程記憶體。ready 後讀檔：缺檔或 zod 壞 → **視為 `{ anchor_turn_n: 0 }` 並寫回**，**不得**因此 `needs_setup`（含 0.4.0 存檔 continue）。`continueRecent` 必須讀（必要時補寫）此檔。成功 compact 後錨點＝本回合數字。
19. **Judge `title` 與封存標題。** 非強制路徑：若 judge 有非空 `title`，`summary.json` 與 `session-archive/index.json` 用該 title；否則用 summary 模型產出的 title。強制路徑：summary 模型仍跑，但 `truncated: true`，且 title **與** body 須寫明非自然換幕（可固定前綴加上模型句）；**覆蓋** judge title（強制線本就不經 judge 否決）。

## 非目標

- 不當 0.4.x hotfix；不做多存檔槽、對話歷史 UI、大地圖／多地點狀態機
- 不做 Engram 日曆 rollup、不做第二層章摘要、不 clone Engram
- Writer 仍不讀 jsonl；不每 NPC 獨立 pi-agent；不每回合為記憶／回想另開分類模型
- 不把 `npc_memories` 加進玩家 HTTP；不恢復指紋；不改 0.3.0 gate／persona BAN（本版 **只**為落盤 `present` 而在 GM JSON 加 `scene`，不加回想點名欄）
- 不把 API key 寫進 yaml 或 git

## 驗收

- [ ] Default 長局：滿 `max_turns_without_compact` 且 judge 說封（或測試注入）→ 活目錄換成新 jsonl；`session-archive/sa_00x/` 有 jsonl＋`summary.json`；資格 L2 有 archive 筆且 current 變短；`since_session_archive` 非 null。
- [ ] present 無人進出、未滿 N、未過強制線 → 不問 judge、不封。
- [ ] GM 輸出使 `present` 有進出（測試注入／mock fixture）且未滿 N、未過強制線 → **會**問 judge；judge 否且僅 (a) → 不改錨點、不封。
- [ ] Custom 無 L2 目錄：仍可封 jsonl、寫 `session-archive`、回滾測、新 session 開場最多 3 回對白；不因此建酒館 `l2/`。
- [ ] 滿 `max_turns_without_compact` 且 judge 否（或測試注入 `should_compact: false`）→ 不封；`anchor_turn_n` 寫成本回合數字；其後未再滿 N、無人進出、未過強制線 → 不問 judge。
- [ ] 僅改 `gm_note`（`present` 成員不變）→ 不問 judge。
- [ ] 強制線（fixture 假 usage 或假大檔）→ 不經 judge 否決即封；summary `truncated: true`。
- [ ] compact 寫入中途注入失敗 → 活 jsonl 仍在、無半套 archive、下一回仍同一活 session。
- [ ] L2 current 可長過 800 而不被 Writer 截；≥640 進 `near_cap` 仍不因此封。
- [ ] 開機舊 `pi-sessions/` 改名 `play-sessions/` 後可 continue；新遊戲後兩目錄皆無。
- [ ] 缺 `config.yaml` 或鍵型錯誤 → 啟動失敗（測可用子程序）。
- [ ] 回想：無啟發式 → context 無封存原文；命中 → 最多 2 份細節、每份最多 3 段 ≤120。
- [ ] 新 session 開場含尾端最多 `recent_turns_to_keep` 回對白（倉庫預設 3）；玩家 HTTP 無 archive 摘錄。
- [ ] mock 給人玩路徑不因滿 20 而自動 `should_compact: true`（除非注入）。
- [ ] `bun test` 全綠；出貨時 VERSION＝`0.5.0`；AGENTS 寫 `play-sessions`、compact 已做、current 不截 800。

## 實作軌道

### Track A — 設定、改名、schema、清盤

- **做：** `config.yaml` 讀取＋zod；`play-sessions` 路徑；開機改名（含雙目錄）；`session-archive` 與 NPC archive 寫入用 schema；`compact-state.json`（缺檔視為 0 並寫回）；GM JSON `scene`＋**改 `prompts/gm-contract.md`**＋Writer 落 `scene.json`；`clearPlaythrough` 刪封存／scratch／錨點檔；廢 L2 body ≤800；dirty 可持久化 `since_session_archive`。
- **不做：** 觸發器本體（問 judge／整步 compact 在 B）；回想熱路徑。
- **驗收：** 啟動／改名／缺 yaml／雙目錄不合併；new-game 無 archive 目錄；Writer 不再截 800；GM 缺 `scene` 回合失敗（單測）。

### Track B — compact 管線

- **做：** 回合插入點（Writer＋scene 落盤之後）；judge 呼叫與錨點更新；強制線；複製 jsonl；summary 模型＋zod；L2 archive 模型＋distill（≥640＝整步失敗）；整步回滾；新 session 開場（含 3 回尾；解析失敗可省略對白）。
- **不做：** 回想打開；歷史 UI。
- **驗收：** 驗收清單封存／回滾／truncated／開場 3 回／(a) 進出會問 judge／Custom 無 L2 仍封 jsonl。

### Track C — 回想

- **做：** HOW 啟發式；掃 index；上限 2／3／120；摘錄進 GM context。
- **不做：** GM JSON 點名欄；每回合必掃。
- **驗收：** 有／無命中的單測。

### Track D — 回歸與文件

- **做：** BAN 測改為「非 compact 不建 archive、compact 才建」；出貨 changelog／VERSION／AGENTS。
- **不做：** 重寫 0.4.0 INDEX 正文（可在 0.4.0 頂加「L2 800 已被 0.5.0 推翻」一句則可選、非必須）。

## 錨點檔案

| 路徑 | 用途 |
|------|------|
| 根目錄 `config.yaml` | 本版新建 |
| `program/schema.ts` | 廢 800；GM `scene`；archive／judge／summary／config zod |
| `program/kb.ts` | 路徑、改名、clear、dirty 持久化 since、`compact-state` |
| `program/npc-memory.ts` | 不截 800；compact 後 dirty |
| `program/writer.ts` | 不截 L2 800；落盤 `scene.json` |
| `program/turn.ts` | Writer 後 compact／回想插入點 |
| `program/gm-pi.ts` | sessionDir＝`play-sessions`；dispose＋新 session |
| `program/gm-mock.ts` | 不自動假封 |
| `prompts/gm-contract.md` | 對局 JSON **必**列出每回合 `scene`（`SceneState`） |
| `prompts/` | 另可新增 compact-judge／compact-summary／compact-npc-archive；**不**把 compact 欄塞進對局 GM JSON |
| `kb/runtime/compact-state.json` | 錨點 `anchor_turn_n`（本版新建） |
| `program/world-generate.ts` | 臨時 session 目錄改名，勿再叫 `pi-sessions` |
| `docs/roadmap/0.4.0/docs/npc-memory.md` | L2 archive 欄位（寫入本版做） |

## 行為約束（實作 agent）

- 繁體中文書面語；不 commit 除非使用者要求。
- 勿 `rm` live `kb/runtime`。例證虛構。
- 先打穿驗收。勿做非目標。
- 改定案先問；yaml 預設與 640／600／12／4000 勿擅自改（yaml 四鍵可被使用者改檔，程式預設必須與 INDEX 一致）。
- INDEX 已定案不要再問；沉默才提問。
