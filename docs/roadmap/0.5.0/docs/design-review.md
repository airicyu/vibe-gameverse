# Design review — 0.5.0 Session compact

- 日期：2026-09-07（Asia/Hong_Kong）
- 輪次：**第 3 輪複審**（初審、第 2 輪複審同日已記於歷審摘要）
- 角色：設計審查（不改 INDEX／HOW／reasoning／HANDOFF／程式；不以本檔當已定案）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收（**現檔**）；HOW：[`session-compact.md`](./session-compact.md)；WHY：[`reasoning.md`](./reasoning.md)；開工：[`../HANDOFF.md`](../HANDOFF.md)
- 構想（非本版契約）：已刪；契約以本版 INDEX 為準。上游 [`../../0.4.0/INDEX.md`](../../0.4.0/INDEX.md)（`shipped`）
- 現行程式抽樣：`program/schema.ts`、`kb.ts`、`npc-memory.ts`、`writer.ts`、`turn.ts`、`gm-pi.ts`、`gm-mock.ts`、`world-generate.ts`、`prompts/gm-contract.md`
- **總評：** 無未關閉 HIGH。第 2 輪仍開的 M11–M13、L5–L7 已寫進 INDEX／HOW／驗收／HANDOFF，契約分叉已消。無新增 HIGH／應修 MEDIUM。審查門檻**通過**，**可以開工**。提案**並非不可行**。

## Findings（本輪）

關閉＝已寫進 INDEX／HOW／HANDOFF；仍開＝契約仍分叉；非阻擋＝記錄即可。

初審與第 2 輪題旨保留；狀態以**現檔**核對。本輪**無**新增 ID。

### HIGH

#### H1 — HOW 把 N 回合否決寫成「N 未滿」—— **關閉**

初審：HOW「N 未滿且 judge 否」與 INDEX 6(b)／WHY 互斥。

現檔：INDEX 已定案 6 寫死 (b) 否決把錨點設為本回合數字；(a)+(b) 同回且否決亦改錨點；僅 (a) 否決不改。HOW 一回合順序第 5 步改為因 (b) 而問且否決才寫 `anchor_turn_n`，並**禁止**「N 未滿且 judge 否」。reasoning「為何 N 回合是問 judge」與「為何 N 否決要落盤錨點」同向。HANDOFF 禁區：N 否決必須寫 `compact-state.json`。

#### H2 — 回想要用「本回合 events／台詞」，但插入點在 GM 之前—— **關閉**

初審：INDEX 13 與 HOW「GM 之前」不可同時成立。

現檔：INDEX 已定案 13 改為 GM 前只掃 `player_text` 詞表與盤上名／id，**不得**用本回合 `events[]`／`npc_lines`，**不得**拿上回合 events 冒充。已定案 14 仍為同一回合餵本回合 GM。HOW 回想節與啟發式同文。reasoning「為何回想不用本回合 events」。HANDOFF：啟發式不含本回合 events。

#### H3 — 已定案 6(a) 的 `scene.present` 進出沒有本版寫入契約—— **關閉**

初審：對局不落盤 `present`，6(a) 句面作廢或偷擴 GM JSON。

現檔：INDEX 已定案 18：對局 GM JSON **必填** `scene`（`SceneState`）；缺欄／非法回合失敗；禁止 `gm_note` 冒充 present；Writer 在 compact 判斷前寫 `scene.json`；比較用本回合開始時快照。已定案 1／非目標寫明本版只為此加 `scene`、不加回想點名欄。HOW 步驟 1–3、5 與「對局 GM JSON `scene`」節。驗收有進出會問、僅 (a) 否決不改錨點。HANDOFF：要加 `scene`。

本輪無新增 HIGH。無「整份提案不可行」。

---

