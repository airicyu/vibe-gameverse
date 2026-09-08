# 0.4.0 NPC 分層記憶（池 + L2 現用 + dirty set）

- 上游：[0.3.0 執行期只寫 kb／人設離開 source](../0.3.0/INDEX.md)（`shipped`）
- 構想來源：已出貨；契約以本 INDEX＋docs 為準（原 backlog `npc-memory-files.md` 已刪）
- Changelog：出貨時寫根目錄 [`changelog.md`](../../../changelog.md)；同步 `VERSION.md` 與 `AGENTS.md`
- 狀態：`shipped`
- 日期：2026-09-06（Asia/Hong_Kong）

## 產品句

對局除世界 KB 外，NPC 有 **分層主觀記憶**：重要性 0 與 1 同在一份池檔；升到 2 才有獨立現用檔且永不降級。開場即可指定 L2（預設瑪拉／灰），**不必**先把記憶寫滿。本版實作讀寫現用記憶、升級／L0 遺忘、dirty set、以及 **L2 archive 的 zod／路徑契約**。 **不實作** session compact、不寫入 NPC archive 檔、不搬 `pi-sessions` jsonl。

## 文件地圖

閱讀順序：

1. 本檔（WHAT）
2. [`docs/npc-memory.md`](./docs/npc-memory.md)（HOW：路徑、schema、一回合插入點、常數）
3. [`docs/reasoning.md`](./docs/reasoning.md)（WHY）
4. 開工：[`HANDOFF.md`](./HANDOFF.md)
5. 上游：[0.3.0 INDEX](../0.3.0/INDEX.md)

規格對照（勿當本版契約）：`docs/handover.md`、`docs/brainstorm.md`、根目錄 `AGENTS.md`、[0.3.0 INDEX](../0.3.0/INDEX.md)。

開工前仍須拍板：無。

## 與上一版對照

| 行為 | [0.3.0](../0.3.0/INDEX.md) | 0.4.0 |
|------|----------------------------|--------|
| NPC 主觀記憶 | 可選 `private_notes`，**不進** slice；Writer 幾乎不維護 | 動態記憶進 `kb/runtime/npc-memory/`；notes 仍靜態、Writer **不**把動態經歷寫進 notes |
| Entity | `persona`／summary／notes | 另加 `memory_tier`（僅 `kind: "npc"` 有意義；見已定案） |
| `MemorySlice` | episode 摘要 + entity id／name／summary + relations | **形狀不改**。NPC 記憶另欄走 `GmContext` |
| `GmContext` | player_text、gm_note、scene、memory_slice、turn_id、timestamp | 加 `npc_memories`：僅 **本回合 `scene.present` 內的 npc**，每 id 一節 body |
| 新 NPC | `ensureEntity` 無 tier／無池 | 預設 tier **0**；實質互動才寫池節 |
| 新遊戲／setup 原子清盤 | `PLAYTHROUGH_FILES` 等 | **一併**刪 `npc-memory/` |
| Session jsonl | 只增不壓 | **不變**（compact 當時未做；後由 [0.5.0](../0.5.0/INDEX.md) 出貨） |
| NPC archive 檔 | 無 | **只定 schema 與目錄規則**；本版 **禁止**寫 `archive/` 下檔案 |

**其餘 0.3.0 契約維持**（gate、persona、canon、不指紋、不讀 `npc-*.md`、測試隔離 runtime）。

## 已定案

