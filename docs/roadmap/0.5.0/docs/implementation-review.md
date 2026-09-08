# Implementation review — 0.5.0 Session compact

- 日期：2026-09-07（Asia/Hong_Kong）
- 輪次：**第 2 輪複審**（初審同日）
- 角色：實作審查（不改程式、不加功能、不 commit）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收（現檔）；HOW：[`session-compact.md`](./session-compact.md)；HANDOFF：[`../HANDOFF.md`](../HANDOFF.md)
- 抽樣：`program/compact.ts`、`compact.test.ts`、`recall.ts`、`config.ts`、`schema.ts`、`kb.ts`、`npc-memory.ts`、`writer.ts`、`turn.ts`、`gm-pi.ts`、`gm-mock.ts`、`world-generate.ts`、`server.ts`、`prompts/gm-contract.md`、根目錄 `config.yaml`、`VERSION.md`、`AGENTS.md`
- **總評：** 初審 HIGH（H1、H2）已關，無未關閉 HIGH；剩餘為測規與回想掃描缺口。`bun test` 全綠（61 pass／0 fail）。INDEX 仍 `in progress`，未達出貨勾選。

## Findings（累加；ID 自初審穩定，後輪勿重編號）

關閉＝已對齊 INDEX 且有證據；仍開＝實作／測規與契約分叉。

### HIGH

#### H1 — 回滾刪光該角既有 `l2/{id}/archive/`—— **已關**（第 2 輪）

初審：`rollback` 對 `l2/{id}/archive` recursive `rm`。現碼 `rollbackApply` 只刪本拍 `{npc_archive_id}.json`，有備份則還原 `index.json`／`current.json`。測 `fail after apply restores jsonl and keeps prior npc archive files`：保留 `na_bartender_001`、不留 `na_bartender_002`。

#### H2 — 封存已套用後開新 session／開場失敗只回 `compacted: false`—— **已關**（第 2 輪）

初審：`applied` 後 dispose／create／opening 丟錯不回滾。現碼將刪活 jsonl、dispose、create、`promptPlayOpening` 與封存寫入同在內層 `try`；失敗呼叫 `rollbackApply` 再 throw，外層回 `{ compacted: false }`。測 `failAfterApply`：活 jsonl 恢復、本拍 NPC 檔撤銷、`compacted === false`。殘餘見 **M9**（hook 在 dispose 之前；行程內新 session 不回滾）。

### MEDIUM

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| M1 | **已關** | `ensureRuntime` 在 ready 時呼叫 `loadCompactState`；`openOrContinuePlaySession` 同樣先讀／補寫。0.4.0 存檔 continue 開機路徑會落盤錨點。 |
| M2 | **已關** | `gatherRecallSnippets` 的 `entityInArchive`：玩家原文含名／id、近 8 則 episode 不含、且 `indexHits` 的 title／summary 含該名或 id 才算 (ii)。 |
| M3 | **已關** | `openDetails` 才讀入選（≤2）的 `session.jsonl`／NPC entry；不再對全部 `sa_*` 預先讀 jsonl。殘餘「未命中仍掃 index」見 **M8**。 |
| M4 | **仍開** | 驗收「開機舊 `pi-sessions/` 改名後可 continue」：測只斷言 `rename` 與雙目錄不合併，未走 `SessionManager.continueRecent`。 |
| M5 | **仍開** | 驗收 Custom「回滾測」：`custom without L2 still archives` 只測成功封存；回滾仍僅 default 的 `failAfterScratch`／`failAfterApply`。 |
| M6 | **仍開** | 驗收「新 session 開場含尾端最多 `recent_turns_to_keep` 回」：僅 `formatOpeningMessage` 單元斷言；mock `promptPlayOpening` 直接 return，無活 session 開場寫入證據。 |
| M7 | **已關** | `runTurn HTTP result has no npc_memories key` 與 custom harbor 測均斷言 `"archive_excerpts" in result === false`。 |
| M8 | **仍開**（第 2 輪新增） | INDEX 13：預設不掃、啟發式才掃 index。`gatherRecallSnippets` **一律**先 `loadIndexHits`（讀全部 session `summary.json` 與各 L2 archive `index.json`），再判斷 (i)／(ii)。idle「再來一杯」測只斷言 excerpts 長度 0，覆蓋不到「未命中不讀 index」。 |
| M9 | **仍開**（第 2 輪新增） | H2 磁碟回滾已關；`failAfterApply` 在 `disposePlaySession` **之前**。pi 路徑若 `createPlaySession`／`promptPlayOpening` 失敗：磁碟回滾，但行程內可能已持有新 session，且 mock 看不到此縫。 |
| M10 | **仍開**（第 2 輪新增） | INDEX 13(ii)／HOW：名／id 可出現在 archive **summary**。NPC 分支 `loadIndexHits` 只用 index 的 `title` 當 summary，不讀 `na_*.json` 的 `summary` 欄；名只在 entry summary、不在 title 時 (ii) 漏召（契約允許寧可漏召，但與「掃 title／summary」不完全同義）。 |