### MEDIUM

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| M1 | **關閉** | INDEX 已定案 18：`kb/runtime/compact-state.json` 的 `anchor_turn_n`；setup／new-game 寫 `0`；`continueRecent` 必須讀此檔。HOW 有檔形與回合差公式。HANDOFF Track A 與禁區。缺檔預設見已關閉的 **M11**。 |
| M2 | **關閉** | INDEX 已定案 12：資格 L2 **另開** `prompts/compact-npc-archive.md`；輸出 archive 欄位＋distill `current.body`；zod 或 distill 後仍 ≥640＝整步失敗。HOW 同；reasoning「為何 distill 仍 ≥640 算整步失敗」。 |
| M3 | **關閉** | INDEX 13 與 HOW：名**或** id；不要求名與 id 同時出現在玩家原文。 |
| M4 | **關閉** | INDEX 12／HOW：仍 ≥640 或 zod 壞＝整步回滾，**禁止**程式再截。HANDOFF：勿用程式截 distill。 |
| M5 | **關閉** | INDEX 已定案 9：兩邊都有則以 `play-sessions/` 為準、不合併、不刪舊。HOW 目錄節同文。 |
| M6 | **關閉** | INDEX 已定案 11：解析不到配對則省略對白、**仍可 compact**。HOW「新 session 尾端 3 回」同句。 |
| M7 | **關閉** | INDEX 已定案 19：非強制用 judge 非空 `title` 否則 summary 模型 title；強制覆蓋／不經 judge。HOW 指向 19。 |
| M8 | **關閉** | INDEX 驗收：Custom 無 L2 仍可封 jsonl、回滾、開場對白、不建酒館 `l2/`。Track B／HANDOFF 完成檢查同。 |
| M9 | **關閉** | INDEX 已定案 6：近 **8** 則 episode，與 `memory_slice` 同一窗口。HOW Judge 節同。 |
| M10 | **關閉** | INDEX 已定案 17／Track D：非 compact 不建 `archive/`，**僅成功 compact** 才建；不必改寫 0.4.0 INDEX 正文。 |
| M11 | **關閉** | 第 2 輪：0.4.0 存檔無 `compact-state.json`，缺檔預設未寫死。現檔 INDEX 已定案 18：ready 後缺檔或 zod 壞 → 視為 `{ anchor_turn_n: 0 }` **並寫回**，**不得**因此 `needs_setup`（含 0.4.0 存檔 continue）；`continueRecent` 必要時補寫。HOW `compact-state.json` 節同句。HANDOFF Track A：缺檔視為 0 並寫回。 |
| M12 | **關閉** | 第 2 輪：未點名改 `prompts/gm-contract.md`。現檔 INDEX 已定案 18／Track A／錨點表：必須改 `gm-contract.md`（及 default 對局會讀到的契約）列出每回合 `scene`；mock 路徑同樣產出合法 `scene`。HANDOFF 讀檔清單含該 prompt；禁區寫明要加 `scene`。現碼契約檔仍無 `scene`＝未實作，不是仍開設計洞。 |
| M13 | **關閉** | 第 2 輪：驗收缺「(b) 滿 N、judge 否 → 寫錨點」。現檔驗收：滿 `max_turns_without_compact` 且 judge 否（或注入 `should_compact: false`）→ 不封；`anchor_turn_n` 寫成本回合數字；其後未再滿 N、無人進出、未過強制線 → 不問 judge。 |

### LOW

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| L1 | **關閉** | INDEX 已定案 11：`summary.body` UTF-16 **1–800**，空字串非法。HOW `summary.json` 同。 |
| L2 | **關閉** | INDEX 已定案 8 點名 `VIBE_GAMEVERSE_CONFIG`。 |
| L3 | **關閉** | INDEX 已定案 9 例 `generate-sessions`；HOW 生成 job；錨點 `world-generate.ts`。 |
| L4 | **關閉** | INDEX 已定案 12：`touched` **清空再把本回合剛寫過的 id 寫回**；無「可留或清空」猶豫句。 |
| L5 | **關閉** | 第 2 輪：驗收寫死「最多 3 回」vs yaml 1–10。現檔驗收：開場尾端最多 `recent_turns_to_keep` 回（倉庫預設 3）。 |
| L6 | **關閉** | 第 2 輪：HANDOFF 錨點未列 `world-generate.ts`。現檔 HANDOFF 讀檔順序第 5 點已列。 |
| L7 | **關閉** | 第 2 輪：INDEX 7「上一回」vs HOW 本回合寫入後最後一則。現檔 INDEX 已定案 7：本回合 GM 已寫入活 jsonl 之後（HOW 步驟 4）讀**最後一則** assistant；比較的是**剛結束這一回**，不是再上一 HTTP 回合。HOW 強制線節同向。 |

