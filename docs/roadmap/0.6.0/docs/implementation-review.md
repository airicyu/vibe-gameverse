# Implementation review — 0.6.0 Compact 分 scope 與同回合平行

- 日期：2026-09-08（Asia/Hong_Kong）
- 輪次：**實作收斂（M3 補測）**；初審／第 2 輪複審見下文歷史
- **總評：** 無未關閉 HIGH。M1–M8 均已關（M3 補「僅 session」「兩者」dirty 單測）。`bun test` 全綠（79 pass／0 fail）。INDEX 仍 `in progress`。待使用者同意出貨後才勾驗收、改 `shipped`、清 backlog。

## Findings（累加；ID 自初審穩定，後輪勿重編號）

關閉＝已對齊 INDEX 且有證據；仍開＝實作／測規與契約分叉。

### HIGH

無。

### MEDIUM

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| M1 | **關閉** | `hot path source never loads compact-judge.md`：讀 `compact.ts` 斷言無 `compact-judge.md`、無 `judgeCompact`。熱路徑無 judge 實作可 spy。 |
| M2 | **關閉** | `session fail keeps departed npc archive` 與 `fail after scratch…` 均 `expect` `anchor_turn_n === 0`。滿 N 失敗不呼叫成功路徑的 `saveCompactState`。下一回再試仍無測（見 **L9**）。 |
| M3 | **關閉** | `npc-only dirty…`、`session-only dirty sets since and drops distilled near_cap id`、`both scopes dirty keeps since and does not re-touch departed success`。 |
| M4 | **關閉** | `one of two departed npc failures still commits the other`：`na_bartender_001` 在、`na_ash_001` 不在。 |
| M5 | **關閉** | `N=8 yaml due at t0008 session compact`：隔離 yaml `max_turns_without_compact: 8`，`t0008` 且 `result.compacted === true`。倉庫讀檔測仍在。隔離預設仍 N＝20。 |
| M6 | **關閉** | `scene_id change does not archive on-stage L2 under 640`：換幕 session 後 `l2/bartender/archive` 不存在。 |
| M7 | **關閉** | HOW 已寫程式判定＝`current.updated_turn > lastTo` **或**本回 `events.actors`／`npc_lines`；不掃歷史 `episodes.json`。`qualifiesDepartedNpc` 與該句一致。 |
| M8 | **關閉** | `program/` 無 `CompactJudgeSchema`、無 `CompactTestHooks.judge`。`prompts/compact-judge.md` 仍在（HOW 允許留 repo、不得掛 `runTurn`）。 |

### LOW

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| L1 | **仍開** | 強制線位元組後備（無 `usage.input` 時 `force_after_jsonl_bytes`）無單測；現測打 `usage.input === 100000`。 |
| L2 | **仍開** | 缺 yaml 有子程序測（`missing config.yaml fails subprocess start`）。鍵型錯誤無獨立測。 |
| L3 | **仍開** | `package.json` `"version"` 仍為 `0.2.0`；產品字串以 `VERSION.md`＝`0.6.0` 為準。 |
| L4 | **仍開** | INDEX 狀態 `in progress`、驗收 checkbox 未勾；`changelog.md`／`VERSION.md`／`AGENTS.md` 已按 0.6.0 出貨文案寫。Track D 與 backlog（仍標 0.6.0 `planned`）未清。 |
| L5 | **仍開** | 套用失敗若已 `mkdir` `session-archive/`，回滾在 `previousIndex.entries.length === 0` 時刪 `index.json`，可能留下空目錄（承 0.5.0）。 |
| L6 | **仍開** | Debug 仍單一「Session compact」鈕（`/api/debug/session-compact`）；未加 NPC 分鈕，符合「不加分鈕」。非阻擋。 |
| L7 | **仍開** | 並行測 `elapsed < 160`（兩段 80ms delay）；本輪實測約 119ms。邊界偏緊，可能偶發 flaky。 |
| L8 | **仍開** | `mock` 內建 `modelSummary`／`modelNpcArchive` 仍可在 skip 被繞過時當假短呼叫；給人玩路徑有 `mockPlaySkipsAutoCompact` 擋自動跑。 |
| L9 | **仍開（本輪新增）** | 驗收「滿 N 之 session 失敗 → 下一回差仍 ≥ N 再試」無第二回合測。錨點不變已由 M2 鎖住。 |

