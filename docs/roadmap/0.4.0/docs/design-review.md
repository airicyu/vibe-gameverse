# Design review — 0.4.0 NPC 分層記憶（池 + L2 現用 + dirty set）

- 日期：2026-09-07（Asia/Hong_Kong）
- 輪次：**第四輪複審**
- 角色：設計審查（不改 INDEX／HOW／reasoning／HANDOFF／程式；不以本檔當已定案）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收；HOW：[`npc-memory.md`](./npc-memory.md)；WHY：[`reasoning.md`](./reasoning.md)；開工：[`../HANDOFF.md`](../HANDOFF.md)
- 對照（非本版契約）：[`../../0.3.0/INDEX.md`](../../0.3.0/INDEX.md)；構想：[`../../backlog/npc-memory-files.md`](../../backlog/npc-memory-files.md)
- 現行程式抽樣：`program/writer.ts`、`program/turn.ts`（0.3.0 shipped；本版尚未實作）
- **總評：無未關閉 HIGH。H5／M16／M17 已關閉。審查門檻通過。** M18、M19、L6–L8 非阻擋。

---

## Findings（第四輪複審）

本輪狀態：關閉＝已寫進 INDEX／HOW／HANDOFF；仍開＝契約仍分叉或主路徑／驗收未鎖；非阻擋＝記錄即可。

### HIGH

#### H1 — 「招呼不升級」與 `upsertRelation` 每事件必寫 — **關閉**

INDEX 已定案 7：記憶側忽略 trivial 造成的 relation；trivial 永不因 relation 升等。HOW：判定用 GM `events` 分類。HANDOFF：招呼＋`upsertRelation` 不升 1。

#### H2 — L1 超 600 與 distill／先截斷互斥 — **關閉**

已定案 8 刪 distill L1。已定案 7／9：升檔用截斷前候選；落盤後池節 ≤ 600。HOW 步驟 5 升 2、步驟 7 截仍在池者。

#### H3 — custom 生成可產出無檔的 `memory_tier: 2` — **關閉**

已定案 5：preprocess 缺欄／1／2 → 0；custom commit 不寫 `l2/`。HANDOFF／Track A：生成 fixture 寫 2 則落盤 0。

#### H4 — HOW 單回合順序未寫「已是 L2 則更新／截斷 `current.json`」 — **關閉**

HOW 步驟 2：trivial 且已是 L2 則不改 current。步驟 6：本回合開始時已是 2 且可寫且非 trivial → 寫 `current.json`。INDEX 已定案 7／9 同文。

#### H5 — L0 遺忘驗收與 HOW 步驟 4「凡非 trivial 即 0→1」互斥 — **關閉**

INDEX 已定案 7：0→1 僅三支，且須可寫（見 14）。HOW 步驟 4 改為「僅當 INDEX 7 三支」，不再凡非 trivial 即升。已定案 8：新建 L0（含 trivial 極短）設 `last_substantive_turn = n`；後續 trivial 不刷新；合法測前置＝trivial 招呼寫 L0、維持 0、十二回合無三支。已定案 14：僅 `scene.present` 不夠改 body。驗收「12 回合無實質命中 L0 消失」可客觀測。殘差見 M19（非阻擋）。

---

### MEDIUM

| ID | 本輪 | 關閉依據（INDEX／HOW／HANDOFF） |
|----|------|----------------------------------|
| M1 | **關閉** | 已定案 7、14：不用 `entity_ids` 升等／改 body。 |
| M2 | **關閉** | 已定案 9；HOW 4→5→7。 |
| M3 | **關閉** | 已定案 7–8；HOW Trivial。 |
| M4 | **關閉** | 已定案 8：`t0001`→`1`；`n>=13` 例。 |
| M5 | **關閉** | Track C／HOW：缺 `current.json` 省略、不 500。 |
| M6 | **關閉** | 已定案 12：`near_cap` 每回合重算。 |
| M7 | **關閉** | HOW 升 2 注入；HANDOFF 檢查清單。 |
| M8 | **關閉** | Track C／HOW：不串台僅 pi contract。 |
| M9 | **關閉** | HOW：pool／L2 為 int；archive 為 `t00xx`。 |
| M10 | **關閉** | Track C／HOW：`buildGmContext`；禁入玩家 HTTP。 |
| M11 | **關閉** | HOW／Track C：缺 pool／dirty 讀成空。 |
| M12 | **關閉** | [`HANDOFF.md`](../HANDOFF.md) 含 paste-ready。 |
| M13 | **關閉** | INDEX 7：0→1 同時寫 pool `tier: 1` 與 entity `memory_tier: 1`。HOW 步驟 4。 |
| M14 | **關閉** | INDEX 7 第三支：有 `npc_lines` 且並非 (b)。HOW 步驟 4 對齊三支。 |
| M15 | **關閉** | HANDOFF starter 已改為 `docs/roadmap/0.4.0/docs/npc-memory.md`。 |
| M16 | **關閉** | HOW 步驟 5：成功則跳過 6。步驟 6：僅「本回合開始時已是 2」。 |
| M17 | **關閉** | HOW 步驟 8：僅更新仍在池的 L0／L1；L2 不寫此欄、不建池 key。步驟 1：禁止為 L2 建池節。 |
| M18 | **非阻擋** | INDEX 15 已寫 dirty 初值；HOW 未複述。實作以 INDEX 15 為準。 |

