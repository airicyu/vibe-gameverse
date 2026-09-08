# Implementation review — 0.8.0 角色記憶：情景摘要與定位

- 日期：2026-09-09（Asia/Hong_Kong）
- 輪次：**初審**
- 角色：實作審查（不改程式；只認檔案／diff／測試）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收；HOW [`memory-situations.md`](./memory-situations.md)；WHY [`reasoning.md`](./reasoning.md)；[`../HANDOFF.md`](../HANDOFF.md)
- 抽樣錨點：`program/recall.ts`、`program/schema.ts`、`program/compact.ts`、`prompts/compact-npc-archive.md`、`program/npc-memory.ts`（`digestFor`）、`program/writer.ts` 路徑；測：`program/compact.test.ts`、`program/npc-memory.test.ts`；出貨文件：`VERSION.md`、`changelog.md`、`AGENTS.md`、`docs/roadmap/backlog/`
- **總評：** 無未關閉 HIGH；INDEX 七條驗收皆通過；`bun test` 全綠（93 pass／0 fail）。實作層可出貨；INDEX 仍標 `in progress`（待使用者同意後改 `shipped`／commit）不構成本審阻擋。

## Findings（本輪）

### HIGH

（無）

### MEDIUM

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| M1 | **關閉** | `qualified L2 leave archives that npc only…` 已對落盤 `na_ash_001.json` assert 無 `salient_quotes` 且有 `summary`。 |

### LOW

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| L1 | **仍開（非阻擋）** | `gatherRecallSnippets` 每回合先 `loadIndexHits`（讀 session／各 L2 `archive/index.json`，session 還試讀 `summary.json`）再判閘門；未命中仍 return `[]`、不餵 past。與 HOW「未命中 → 不掃」字面略寬；對齊「閘門需知 archive 是否存在／（ii）需 title＋summary」可接受。長局可再懶載。 |
| L2 | **記錄** | `NpcArchiveQuoteSchema` 仍 export 並標 `@deprecated`；不寫入、不進 GM。可留可刪，非契約缺口。 |
| L3 | **記錄** | INDEX／changelog 狀態維持 `in progress`／待同意出貨；與 HANDOFF「`shipped` 僅使用者同意後」一致。 |

## 驗收對照

| INDEX 驗收句 | 通過／失敗 | 證據（測／檔） |
|--------------|------------|----------------|
| 新 NPC compact 落盤**無** `salient_quotes` 鍵；GM context 不含 quote 正文 | **通過** | `draftNpcWrite` 只 parse／寫 title＋summary＋locator 欄（`compact.ts`）；`parseNpcArchiveModel` 丟棄多餘 quotes；prompt 禁名句。測：`npc archive model ignores…`、`archive schemas: new writes omit quotes`；回想 format 僅 summary＋locator |
| 回想命中 NPC：summary＋`t00xx` locator（有／無 `sa_*`）；不含 quote | **通過** | `openDetails`／`formatRecallForGm`（`recall.ts`）；閘門 iii 測含「未交的字條」與 locator 回合；無 quote 列表欄 |
| 回想命中 session：`summary.json` body；不含 jsonl 剪句 | **通過** | `recall: past hint opens session summary only; no jsonl excerpts` — 含 summary body、含 `t0001`、**不含** jsonl 句「那時燈還亮著」；程式無 `excerptJsonl` |
| 僅閘門（iii）：點名已離場／不在 `present` 的 L2（有 archive）可召（名可在近 8、無詞表） | **通過** | `recall gate iii: named absent L2 still opens archive summary` — 「灰怎麼了」、`present` 無 ash、episode 含「灰」、無詞表命中仍打開 ash archive |
| Compact 假 quotes／錯 speaker 不再致該 id 失敗 | **通過** | model／entry schema 無 speaker refine；多餘 `salient_quotes` 忽略仍 parse 成功（同上測） |
| Writer：注入台詞不得原樣整段進 `current.body` | **通過** | `digestFor` 只用 event `summary`（`npc-memory.ts`）；`writer does not copy npc_lines text verbatim into L2 current.body` |
| `bun test` 全綠；VERSION＝`0.8.0` | **通過** | 見下節；`VERSION.md`＝`0.8.0`；`AGENTS.md`／`changelog.md` 已同步；`docs/roadmap/backlog/memory-situations.md` **已刪**；backlog INDEX 列為已出貨移除 |

## 測試結果

- 指令：`bun test`（工作目錄根；`program/test-runtime-env.ts` 設隔離 `VIBE_GAMEVERSE_KB_WORLDS` tmp parent；未 `rm` live `kb/runtime`／`kb/worlds`）
- 結果：**93 pass，0 fail**，308 `expect()`；6 files；約 1.8–1.9s
- 與 0.8.0 直接相關之測均綠：archive schema／quotes strip、session 回想無 jsonl、閘門 iii、Writer verbatim、compact 離場寫 archive 等

## 出貨文件核對（Track C）

| 項 | 狀態 |
|----|------|
| `VERSION.md` = `0.8.0` | 是 |
| `changelog.md` 0.8.0 節 | 是 |
| `AGENTS.md` 現行 0.8.0＋summary／locator／無 quotes／閘門點名 | 是 |
| backlog `memory-situations.md` 已刪；backlog INDEX 已註已出貨移除 | 是 |

## 修復追蹤

| ID | 級 | 狀態 | 建議關閉方式 |
|----|----|------|--------------|
| M1 | M | **關閉** | `qualified L2 leave…` 讀 `na_ash_001.json` 並 `expect("salient_quotes" in ashEntry).toBe(false)`；另 assert 有 `summary` |
| L1 | L | 仍開 | 可選：閘門 i 先短路；僅 (ii)(iii) 或命中後再 load index |
| L2 | L | 記錄 | 可刪 deprecated quote schema |
| L3 | L | 記錄 | 使用者同意後 INDEX → `shipped` |

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-09-09 | 無未關 HIGH；驗收全過；`bun test` 全綠；可出貨（待同意改 shipped） |
| 修復後自核 | 2026-09-09 | M1 關閉（離場落盤＋inject hook 落盤皆 assert 無 `salient_quotes`）；L1–L3 非阻擋；93 pass／0 fail |
