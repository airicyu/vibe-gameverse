# Design review — 0.8.0 角色記憶：情景摘要與定位

- 日期：2026-09-09（Asia/Hong_Kong）
- 輪次：**第 2 輪複審**（累加；初審同日）
- 角色：設計審查（不改 INDEX／HOW／reasoning／HANDOFF／程式；不以本檔當已定案）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收（**現稿**）；[`memory-situations.md`](./memory-situations.md)（HOW）；[`reasoning.md`](./reasoning.md)（WHY）；[`../HANDOFF.md`](../HANDOFF.md)
- 現行程式抽樣：`program/recall.ts`、`program/schema.ts`、`program/compact.ts`、`prompts/compact-npc-archive.md`、`program/writer.ts`、`program/npc-memory.ts`（現碼仍為 0.5／0.6 金句＋在場選槽；**≠** 設計 HIGH）
- **總評：** 無未關閉 HIGH；同意的 MEDIUM（M1–M8）皆已寫進 INDEX／HOW／HANDOFF。**審查門檻通過。** 非整案不可行。HANDOFF 已存在；複審通過後即可依 HANDOFF 開工（實作另開 session）。

## Findings（第 2 輪複審）

關閉＝已寫進 INDEX／HOW／HANDOFF；仍開＝契約仍分叉；非阻擋＝記錄即可。本輪**無新增 HIGH／MEDIUM**；僅核對舊 ID 並標 L3 非阻擋。

### HIGH

#### H1 — 掃檔閘門與「點名離場即可召」未鎖死 — **關閉**

**初審問題：** （i）（ii）與「點名離場可召」衝突；「灰怎麼了」主路徑可能不掃。

**收斂核對（方案 A）：**

| 位置 | 證據 |
|------|------|
| INDEX 已定案 6 | （iii）新增：`memory_tier === 2` 名／id＋已有 archive index → 即掃並可打開；不要求 `present`、不要求缺席近 8 episode |
| INDEX 驗收 4 | 「僅閘門（iii）」點名已離場 L2（有 archive）可召，即使名在近 8 episode、無詞表 |
| HOW「啟發式掃檔閘門」 | （i）（ii）（iii）全文＋詞表；未命中不掃 |
| reasoning「為何離場仍可召」 | 對齊（iii）與產品例 |
| HANDOFF | 產品摘要／Track B／完成檢查皆寫閘門（iii） |

契約自洽；驗收第 4 條設計層可測。

### MEDIUM

| ID | 本輪狀態 | 關閉位置／依據 |
|----|----------|----------------|
| M1 | **關閉** | INDEX 已定案 6「未點名任一 L2 → 最多 2 份 session；不得開 NPC」；HOW「打開優先」§3 |
| M2 | **關閉** | INDEX 已定案 5／驗收 2（無 `sa_*` 省略 sa 段）；HOW 有／無 `session_archive_id` 兩種 locator 範例 |
| M3 | **關閉** | INDEX 已定案 4：index 必 title＋summary；刪 `quote_count`；保留 `body_chars`＝summary UTF-16 length；HOW index 表同文 |
| M4 | **關閉** | INDEX 已定案 6：多名 L2 → `player_text` **最先出現**名／id；HOW「打開優先」§1 |
| M5 | **關閉** | HOW 貼 0.5.0 同詞表＋（i）（ii）（iii）自足重述 |
| M6 | **關閉** | INDEX 已定案 8＋驗收 6＋HOW Writer：注入 `npc_lines[].text` 不得原樣整段進 `current.body` |
| M7 | **關閉** | INDEX 已定案 6＋HOW：Session 候選＝本回合已載入並打分的 session hit 非空（含 score＝0） |
| M8 | **關閉** | [`HANDOFF.md`](../HANDOFF.md) 已存在（讀檔順序／Track／禁區／paste-ready）。INDEX：假設 worlds／pointer 可玩、**不**要求 0.7.0 先 `shipped`；錨點為 active world runtime |

### LOW

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| L1 | **關閉** | INDEX 已定案 3：新寫入**省略** `salient_quotes`；舊檔 strip／忽略；HOW「不得寫入該鍵」；驗收 1 對齊「無該鍵」 |
| L2 | **關閉** | INDEX 已定案 5＋HOW：欄名實作自決（`archive_excerpts` 或 `past_index`）；對玩家仍不輸出 |
| L3 | **非阻擋** | INDEX 文件地圖仍未列本審查檔（預期；規劃可選鏈入）。不擋開工 |
| L4 | **非阻擋**（本輪新增） | 「與上一版對照」離場列僅寫「點名即可打開」，未複述 `memory_tier === 2`＋有 archive；**已定案 6／HOW 為準**，對照表不另成契約。可選收斂時補半句 |

## 驗收對照（對照現 INDEX）