### LOW

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| L1 | **仍開** | 強制線位元組後備（無 `usage.input` 時 `force_after_jsonl_bytes`）無單測；現測只打 `usage.input === 100000`。 |
| L2 | **仍開** | 缺 yaml 有子程序測；鍵型錯誤（非正整數等）無獨立測。`loadAppConfigFromDisk` 的 zod `safeParse` 失敗會 throw。 |
| L3 | **仍開** | `package.json` `"version"` 仍為 `0.2.0`；產品字串以 `VERSION.md`＝`0.5.0` 為準。 |
| L4 | **仍開** | INDEX 狀態仍 `in progress`、驗收 checkbox 未勾；`changelog.md`／`VERSION.md`／`AGENTS.md` 已按出貨文案寫 0.5.0。Track D 出貨才改 `shipped`。 |
| L5 | **仍開** | 根目錄 `config.yaml` 在 working tree 為未追蹤檔；INDEX 已定案 8 寫可 git。內容四鍵與預設值正確。`.gitignore` 未排除該檔。 |
| L6 | **仍開** | 套用失敗若已 `mkdir` `session-archive/`，回滾在 `previousIndex.entries.length === 0` 時刪 `index.json`，可能留下空目錄。 |
| L7 | **仍開** | `JSON.stringify(ctx)` 把整份 context（含回想）送進 GM；與「摘錄進 GM、不進玩家 HTTP」相容。無測鎖定開場訊息不進玩家氣泡。 |

## 第 2 輪複審摘記

對照現碼與 working tree（`program/compact.ts`、`recall.ts`、`kb.ts`、`gm-pi.ts`、`compact.test.ts` 等；未 commit）。未對 live `kb/runtime` 執行 `rm`。

- Writer／zod 仍不截 L2 800；`prompts/gm-contract.md` 每回合必列 `scene`；活目錄 `play-sessions/`；生成 job 用 `generate-sessions`。
- 回想命中後打開 jsonl／entry 已限 ≤2；HTTP 無 `archive_excerpts` 欄有測。
- 未跑瀏覽器／真人 pi 長局。

## 驗收對照