## 驗收對照

| INDEX 驗收句 | 通過／失敗 | 證據（測／檔） |
|--------------|------------|----------------|
| L2 離場、有資格、本回未觸發 session → 只封該 `npc_id`；jsonl 不換、不建 `session-archive`、不 dispose；其他 L2 不被覆寫；錨點不變；省略 `session_archive_id` | **通過** | `qualified L2 leave archives that npc only`：`na_ash_001`、無 `sa_001`、活 jsonl 仍在、bartender current 不變、`anchor_turn_n===0`、`session_archive_id` undefined |
| L2 離場但無資格 → 不開 archive、該 id 檔不變；不換 jsonl | **通過** | `unqualified leave does not open npc archive`：無 `l2/ash/archive` |
| 兩名以上有資格 L2 同回離場 → archive／distill 並行；同一 `POST /api/turn` 結束後才回 | **通過** | `two departed npc archives overlap in time`：兩檔皆在、`elapsed < 160`；`runTurn` 在 HTTP 前 `await maybeCompactAfterTurn` |
| `present` 進出不再問 judge、不再僅因進出做 session；僅進場且 `scene_id` 不變 → 不 session、不對進場者 NPC compact | **通過** | `present delta does not session compact`：無 `sa_001`、錨點 0；碼只對 `departedPresentIds` 開 NPC scope |
| 滿 N（倉庫預設 8）或 `scene_id` 改變或強制線 → session；未離場且 ＜640 不開 archive；在場 ≥640 納入；opening 在 summary＋會進活目錄的 distill 之後 | **通過** | `N=8 yaml due at t0008`；`scene_id change`；`force line`；`injected compact`（640 → archive＋縮短）。`scene_id change does not archive on-stage L2 under 640`。opening：`applySessionCompact` 於 `createPlaySession` 之後 `promptPlayOpening` |
| 滿 N 之 session 失敗 → 錨點不變；下一回差仍 ≥ N 再試 | **部分通過** | 失敗不寫成功錨點，測已斷言 `anchor_turn_n===0`。無「下一回再試」（**L9**） |
| 熱路徑無 judge 呼叫 | **通過** | `compact.ts` 無 `compact-judge`／`judgeCompact`；`program/` 無 judge schema／hook |
| 離場 NPC 失敗 → 該 id 無假 distill／半套 archive；Writer 落盤仍在；同回 session 仍可換檔 | **通過** | `departed npc failure does not block session compact`：有 `sa_001`、無 `na_ash_001`；compact 在 `writeFromGm` 之後 |
| Session 失敗 → 活 jsonl 未換、無半套 `session-archive`、無懸空 `sa_`；已成功離場 NPC 仍在 | **通過** | `session fail keeps departed npc archive`：活 jsonl、無 `sa_001`、有 `na_ash_001`。NPC-only 草稿不帶 `session_archive_id` |
| `GM_MODE=mock` 給人玩不因 N／換幕／離場／強制線自動跑短呼叫；單測注入與假大檔仍可測 | **通過** | `mockPlaySkipsAutoCompact`；`mock runTurn twenty times`；`N due without inject`。注入／強制線假檔有測 |
| 無背景 job；HTTP 回應前結束本回 compact；無 per-id 鎖檔 | **通過** | `turn.ts` await compact 後才 return；`compact.ts` 無 queue／鎖檔／heartbeat（`gm-pi` 的 `turnLock`／heartbeat 僅對局 pi，非 compact） |
| Custom 無 L2：session 仍可換 jsonl | **通過** | `custom without L2 still archives jsonl on inject`；不建 `l2/bartender` |
| 倉庫 `config.yaml` 預設 `max_turns_without_compact: 8`；強制線兩鍵與 `recent_turns_to_keep` 同 0.5.0 | **通過** | `config.yaml`：8／3／100000／400000；`warehouse config.yaml default N is 8` |
| `bun test` 全綠；出貨時 VERSION＝`0.6.0`；AGENTS 寫兩個 scope、同回平行、廢 `(a)`／judge、N＝8、失敗解耦 | **測試通過／出貨文件已寫、INDEX 未勾** | 見測試結果；`VERSION.md`＝0.6.0；`AGENTS.md` Compact 段已寫。INDEX 仍 `in progress`（**L4**） |