1. **範圍。** 本版做角色**現用**記憶管線。Archive **格式與路徑**寫在 HOW、用 zod 鎖住，供日後 session compact 寫入（已由 [0.5.0](../0.5.0/INDEX.md) 出貨）。本版測試須斷言：回合／setup／new-game **不會**建立 `**/npc-memory/**/archive/**` 內的檔。
2. **誰有記憶。** 僅 `kind: "npc"`。player／place／item 無 tier 語意。非 npc **禁止**出現 `memory_tier`（有值 → parse **失敗**，不 coerce）。
3. **`memory_tier`：`0 | 1 | 2`。** 寫在 runtime `entities.json`（及 seed／生成 entity）。缺欄＋`kind: "npc"` → 視為 **0**（coerce 一次寫回可在 Writer／load 時做；seed 瑪拉／灰必須顯式 `2`）。**禁止**用「有沒有獨立檔」反推等級。
4. **L0 與 L1 同一檔** `npc-memory/pool.json`。L2 在 `npc-memory/l2/{npc_id}/current.json`（不得使用 `npc-memory/{id}.json`，以免日後與 `{id}/` 目錄衝突）。
5. **開場 L2 ≠ 記憶很長。** Default `bartender`、`ash`：`memory_tier: 2`，`current.json` 可極短（酒館既有印象；HOW 兩句是**記憶常數**，不是 `persona`）。Custom／`ensureEntity` 新 id：預設 **0**。生成結果 **preprocess**（與 userPrompt 同一套）：npc 缺欄 → 0；**任何 1 或 2 改寫為 0**（不因此整次生成失敗）。升等只發生在遊玩 Writer。custom commit **不**寫 `l2/`。禁止 custom 灌瑪拉／灰／酒館池文。
6. **永不降級 L2。** L1 **不降回** 0。禁止 0→2 **跳級**（seed／顯式 Default setup 指定 2 除外）。同一回合可先 0→1 再依長度 1→2（兩步，不算跳級）。
7. **升級不算露臉、不算招呼。** **禁止**用 `scene.present` 次數。**不改** 0.3.0 `upsertRelation`（招呼 event 仍可能寫世界 relation）。記憶側 **忽略** trivial 造成的 relation 寫入：trivial 永不因 relation 升等。Trivial（不升級；池節可不寫或極短 L0；**已是 L2 則 trivial 不改 current**）當且僅當下列之一：(a) 該 id 出現在某 event 的 `actors` 且該 event `action`（trim、lower case）∈ HOW `TRIVIAL_ACTIONS`，且本回合該 id **沒有** 任何非 trivial event；(b) HOW **僅台詞**啟發式（無任何 event 的 `actors` 含該 id、無非 trivial relation、僅有 `npc_lines` 且每條 `text` trim 後 UTF-16 ≤ 16）。寧可漏升。0→1：該 id **可寫 body**（見 14）且 **非 trivial**，且滿足至少一支：非 trivial event 的 `actors`；**或** 由非 trivial event 寫入／更新了涉及該 id 與玩家的 relation；**或** 有該角 `npc_lines` 且並非 (b)（即至少一條 UTF-16 > 16，即使本回合無 event）。**不**用 `entity_ids` 升等。0→1 必須同時寫 pool 節 `tier: 1` 與 entity `memory_tier: 1`（同一落盤；失敗則兩處都不改）。1→2：**僅**當升檔判定用的 **截斷前候選** `body` trim 後 UTF-16 **> 600**（見 HOW；落盤後池節 ≤ 600）。升 2 必須原子：剪出池節 → 寫 `l2/{id}/current.json` → entity `memory_tier: 2` → 更新 dirty set；失敗整步回滾。可測失敗點見 HOW。已是 L2 且可寫且非 trivial：更新 `current.json`（尾端優先、截 800）、`updated_turn = current_n`。
8. **L0 遺忘。** `last_substantive_turn` 為整數，等於當時 `turn_id` 的數字（`t0001` → `1`）。**新建** L0 池節時（含 trivial 極短寫入）設為本回合 `n`；之後 **僅實質命中** 才刷新（實質命中＝非 trivial，定義同 7，且通常同回合 0→1，該節不再是 L0）。後續 **trivial 不刷新**。刪除條件：仍為 L0 且 `current_n - last_substantive_turn >= 12`（例：僅招呼於 `n=1` 寫入 L0，其間無 0→1，當 `n>=13` 刪節）。**不**刪 `entities.json`。合法測前置：trivial 招呼寫 L0、維持 0，十二回合無三支 0→1。所有 L0 `body` UTF-16 合計 > 4000 → 刪最舊 L0 直到 ≤ 4000。L1 **不過期刪人**。**不做** distill L1。
9. **現用／池不存逐字對白。** body 記知情、態度、承諾、謊言。硬上限：落盤後池每節 **600**、L2 current **800**（皆 UTF-16）。L0 候選 > 600：若本回合已符合 0→1 則先升 1 再走 7；否則 **截斷至 600、維持 0**（禁止靠長度 0→2）。L1 截斷前 > 600 → 升 2（current 再截到 800）。已是 L2 則截斷現用（尾端優先保留），**不**寫 archive。
10. **誰寫。** 不擴充對局 GM JSON。`writeFromGm` 之後（仍先落 episodes／entities／relations）由 **同一 Writer 程式路徑**機械更新池／L2 current／dirty set。模板見 HOW。本版 **不**為 NPC 記憶另開 pi 呼叫。
11. **誰讀。** 組 `GmContext` 時對 `scene.present` 中每個 npc：L2 讀 `current.json`；L0／L1 讀 pool 該 id 一節（無節則省略該 id）。**禁止**把整份 `pool.json` 塞進 prompt。`persona` 仍只在 system（0.3.0）。`private_notes` **不**自動併進 body；對局 **不**把 notes 塞進 `npc_memories`（避免與動態記憶雙源）。GM prompt 加短規則：寫某 `npc_id` 台詞時只准用該 id 的 `npc_memories` 節＋當場公開敘事；禁止用另一 id 的秘密。
12. **Dirty set 已定做。** 路徑 `npc-memory/dirty-set.json`。欄位：`since_session_archive`（`string | null`，本版恒 `null`）、`touched`（自本場開始寫過池節或 L2 current 的 npc id，**含 L0／L1**）、`near_cap`（L2 且 **現盤** current body UTF-16 長度 ≥ 640）。每回合 Writer 更新：`touched` **只增**（new-game 除外）；`near_cap` **每回合依現盤重算**（截斷後 < 640 須移出）。讀取對局 **禁止**用 dirty set 當在場名單。日後 compact 必須 `filter` `memory_tier === 2` 才寫 NPC archive，不得對池 id 建 `l2/`。
13. **Archive 契約（只定形、不寫檔）。** 日後路徑 `npc-memory/l2/{npc_id}/archive/index.json` 與 `{npc_archive_id}.json`。zod 名稱與欄位見 HOW（`npc_archive_id`、`session_archive_id` 可選、`salient_quotes` 最多 3 條、每條 `text` ≤ 120、speaker 僅該 npc 或 `player`）。本版 export schema 並單測 parse 即可。
14. **在場過濾寫入（改 body）。** 須 X 在本回合某 event 的 `actors`，**或** 有該角 `npc_lines`。**僅** `scene.present`、無 actors、無台詞 → **不准**改 body（露臉不夠）。**單獨** `entity_ids` **不准**改 body／升等／刷新 `last_substantive_turn`。已是 L2 者同此過濾才改 `current.json`。
15. **Setup／new-game。** `clearPlaythrough`／原子 commit 前清理 **recursive 刪** `npc-memory/`。Default commit：寫瑪拉／灰 `l2/{id}/current.json` + 空 pool `{ "npcs": {} }` + dirty-set 初值（touched 可含兩 L2 id 或空，見 HOW：初值 `touched: ["bartender","ash"]`，`near_cap: []`）。Custom commit：空 pool、dirty-set 全空、**不**為生成 NPC 建 L2 目錄。
16. **Mock。** `GM_MODE=mock` 對局不寫長記憶；Writer 仍跑同一套機械更新（用 mock 的 `events[]`／`npc_lines`）。Harbor 新 NPC 保持 tier 0。Default mock 酒館事件可讓瑪拉／灰 current 被改寫——測試用隔離 runtime。
17. **UI。** 不做 NPC 日記產品面。header／氣泡不變。
18. **測試 BAN。** 只用 `VIBE_GAMEVERSE_KB_RUNTIME`。禁止 `rm` live `kb/runtime`。必測：升 2 原子；招呼不升級；present 不升級；L0 遺忘不刪 entity；GM context 無整份 pool；custom 無酒館 L2 文；new-game 無 `npc-memory/`；不建立 archive 檔。