## 驗收對照

| 驗收句 | 設計層是否可測 | 缺口 |
|--------|----------------|------|
| 滿 N 且 judge 說封（或注入）→ 新 jsonl、`sa_00x`、L2 archive、current 變短、`since_session_archive` 非 null | 可測 | 無設計缺口 |
| present 無人進出、未滿 N、未過強制線 → 不問、不封 | 可測 | 比較須用步驟 1 快照不是寫後的 `scene.json`（HOW 已寫） |
| GM 使 present 有進出、未滿 N、未過強制線 → **會**問；judge 否且僅 (a) → 不改錨點、不封 | 可測 | 須注入／mock 產出與快照不同的 `present` |
| Custom 無 L2：仍可封、回滾、開場對白；不建酒館 `l2/` | 可測 | M8 已關閉 |
| 滿 N 且 judge 否 → 不封、錨點＝本回合；其後未滿 N 不問 | 可測 | **M13 已關閉** |
| 僅改 `gm_note`（present 不變）→ 不問 | 可測 | 與 6(a) 集合比較一致 |
| 強制線 → 不經 judge 否決；`truncated: true` | 可測 | **L7 已關閉**；fixture 對齊 jsonl `usage` |
| 寫入中途失敗 → 活 jsonl、無半套、同一活 session | 可測 | HOW scratch；半套含 index 半筆、NPC `archive/` |
| L2 可長過 800；≥640 進 `near_cap` 不因此封 | 可測 | 廢 zod／Writer 截斷；M4 已關閉 |
| 開機 `pi-sessions`→`play-sessions` continue；新遊戲兩目錄皆無 | 可測 | **M11 已關閉**（缺 `compact-state` 視為 0 並寫回）；雙目錄不合併在 INDEX 9 |
| 缺 `config.yaml` 或鍵型錯誤 → 啟動失敗 | 可測 | L2 已關閉 |
| 無啟發式 → 無封存原文；命中 → ≤2 份、每份 ≤3 段 ≤120 | 可測 | H2／M3 已關閉 |
| 新 session 開場尾端最多 yaml 值（預設 3）；玩家 HTTP 無摘錄 | 可測 | M6／**L5 已關閉** |
| mock 滿 20 不自動 `should_compact: true`（除非注入） | 可測 | 與 INDEX 15／HOW 一致 |
| `bun test` 全綠；VERSION／AGENTS | 可測 | M10 已關閉（測規改寫屬實作 Track D） |

## 與現碼抽樣

現碼未做本版 **≠** 設計 HIGH。下列是**提案將推翻的現行行為**（預期），或實作必須改掉的點。

| 現碼 | 與 0.5.0 提案 |
|------|----------------|
| `gm-pi.ts` `sessionDir`＝`…/pi-sessions`；`kb.clearPlaythrough` 只刪該目錄 | 改 `play-sessions/`；另刪 `session-archive/`、`compact-scratch/`、`compact-state.json` |
| `world-generate.ts` job 內 `pi-sessions` | INDEX 9：改如 `generate-sessions` |
| `L2CurrentSchema.body.max(800)`；`npc-memory.ts` `L2_BODY_MAX`＋`clipTail` | 廢硬截；`near_cap` 640 保留；compact distill **不得** `clipTail` 冒充成功 |
| `saveDirtySet`／Writer 組 dirty **寫死** `since_session_archive: null` | 日常保留舊值；成功 compact 才寫 `archive_id` |
| `runTurn`：組 context → GM → `writeFromGm`；**無** compact／回想；Writer **不**更新 `scene.json` | HOW：回想在 GM 前；Writer 寫 `scene.json` 後 compact |
| `GmOutputSchema` **無** `scene`；`prompts/gm-contract.md` 鍵清單無 `scene`（仍寫 EXACTLY 現有鍵） | 已定案 18／**M12 已關閉**：實作必須改契約檔。現碼如此＝未實作 |
| 無根目錄 `config.yaml`、無讀檔啟動檢查 | 本版新建；缺檔啟動失敗 |
| 0.4.0 測：不建立 `npc-memory/**/archive/**` | 見已關閉的 M10 |
| `gm-mock.ts` 截 `gm_note` 800，不涉及 jsonl 封存 | 與「mock 不自動封」相容；HOW 要求 mock **必須**產出合法 `scene` |
| NPC archive zod 已在 `schema.ts`（0.4.0） | 格式仍認 0.4.0 HOW；本版才落盤 |
| 無 `compact-state.json` | 本版新建；0.4.0 continue 缺檔見已關閉的 **M11** |