| 驗收句 | 設計層是否可測 | 缺口 |
|--------|----------------|------|
| 新 NPC compact 落盤無 `salient_quotes` 鍵；GM context 不含 quote 正文 | 可 | 無（L1 已關） |
| 回想命中 NPC：summary＋`t00xx` locator（有／無 `sa_*`）；不含 quote | 可 | 無（M2 已關） |
| 回想命中 session：`summary.json` body；不含 jsonl 剪句 | 可 | 無 |
| 僅閘門（iii）：點名已離場 L2（有 archive）可召（名可在近 8、無詞表） | 可 | 無（H1 已關） |
| Compact 假 quotes／錯 speaker 不再致該 id 失敗 | 可 | 無 |
| Writer：注入台詞不得原樣整段進 `current.body` | 可 | 無（M6 已關） |
| `bun test` 全綠；VERSION＝0.8.0 | 出貨時 | 屬實作／出貨 |

## 與現碼抽樣

現碼未做本版 ≠ 設計 HIGH。與提案互斥的現行行為（實作 Track 應對掉；複審未變）：

| 錨點 | 現行 | 0.8.0 提案 |
|------|------|------------|
| `prompts/compact-npc-archive.md` | 必要 `salient_quotes` 0–3 | 禁名句；情景 summary |
| `schema.ts` archive／model | `salient_quotes` 必填＋speaker refine | 新寫入無該欄；speaker 校驗刪 |
| `schema.ts` archive index | 有 `quote_count`、無 `summary` | index 帶 summary；刪 `quote_count`；`body_chars`＝summary 長 |
| `compact.ts` | 寫入 quotes | 輸出 title／summary／`distilled_body` |
| `recall.ts` 閘門／選槽 | （i）（ii）；僅**在場**點名 L2 | （iii）；不要求 `present`；選槽見 HOW |
| `recall.ts` 打開 | `excerptJsonl`／quotes 當 excerpts | 零原文；只 summary＋locator |
| `writer`／`npc-memory` digest | 已偏 event summary | 測規禁 verbatim 台詞進 body |

## 修復追蹤表

| ID | 級 | 狀態 | 關閉位置（INDEX 條／HOW 節） |
|----|----|------|------------------------------|
| H1 | HIGH | **關閉** | INDEX 已定案 6（iii）＋驗收 4；HOW 啟發式；reasoning 離場節；HANDOFF |
| M1 | MEDIUM | **關閉** | INDEX 已定案 6；HOW 打開優先 §3 |
| M2 | MEDIUM | **關閉** | INDEX 已定案 5／驗收 2；HOW locator 兩範例 |
| M3 | MEDIUM | **關閉** | INDEX 已定案 4；HOW index 表 |
| M4 | MEDIUM | **關閉** | INDEX 已定案 6；HOW 打開優先 §1 |
| M5 | MEDIUM | **關閉** | HOW 詞表＋（i）（ii）（iii） |
| M6 | MEDIUM | **關閉** | INDEX 已定案 8／驗收 6；HOW Writer |
| M7 | MEDIUM | **關閉** | INDEX 已定案 6；HOW Session 候選 |
| M8 | MEDIUM | **關閉** | HANDOFF.md；INDEX 上游路徑句 |
| L1 | LOW | **關閉** | INDEX 已定案 3；HOW 新寫入；驗收 1 |
| L2 | LOW | **關閉** | INDEX 已定案 5；HOW 欄名自決 |
| L3 | LOW | **非阻擋** | —（文件地圖未鏈本檔） |
| L4 | LOW | **非阻擋** | —（對照表措辭可選補） |

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-09-09 | 方向可行；**H1 阻擋開工**；M1–M8／L1–L2 應收斂寫檔；無 HANDOFF。非整案不可行。審查門檻未通過。 |
| 第 2 輪複審 | 2026-09-09 | 核對現 INDEX／HOW／reasoning／HANDOFF：H1＝方案 A 已關；M1–M8、L1–L2 已關；L3／L4 非阻擋。無新增阻擋項。**審查門檻通過。** |

---

## 附：初審原文（保留，狀態以修復追蹤表為準）

<details>
<summary>初審 Findings 全文（2026-09-09）</summary>

### HIGH（初審時仍開）

H1 — 掃檔閘門與「點名離場即可召」未鎖死，與驗收／產品例衝突。建議方案 A（新增閘門 iii）或 B（收窄驗收）。（第 2 輪已採 A 關閉。）

### MEDIUM（初審時皆仍開）

M1 未點名打開規則；M2 無 sa locator；M3 index quote_count／body_chars；M4 多名取誰；M5 詞表／（i）（ii）自足；M6 Writer 客觀測規；M7 Session 候選定義；M8 HANDOFF／上游 0.7.0。

### LOW（初審）

L1 salient_quotes 雙軌；L2 欄名自決；L3 文件地圖未列本檔。

</details>