| INDEX 驗收句 | 通過／失敗 | 證據（測／檔） |
|--------------|------------|----------------|
| 滿 N 且 judge 說封（或注入）→ 新 jsonl、`sa_00x`、L2 archive、current 變短、`since` 非 null | **部分通過** | 注入封存：`sa_001` jsonl＋summary、bartender archive、current＜640、`since=sa_001`；舊 `live.jsonl` 消失；mock 不建新 jsonl（`createPlaySession` no-op） |
| present 無人進出、未滿 N、未過強制線 → 不問、不封 | **通過** | `present unchanged and under N`：`judged===0`、無 `sa_001` |
| present 有進出、未滿 N、未過強制線 → 會問；僅 (a) 否決不改錨點 | **通過** | `present delta asks judge; reject (a)-only`：`judged===1`、`anchor_turn_n===0` |
| Custom 無 L2：仍可封、回滾、開場對白；不建酒館 `l2/` | **部分通過** | 成功封＋不建 `l2/bartender` 有測；回滾／開場對白見 **M5／M6** |
| 滿 N 且 judge 否 → 不封、錨點＝本回合；其後未滿 N 不問 | **通過** | `N due and judge false`：錨點 20，t0021 不再問 |
| 僅改 `gm_note`（present 不變）→ 不問 | **通過** | 與「未滿 N 不問」同一測 |
| 強制線 → 不經 judge 否決即封；`truncated: true` | **通過** | `force line skips judge veto`：`judged===0`、title 含「非自然」 |
| compact 寫入中途失敗 → 活 jsonl 仍在、無半套、同一活 session | **部分通過** | scratch 前與套用後磁碟回滾有測（含既有 `na_*`）；行程內新 session 見 **M9** |
| L2 current 可長過 800；≥640 進 `near_cap` 不因此封 | **通過** | Writer 850 字；`near_cap` 含 bartender、無 `sa_001` |
| 開機 `pi-sessions`→`play-sessions` continue；新遊戲兩目錄皆無 | **部分通過** | 改名／雙目錄／new-game 刪目錄有測；continue 見 **M4** |
| 缺 `config.yaml` 或鍵型錯誤 → 啟動失敗 | **部分通過** | 缺檔子程序非 0；鍵型見 **L2**。`server.ts` 開機 `getAppConfig()` |
| 回想：無啟發式無原文；命中最多 2 份、每份最多 3 段 ≤120 | **部分通過** | idle 長度 0；命中 ≤2、excerpts ≤3；未斷言每段 ≤120；未命中仍掃 index 見 **M8** |
| 新 session 開場尾端最多 `recent_turns_to_keep`；HTTP 無摘錄 | **部分通過** | formatter 含「第三回」；HTTP 無摘錄見 **M7 已關**；活開場見 **M6** |
| mock 滿 20 不自動 `should_compact: true` | **通過** | `runTurn` 二十回無 `sa_001` |
| `bun test` 全綠；VERSION＝0.5.0；AGENTS 寫 play-sessions、compact、不截 800 | **測試通過／出貨文件已寫** | INDEX 仍 `in progress`（**L4**） |

## 測試結果

- 指令：`bun test`（工作目錄倉庫根；未對 live `kb/runtime` 執行 `rm`）
- 第 2 輪：**61 pass／0 fail**，4 檔，202 `expect()`，約 1.1s（初審為 60 pass／196 expect）
- 隔離：各 `*.test.ts` 首行 `import "./test-runtime-env.ts"`；`VIBE_GAMEVERSE_KB_RUNTIME`＋`VIBE_GAMEVERSE_CONFIG` 指向臨時目錄。測內 `rm(kbRuntimeDir)` 只打臨時目錄。
- 未跑瀏覽器／真人 pi 長局。

## 修復追蹤

| ID | 級 | 狀態 | 關閉條件（實作） |
|----|----|------|------------------|
| H1 | H | **已關** | 回滾只刪本拍新建 NPC archive／index 增量 |
| H2 | H | **已關** | 套用後失敗回滾磁碟且不回報已封為成功 |
| M1 | M | **已關** | ready 開機讀並補寫 `compact-state.json` |
| M2 | M | **已關** | (ii) 核對 archive title／summary |
| M3 | M | **已關** | 只對入選 ≤2 份打開 jsonl |
| M4 | M | 仍開 | 改名後 continue 有測 |
| M5 | M | 仍開 | Custom 回滾有測 |
| M6 | M | 仍開 | 開場尾對白有非純 formatter 證據 |
| M7 | M | **已關** | HTTP 回應斷言無 archive 摘錄 |
| M8 | M | 仍開 | 無 (i)／(ii) 候選時不讀 archive index／summary 檔 |
| M9 | M | 仍開 | 開場／create 失敗後行程 session 與活 jsonl 一致，或測覆蓋 dispose 之後 |
| M10 | M | 仍開 | NPC (ii) 能對到 entry `summary`（或書面接受只掃 index title） |
| L1–L7 | L | 仍開 | 見上表 |

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-09-07 | 有未關閉 HIGH（H1、H2）。`bun test` 全綠（60 pass）。不可出貨。 |
| 第 2 輪複審 | 2026-09-07 | H1、H2 已關。無未關閉 HIGH。`bun test` 全綠（61 pass）。INDEX 未勾選出貨；M4–M6、M8–M10、L1–L7 仍開。 |