## 重點核對（本輪）

| 項 | 結論 |
|----|------|
| 兩個 scope | NPC＝`departedPresentIds`＋`qualifiesDepartedNpc` 才 `draftNpcWrite`／提交；Session＝強制線／`sceneIdChanged`／`dueN`。未離場＜640 不進 NPC job |
| 廢 judge | 熱路徑無呼叫、無讀 `compact-judge.md`、無 `CompactJudgeSchema`／`hook.judge` |
| N＝8 倉庫預設 | `config.yaml` 與讀檔測；行為測 `t0008`＋隔離 yaml＝8。程式無另寫死缺省（缺檔啟動失敗）。隔離預設仍 20 |
| `allSettled` | `runCompactAfterTurn`：`await Promise.allSettled(jobs)`。未用裸 `Promise.all` 當失敗屏障 |
| 失敗解耦 | 離場 reject 不設 `sessionJobFailed`；離場先 `commitNpcWrite`；session 回滾只動 `sessionNpcWrites` |
| 離場資格 | 與 HOW 代理句一致：tier 2、current 存在、`updated_turn` 或本回 touch、非（本回 trivial 且 current 未新於 last archive） |
| mock 不自動跑 | 無 summary／npc／fail hook 且 mock／`GM_MODE=mock` → 直接 `{ compacted: false }`（`forceSession` 除錯除外） |
| 未搬目錄樹 | 仍 `episodes.json`／`entities.json`／`pool.json`；L2 仍 `current`＋`archive/` |
| 未背景 job | 同一 `POST /api/turn` 內 await；無 compact queue |
| dirty-set 三結局 | 實作對表；測只鎖「僅 NPC」（**M3**） |

## 測試結果

- 指令：`bun test`（工作目錄 `/home/airic/airwave/vibe-gameverse`；未對 live `kb/runtime` 執行 `rm`）
- 初審：**72 pass／0 fail**，4 檔，236 `expect()`，約 1.51s
- 第 2 輪：**77 pass／0 fail**，4 檔，242 `expect()`，約 1.65s
- 隔離：各 `*.test.ts` 首行 `import "./test-runtime-env.ts"`；`VIBE_GAMEVERSE_KB_RUNTIME`＋`VIBE_GAMEVERSE_CONFIG` 指向臨時目錄。測內 `rm(kbRuntimeDir)` 只打臨時目錄
- 未跑瀏覽器／真人 pi 長局

## 修復追蹤

| ID | 級 | 狀態 | 關閉條件（實作） |
|----|----|------|------------------|
| M1 | M | **關閉** | 熱路徑測斷言不載 `compact-judge.md`／無 `judgeCompact` |
| M2 | M | **關閉** | 滿 N＋session 失敗斷言錨點不變 |
| M3 | M | 仍開 | dirty-set **三**結局皆有測（僅 session、兩者尚未鎖） |
| M4 | M | **關閉** | 兩名離場一人失敗、成功者仍提交 |
| M5 | M | **關閉** | 以 N＝8 的 config 於 `t0008` 觸發 session |
| M6 | M | **關閉** | 換幕時在場＜640 不斷言新 NPC archive |
| M7 | M | **關閉** | HOW 承認 `updated_turn` 代理；碼一致 |
| M8 | M | **關閉** | 已移除 `CompactJudgeSchema`／hook.judge |
| L1–L8 | L | 仍開 | 見上表 |
| L9 | L | 仍開 | 滿 N session 失敗後下一回仍因差 ≥ N 再試 |

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-09-08 | 無未關閉 HIGH。`bun test` 全綠（72 pass）。主路徑對齊 INDEX。M1–M8、L1–L8 仍開。INDEX 未勾選出貨。 |
| 第 2 輪 | 2026-09-08 | 無未關閉 HIGH。M1–M2、M4–M8 關閉；M3 仍開。新增 L9。`bun test` 全綠（77 pass）。INDEX 仍 `in progress`，不可出貨直至使用者同意。 |
| 實作收斂 | 2026-09-08 | 補 dirty 三結局測；M3 關閉。`bun test` 全綠（79 pass）。仍待使用者同意 shipped／清 backlog。 |