#### M19 — 「實質命中＝非 trivial」寬於三支／可寫 — **非阻擋**

**問題：** 已定案 8 仍寫實質命中＝非 trivial（定義同 7）。trivial 僅 (a) 或 (b)。僅在場、無 actors、無台詞：依 14 不可改 body，亦非 (a)(b)，故不算 trivial。HOW 步驟 8 對既有 L0／L1「僅實質命中時刷新」若直譯為非 trivial，present-only 會刷新 `last_substantive_turn`，遺忘測若用「在場填充、無招呼」會不刪節。INDEX 7 仍留「池節可不寫或極短」，與 8／驗收「trivial 招呼寫 L0」並列。

**為何不擋開工：** 合法測前置與 HOW 步驟 2 已指定 trivial 極短寫 L0；後續 trivial 不刷新。BAN 測走該路徑即可客觀通過。組裝／升等已禁止露臉不夠。實作以 8 的測前置與步驟 2／8 的 trivial 不刷新為準；勿用 present-only 當遺忘填充。

---

### LOW

| ID | 本輪 | 說明 |
|----|------|------|
| L1 | **關閉** | 已定案 2：非 npc 有值 → parse 失敗。 |
| L2 | **關閉** | 已定案 8：L0 合計 UTF-16 &gt; 4000。 |
| L3 | **關閉** | HOW：摘要 UTF-16 ≤ 80。 |
| L4 | **關閉** | INDEX 5／HOW：兩句是記憶常數。 |
| L5 | **關閉** | HANDOFF 禁區：backlog `{npc_id}.json` 已推翻。 |
| L6 | **非阻擋** | `TRIVIAL_ACTIONS` 含 `serve`／`smalltalk`。酒館開場已是 L2。 |
| L7 | **非阻擋** | 測試路徑必須極短寫 L0；產品句「可不寫」不採用於 BAN。 |
| L8 | **非阻擋** | `npc_memories.tier` 遇 entity／pool 不一致時以何者為準未寫；0→1 同落盤後應一致。 |

---

## 驗收對照（第四輪）

| 驗收句 | 設計層是否可測 | 缺口 |
|--------|----------------|------|
| Default setup：兩人 tier 2、有 current、pool 無這兩 id | 是 | —（M17 已關） |
| 路人 0；僅招呼不升 1；非 trivial 可進池／升 1 | 是 | 升 1 走三支，非凡非 trivial |
| 單節 &gt; 600 → 升 2；半套回滾 | 是 | —（M16 已關） |
| 12 回合無實質命中 L0 消失 | 是（trivial 寫 L0 前置） | M19：測勿用 present-only 填充 |
| GM context 僅 present | 是 | — |
| dirty `touched`；L2 ≥ 640 → `near_cap` | 是 | M18 初值以 INDEX 15 |
| Custom harbor：無 `l2/bartender`；新 npc 非 2 | 是 | — |
| 無 archive；new-game 無 `npc-memory/` | 是 | 實作納 `clearPlaythrough` |
| `bun test`；VERSION／AGENTS | 是 | Track D |

---

## 與現碼抽樣（第四輪）

仍為 0.3.0 接點，不是實作缺失當設計 HIGH。

| 檔 | 觀察 |
|----|------|
| `writer.ts` | `writeFromGm` 先 episodes／`ensureEntity`／每 event `upsertRelation`。記憶管線應接在此函式成功落世界 **之後**。新 npc 無 `memory_tier` → 本版當 0。H1 與現行每 event 必寫 relation **可並存**。 |
| `turn.ts` | `nextTurnId` 在 GM 前；`ctx` 尚無 `npc_memories`；`writeFromGm` 在 parse 之後。HOW 時序：GM **先**讀盤，本回合記憶下一回合才進 context。`TurnResult` 仍無 context（M10）。 |

---

## 修復追蹤表