## 非目標

- 不實作 session compact、不搬 jsonl、不寫 NPC `archive/` 檔（見 backlog session-compact；**寫入**是該項 TODO）
- 不做每 NPC 獨立 pi-agent；不為記憶另開每回合模型
- 不做多存檔槽、KB `store_version` migrate
- 不做多地點狀態機、不改酒館故事核、不做人設／記憶編輯器 UI
- 不把 `private_notes` 廢欄或 hop migrate 舊存檔（無標記 runtime 缺 `memory_tier` 當 0，L2 seed 只影響新 setup）
- 不改 OpenRouter 直連；不恢復指紋；不改 0.3.0 gate／persona BAN

## 驗收

- [x] Default setup 後：`bartender`／`ash` 的 `memory_tier === 2`，存在 `npc-memory/l2/{id}/current.json`；`pool.json` 無這兩 id。
- [x] 新開口路人：`memory_tier === 0`；僅招呼 → 不升 1；非 trivial 互動 → 可進 pool 且可升 1。
- [x] Pool 單節 body > 600 → 該 id 變 2、池無該節、有 `l2/{id}/current.json`；製造半套失敗的測試要回滾。
- [x] 12 回合無實質命中的 L0 從 pool 消失，entity 仍在。
- [x] `runTurn` 組出的 GM 側 context：`npc_memories` 只有 present 的 npc 節；fixture 證明 pool 裡其他 id 不出現。
- [x] `dirty-set.json` 在寫入後含對應 `touched`；L2 body ≥ 640 進 `near_cap`。
- [x] Custom harbor：無 `l2/bartender`；新 npc 非 2。
- [x] 全庫無本回合新建的 `archive/` 檔。new-game 後無 `npc-memory/`。
- [x] `bun test` 全綠；出貨時 `VERSION.md`＝`0.4.0`；`AGENTS.md` 寫明 npc-memory 路徑與「compact 尚未寫 archive」。