未發現「現碼行為與提案原則互斥到 POC 做不了」的引擎限制。強制線讀 `usage.input` 須對齊現檔欄位，HOW 已允許 fixture 對齊。

## 修復追蹤表

| ID | 級 | 狀態 | 關閉位置（INDEX 條／HOW 節） |
|----|----|------|------------------------------|
| H1 | HIGH | 關閉 | INDEX 已定案 6；(a)+(b) 同句；HOW 一回合順序 5；HANDOFF 禁區 |
| H2 | HIGH | 關閉 | INDEX 已定案 13–14；HOW 回想／啟發式；reasoning 回想節；HANDOFF |
| H3 | HIGH | 關閉 | INDEX 已定案 18、1、非目標；HOW 步驟 1–3 與 `scene` 節；驗收進出句；HANDOFF |
| M1 | MEDIUM | 關閉 | INDEX 18；HOW `compact-state.json`；HANDOFF Track A（細節見 M11） |
| M2 | MEDIUM | 關閉 | INDEX 12；HOW Judge／summary／NPC archive |
| M3 | MEDIUM | 關閉 | INDEX 13；HOW 啟發式 |
| M4 | MEDIUM | 關閉 | INDEX 12；HOW distill；HANDOFF |
| M5 | MEDIUM | 關閉 | INDEX 9；HOW 目錄／開機遷移 |
| M6 | MEDIUM | 關閉 | INDEX 11；HOW 尾端 3 回 |
| M7 | MEDIUM | 關閉 | INDEX 19；HOW 指向 19 |
| M8 | MEDIUM | 關閉 | INDEX 驗收 Custom 句；Track B；HANDOFF 完成檢查 |
| M9 | MEDIUM | 關閉 | INDEX 6；HOW Judge 輸入 |
| M10 | MEDIUM | 關閉 | INDEX 17；Track D |
| M11 | MEDIUM | 關閉 | INDEX 18 缺檔視為 0 並寫回；HOW `compact-state.json`；HANDOFF Track A |
| M12 | MEDIUM | 關閉 | INDEX 18／Track A／錨點 `prompts/gm-contract.md`；HANDOFF 讀檔清單 |
| M13 | MEDIUM | 關閉 | INDEX 驗收「滿 N 且 judge 否」句 |
| L1 | LOW | 關閉 | INDEX 11；HOW `summary.json` |
| L2 | LOW | 關閉 | INDEX 8 |
| L3 | LOW | 關閉 | INDEX 9；HOW；錨點 world-generate |
| L4 | LOW | 關閉 | INDEX 12 |
| L5 | LOW | 關閉 | INDEX 驗收 `recent_turns_to_keep`（倉庫預設 3） |
| L6 | LOW | 關閉 | HANDOFF 讀檔／錨點含 `world-generate.ts` |
| L7 | LOW | 關閉 | INDEX 已定案 7 對齊 HOW 步驟 4 |

上輪標關閉：H1–H3、M1–M10、L1–L4。本輪核對：第 2 輪仍開的 M11–M13、L5–L7 **均已寫進現 INDEX／HOW／HANDOFF（或驗收）**。本輪無新增 ID。

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-09-07 | 有未關 HIGH H1–H3；門檻未過；不建議開工；提案並非不可行 |
| 第 2 輪複審 | 2026-09-07 | H1–H3 與初審 M1–M10、L1–L4 關閉；無未關 HIGH；門檻通過，可開工；應修 M11–M13；提案並非不可行 |
| 第 3 輪複審 | 2026-09-07 | M11–M13、L5–L7 關閉；無未關 HIGH、無應修仍開 MEDIUM；審查門檻通過，可開工；提案並非不可行 |