| ID | 級 | 狀態 | 關閉位置 |
|----|----|------|----------|
| H1 | HIGH | **關閉** | INDEX 7；HOW Trivial／順序；HANDOFF |
| H2 | HIGH | **關閉** | INDEX 7–9；HOW 步驟 5、7 |
| H3 | HIGH | **關閉** | INDEX 5、15；HOW Entity；HANDOFF／Track A |
| H4 | HIGH | **關閉** | INDEX 7、9；HOW 步驟 2、6；HANDOFF Track B |
| H5 | HIGH | **關閉** | INDEX 7、8、14；HOW 步驟 2、4、8、9 |
| M1 | MEDIUM | **關閉** | INDEX 7、14 |
| M2 | MEDIUM | **關閉** | INDEX 9；HOW 4–7 |
| M3 | MEDIUM | **關閉** | INDEX 7–8；HOW Trivial |
| M4 | MEDIUM | **關閉** | INDEX 8 |
| M5 | MEDIUM | **關閉** | Track C；HOW L2 缺檔 |
| M6 | MEDIUM | **關閉** | INDEX 12；HOW dirty-set |
| M7 | MEDIUM | **關閉** | HOW 注入；HANDOFF |
| M8 | MEDIUM | **關閉** | Track C；HOW Prompt |
| M9 | MEDIUM | **關閉** | HOW JSON 形狀 |
| M10 | MEDIUM | **關閉** | Track C；HOW GmContext |
| M11 | MEDIUM | **關閉** | HOW 缺檔；Track C |
| M12 | MEDIUM | **關閉** | `HANDOFF.md` |
| M13 | MEDIUM | **關閉** | INDEX 7；HOW 步驟 4；HANDOFF Track B |
| M14 | MEDIUM | **關閉** | INDEX 7 第三支；HOW 4 |
| M15 | MEDIUM | **關閉** | HANDOFF starter 完整相對路徑 |
| M16 | MEDIUM | **關閉** | HOW 步驟 5 跳過 6；步驟 6 開始時已是 2 |
| M17 | MEDIUM | **關閉** | HOW 步驟 8 僅池內 L0／L1 |
| M18 | MEDIUM | **非阻擋** | INDEX 15 已寫 dirty 初值；HOW 未複述 |
| M19 | MEDIUM | **非阻擋** | 實質命中直譯 vs present-only；遺忘測走 trivial 前置 |
| L1 | LOW | **關閉** | INDEX 2 |
| L2 | LOW | **關閉** | INDEX 8 |
| L3 | LOW | **關閉** | HOW 摘要 80 |
| L4 | LOW | **關閉** | INDEX 5；HOW 常數 |
| L5 | LOW | **關閉** | INDEX；HANDOFF 禁區 |
| L6 | LOW | **非阻擋** | HOW `TRIVIAL_ACTIONS` |
| L7 | LOW | **非阻擋** | BAN 測寫極短 L0；「可不寫」不採用 |
| L8 | LOW | **非阻擋** | 組裝 `tier` 雙源 |

---

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| **初審** | 2026-09-07 | 有未關閉 HIGH（H1–H3）。不建議開工。未改 INDEX／HOW／程式。 |
| **複審** | 2026-09-07 | H1–H3、M1–M12、L1–L5 已關閉。**H4 仍開**。新增 M13–M15。未改 INDEX／HOW／HANDOFF／程式。 |
| **第三輪複審** | 2026-09-07 | H4、M13–M15 已關閉。**H5 仍開**。新增 M16–M18（M18 非阻擋）。未改 INDEX／HOW／HANDOFF／程式。 |
| **第四輪複審** | 2026-09-07 | H5、M16、M17 已關閉。新增 M19、L8（皆非阻擋）。**審查門檻通過。** 未改 INDEX／HOW／HANDOFF／程式。 |

開工門檻：無未關閉 HIGH；同意的 MEDIUM 已修或標非阻擋。現況：**通過**。L6／L7／L8／M18／M19 非阻擋。

---

## 初審歷史題旨（正文保留、縮寫）

初審總評當時為：有未關閉 HIGH，不建議開工。題旨如下（細節以當時全文為準，契約以**現** INDEX 為準）。

- **H1：** trivial「無 relation 變更」與 `upsertRelation` 每事件必寫互斥。
- **H2：** 1→2 用 &gt;600、pool zod ≤600、distill L1 至 ≤600 無判定順序。
- **H3：** 生成器與 commit 未鎖 npc 最多 0、不建 L2。
- **M1–M12：** `entity_ids` 升等；L0 &gt;600；台詞啟發式只在 HOW；遺忘閉區間；缺 L2 檔讀取；`near_cap` 重算；升 2 注入；mock 不讀 contract；turn 欄型別；context 可觀察點；缺檔 fallback；無 HANDOFF。
- **L1–L6：** coerce 用語、字數 vs UTF-16、80 字、記憶常數 vs persona、backlog 路徑、`serve`／`smalltalk`。