## 實作軌道

### Track A — Schema、路徑、setup 清盤

- **做：** `memory_tier`；pool／dirty-set／L2 current／archive（只 schema）zod；`kb.ts` 路徑與 `clearPlaythrough` 刪目錄；default／custom commit 初值；seed 兩 NPC `memory_tier: 2`；生成 preprocess 強制 npc 最多 0。
- **不做：** 寫 archive 檔；migrate 舊局成 L2。
- **驗收：** setup 測試隔離目錄形狀正確；缺 tier 的 npc 當 0；生成 fixture 寫 2 則落盤為 0 且無 `l2/`。

### Track B — Writer：更新、升級、遺忘、dirty set

- **做：** `writeFromGm` 之後機械更新；trivial 表（含僅台詞啟發式）；HOW 單回合順序；升 2 原子與測試注入點；L0 遺忘公式；截斷上限；`near_cap` 重算。
- **不做：** 第二個模型；改 GM JSON 契約加 memory 欄；改 0.3.0 relation 啟發式。
- **驗收：** Track B 單測覆蓋已定案 7–10、12、14；`action: greet` 即使世界寫了 relation 亦不升 1。

### Track C — 對局讀取

- **做：** `GmContext.npc_memories`；導出 `buildGmContext`（或同等純函式）供單測；`gm-pi.ts` 組 prompt 附在場節；不串台短規則寫入 `prompts/gm-contract.md`（僅 pi system；mock 不讀契約檔、不須同文）。缺 `current.json` 的 L2：該 id **省略**出 `npc_memories`，**不**改 `memory_tier`、不 500。缺 `pool.json`／`dirty-set.json`：讀成空結構（見 HOW），不在讀取路徑建 L2。
- **不做：** 把 notes／整份 pool 灌進 slice；不把 `npc_memories` 加進對玩家的 HTTP `TurnResult`。
- **驗收：** 與驗收清單「context 只有 present」；單測只打組裝函式。

### Track D — 回歸與文件

- **做：** 已定案 18；更新 `AGENTS.md` 檔案樹；出貨 changelog／VERSION。
- **不做：** 重寫 0.3.0 INDEX 正文。

## 錨點檔案

| 路徑 | 用途 |
|------|------|
| `program/schema.ts` | `memory_tier`、`GmContext`、pool／dirty／current／archive zod |
| `program/kb.ts` | runtime 路徑、clear／commit、load npc-memory |
| `program/writer.ts` | 世界 KB 之後更新角色記憶 |
| `program/turn.ts` | 組 context 的插入點（GM **前**讀盤；Writer 之後下一回合才讀到本回合記憶） |
| `program/world-generate.ts` | custom 生成 preprocess：npc tier 最多 0 |
| `program/gm-pi.ts` | system persona 不變；user／context 附 `npc_memories` |
| `program/gm-mock.ts` | 不另寫記憶；可走同一 Writer |
| `kb/seed/bartender.json`、`ash.json` | `memory_tier: 2` |
| `program/world.test.ts`、`turn.test.ts`（及新測） | 隔離 runtime |
| `AGENTS.md` | 一回合表加 npc-memory；compact 仍未做 |

## 行為約束（實作 agent）

- 繁體中文書面語；不 commit 除非使用者要求。
- 勿 `rm` live `kb/runtime`。例證虛構。
- 先打穿驗收。勿做 compact／migrate／多 agent／日記 UI。
- 改定案先問 Eric；常數已寫死在本 INDEX，勿擅自改 600／800／12。
