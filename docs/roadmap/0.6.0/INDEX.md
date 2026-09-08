# 0.6.0 Compact 分 scope 與同回合平行

- 上游：[0.5.0 Session compact](../0.5.0/INDEX.md)（`shipped`）
- 下游：[0.7.0 多世界存檔](../0.7.0/INDEX.md)（`planned`；不覆寫本版已定案）
- Changelog：根目錄 [`changelog.md`](../../../changelog.md)；`VERSION.md` 與 `AGENTS.md`
- 狀態：`shipped`
- 日期：2026-09-08（Asia/Hong_Kong）

## 產品句

長局不要等活 jsonl 很肥才「整場再封一次」。人離開舞台時只封 **那名 L2**；jsonl 換檔是另一條較瘦的 **session** scope。對局 GM 出 JSON 之後、回玩家之前，離場的 L2 compact **可並行**。不要背景 job、不要跨回合鎖。

## 文件地圖

閱讀順序：

1. 本檔（WHAT）
2. [`docs/compact-scopes.md`](./docs/compact-scopes.md)（HOW：trigger 表、DAG、失敗解耦）
3. [`docs/reasoning.md`](./docs/reasoning.md)（WHY）
4. 現行 compact 路徑契約（本版改觸發與編排，不重寫目錄／zod／回想）：[0.5.0 session-compact HOW](../0.5.0/docs/session-compact.md)
5. 平行短呼叫：[research/pi-agent-subagent](../../research/pi-agent-subagent.md)（結論：program 再 `createAgentSession`，不要家長 LLM 委派）

規格對照（勿當本版契約）：`docs/handover.md`、`docs/brainstorm.md`、根目錄 `AGENTS.md`、[0.5.0 INDEX](../0.5.0/INDEX.md)。

**開工前仍須拍板：** 無。

## 與上一版對照

| 行為 | [0.5.0](../0.5.0/INDEX.md) | 0.6.0 |
|------|----------------------------|--------|
| Compact 一刀切 | judge／強制線 → 同一拍串行：summary＋**所有**資格 L2 archive／distill → 換 jsonl | **兩個 scope**：NPC 離場只封該 L2；session 換檔分開 |
| `present` 進出 `(a)` | 會問 judge「整場要不要封」 | **廢**：進出只走 NPC scope；不再問整場、不再呼叫 judge |
| LLM 編排 | judge → summary → 各 L2 **串行 `await`** | 對局 GM JSON → Writer → 離場 L2 archive **`Promise.all`**；（若本回 session compact）summary 可與 NPC 並行；opening **必須**等 summary + distill 後 current |
| 體感 | 一則 POST＝GM＋全部 compact 加總 | 仍一則 POST（**不**先回氣泡再背景封）；NPC 段取 **max** 而非加總 |
| Session 觸發 | N=20 問 judge；進出問整場；token／bytes 強制線 | **無 judge**。N 預設 **8** 即封；`scene_id` 相對快照改變即封；強制線數字同 0.5.0 |
| 失敗 | 整步 compact fail-closed（任一 L2 失敗＝整場沒發生） | NPC 失敗只回滾該 id；**不**拖垮同回 session。Session 自身仍整步 fail-closed；session 失敗不回滾已成功的 NPC |
| 檔案樹 | L2 已分 `current`／`archive/` | **不**以拆 `episodes.json`／`entities.json`／`pool.json` 為平行前提 |

**其餘 0.5.0 契約維持**（回想啟發式、`config.yaml` 缺檔啟動失敗、`play-sessions`／`session-archive` 路徑、L2 不截 800、測試隔離 runtime、對局 GM JSON 必填 `scene`、Writer 不讀 jsonl、強制線讀法、opening 欄位與 `recent_turns_to_keep: 3`）。**本版推翻** 0.5.0 已定案 3（整步含 L2 的原子失敗）、6（judge／`(a)`）、12 的「同一拍必填 `session_archive_id`＋所有資格 L2 進同一拍」、15 的 mock 靠 judge 否決；細節以 HOW「覆寫」表為準。

## 已定案

1. **範圍。** 本版做：把 compact 拆成 NPC scope 與 session scope、提早／對齊工作量的 trigger、同一 HTTP 回合內以 **program DAG** 平行離場 L2。不做背景 compact、不做跨回合鎖、不搬 `kb/runtime` 目錄樹（見非目標）、不做人可點的歷史 UI、不加 debug 分鈕。
2. **兩個 scope。** **NPC：** 該 L2 離開 `present` → 以該 `npc_id` 為對象；**有資格才**短呼叫 archive + distill（資格見 HOW：本段曾可寫 body、非整段 trivial、僅 tier 2）。無資格 → 不開模型、該 id 檔不變。不動活 jsonl、不動別人的檔、不改 session 錨點、不改 `since_session_archive`。**Session：** 強制線、或 `scene_id` 換幕、或滿 N → 複製 jsonl、summary、dispose、新 session、opening。未離場且 distill 前 body UTF-16 ＜640：**禁止**重跑 archive 模型。本回已成功 NPC compact 的 id 不得再跑一次。
3. **廢 0.5.0 `(a)` 與 session judge。** 進出不再問「整場要不要封」。離場 L2 → 本回合 NPC scope。熱路徑不呼叫 judge 短呼叫。
4. **Session trigger 表（拍板已鎖）。** 同一回合最多一次 session compact。倉庫 `config.yaml` 預設：`max_turns_without_compact: 8`；`recent_turns_to_keep: 3`；`force_after_input_tokens: 100000`；`force_after_jsonl_bytes: 400000`。命中任一：**(i)** 強制線（讀法同 0.5.0，summary `truncated: true`）；**(ii)** 本回 `scene.scene_id` 與回合開始快照不相等；**(iii)** `(turnIdToN(turn_id) - anchor_turn_n) >= 8`（yaml 可改，程式缺省須與倉庫檔一致）。無否決；滿 N 失敗則錨點不變、之後差仍 ≥ N 再試。成功 session compact 才把錨點寫成本回合數字。
5. **`near_cap` 不當 NPC trigger。** body UTF-16 ≥640 仍列入 `near_cap`（與 0.5.0 相同）。人不走且未觸發 session 時，不因 640 單獨開 NPC compact。Session compact 時，在場且 ≥640、且本回尚未因離場做完者 **必須**納入該拍 L2 短呼叫（失敗則該些新筆不進活目錄，屬 session 整步）。
6. **同一 GM HTTP 回合、非背景。** 離場有資格 L2、（若 session）summary、（若 session）在場 ≥640，**同時開跑**。聚合用 `Promise.allSettled`（或逐 id／逐任務 `catch`），**禁止**裸 `await Promise.all` 讓單 id reject 取消他人或取消 session。Opening **必須**等 summary + 本回會進活目錄的 distill：**開場正文在新 session 建立之後送出**（不寫進即將封存的舊 jsonl）；等的是 distill 完成，不是先對舊 session 寫 opening。離場 NPC 成功可先於 session 換檔提交。有離場短呼叫時玩家等到 `GM + max(離場 NPC, 若有 session 則含 summary 與在場 ≥640)`；僅 session、無離場呼叫時等到 GM＋summary＋在場 ≥640＋opening。禁止先回玩家氣泡再背景封。
7. **編排 = program DAG。** 不是 LLM task planner。節點與邊用程式寫死。輸入是 `present` 差集、`scene_id` 差、錨點差、強制線與 config，禁止另開模型排步驟。平行短呼叫：program 內 `Promise.all` 多個既有 scratch／`createAgentSession`；**不要**裝 `pi-subagents`、不要把對局 GM 變成會自己叫 `task` tool 的家長代理。見研究筆記。
8. **不做背景與鎖。** 不做背景 NPC compact、per-id 鎖／TTL／heartbeat、fork 整份 runtime 再 merge、用第二模型判斷能不能解鎖。歸來撞上「正在寫 current」用「同一回做完再回 HTTP」迴避。
9. **失敗解耦（拍板已鎖）。** 離場 NPC compact 失敗只回滾該 id（不寫假 distill、不機械 `clipTail` 冒充成功）；對局 GM／Writer **已落盤**不因該 NPC 失敗而回滾。同回 session **不**因某離場 NPC 失敗而取消。Session 自身（summary／複製／dispose／opening／在場 ≥640 新筆）仍整步 fail-closed；session 失敗 **不**回滾本回已成功提交的**離場** NPC compact。多名離場時一人失敗不阻止他人提交。NPC archive 的 `session_archive_id`：僅在 `session-archive/` 已落盤後填；否則省略。禁止懸空 `sa_`。
10. **檔案樹本版不搬。** 平行 **不**要求先拆 `episodes.json`／`entities.json`／`pool.json`。L2 目錄已夠並行寫。`dirty-set` 三結局合併規則見 HOW；平行結束後合併寫一次。目錄 redesign 留給 [kb-runtime-upgrade](../backlog/kb-runtime-upgrade.md)，不當本版最小增量。
11. **回想與 UI。** 0.5.0 一層回想契約本版不改語意（仍啟發式、最多 2 份）。不為 compact 做產品面歷史 UI。Debug 面板 **不加** session／NPC 分鈕。
12. **Mock。** `GM_MODE=mock` 給人玩不因 N、換幕、離場或強制線自動跑 compact 短呼叫。單測用注入與強制線假檔。Mock GM 仍須合法 `scene`。

## 開工前仍須拍板

無。

## 非目標

- 背景 compact、跨回合 hold、crash-safe 鎖檔
- 每回合對所有在場 L2 開 distill 模型
- 機械 `clipTail` 冒充 distill
- 以 `near_cap` 單獨觸發 NPC compact
- 保留或重接 session judge
- 多存檔槽、多地點狀態機、對話歷史產品 UI、debug 分鈕
- 用 SDK `session.compact()` 假裝已封存活 jsonl（仍走 0.5.0 複製＋archive＋dispose＋新 session）
- `pi-subagents` 套件、家長 LLM 委派 compact
- 與 [kb-runtime-upgrade](../backlog/kb-runtime-upgrade.md) 同版搬樹
- 不當 0.5.x hotfix 混進本版（N 預設改 8 是本版契約，不是 hotfix）

## 驗收

- [ ] L2 離場、有資格、本回未觸發 session compact → 只對該 `npc_id` 寫 archive／distill；活 jsonl **不**換檔、不建新 `session-archive` 筆、不 `dispose`；其他 L2 檔不被本回 NPC compact 覆寫；`anchor_turn_n` 不變；該筆省略 `session_archive_id`。
- [ ] L2 離場但無資格（本段無可寫 body／僅 trivial）→ 不開 archive 短呼叫、該 id 檔不變；仍不換 jsonl。
- [ ] 兩名以上有資格 L2 同回離場 → archive／distill **並行**（測可用 spy／時序或注入延遲：總等待趨近最慢一名，而非嚴格串行加總）；仍在同一 `POST /api/turn` 結束後才回玩家。
- [ ] `present` 進出 **不再**問 judge、不再僅因進出做 session compact。僅進場且 `scene_id` 不變 → 不 session、不對進場者做 NPC compact。
- [ ] 滿 N（倉庫預設 8）或 `scene_id` 相對快照改變或強制線 → session compact；未離場且 body ＜640 不開 archive 模型；在場且 ≥640 **必須**納入該拍 L2 短呼叫；opening 在 summary + 本回會進活目錄的 distill 之後。
- [ ] 滿 N 之 session 失敗 → 錨點不變；下一回差仍 ≥ N 再試。
- [ ] 熱路徑無 judge 呼叫（單測可 spy／斷言不跑 `compact-judge`）。
- [ ] 離場 NPC compact 失敗 → 該 id 無假 distill、無半套 archive；對局本回合 Writer 落盤仍在；同回 session compact **仍可**成功換檔。
- [ ] Session compact 失敗 → 活 jsonl 未換、無半套 `session-archive`、無懸空 `session_archive_id`；本回已成功的**離場** NPC archive／distill **仍在**。
- [ ] `GM_MODE=mock` 給人玩：不因 N／換幕／離場／強制線自動跑短呼叫。單測注入與假大檔仍可測。
- [ ] 無背景 job：進程在 HTTP 回應前結束本回 compact；無 per-id 鎖檔協定。
- [ ] Custom 無 L2：session compact 路徑仍可換 jsonl（語意同 0.5.0 的 Custom 無 L2 仍可封）。
- [ ] 倉庫 `config.yaml` 預設 `max_turns_without_compact: 8`；強制線兩鍵與 `recent_turns_to_keep` 同 0.5.0。
- [ ] `bun test` 全綠；出貨時 VERSION＝`0.6.0`；AGENTS 寫兩個 scope、同回平行、廢 0.5.0 `(a)`／judge、N＝8、失敗解耦。

## 實作軌道

### Track A — 觸發與 scope 分流

- **做：** 依 HOW trigger 表改 `turn` 插入點；廢 `(a)` 與 judge 呼叫；NPC 離場走 NPC scope；session 走換檔；改倉庫 yaml 預設 N＝8。
- **不做：** `Promise.all` 本體（B）；搬目錄樹。
- **驗收：** 離場有資格才封該 L2；無資格不開模型；進出不再整場問封；滿 N／換幕／強制線才 session。

### Track B — 同回合 DAG 平行

- **做：** Writer 之後離場 L2 與 session 任務同時開跑、`allSettled` 聚合；opening 在新 session、且不早於 distill；`dirty-set` 三結局合併寫一次。
- **不做：** 背景 queue、subagent planner、裸 `Promise.all` 當失敗屏障。
- **驗收：** 並行測；一人失敗他人仍提交；opening 不早於 distill、不寫進舊 jsonl。

### Track C — 失敗語意與回歸

- **做：** NPC／session 失敗解耦；改 0.5.0「任一 L2 失敗＝整場沒發生」測規；BAN 仍禁止 `rm` live `kb/runtime`。
- **不做：** 歷史 UI、debug 分鈕。
- **驗收：** NPC 失敗不拖垮 session；session 失敗不回滾已成功 NPC。

### Track D — 文件出貨

- **做：** changelog／VERSION／AGENTS；出貨後清 backlog（已完成）。

## 錨點檔案

| 路徑 | 用途 |
|------|------|
| `program/turn.ts` | Writer 後 compact 插入點；本版改分流與平行 |
| `program/compact.ts` | 整步 compact／短呼叫；本版拆 scope、去掉 judge 熱路徑 |
| `program/gm-pi.ts` | 短呼叫 scratch session；dispose＋新對局 session（session scope） |
| 根目錄 `config.yaml` | 預設 N＝8；強制線維持 |
| `program/config.ts` | yaml zod；缺檔啟動失敗 |
| `program/schema.ts` | config／archive／summary zod（本版未必加欄） |
| `program/npc-memory.ts`／`program/kb.ts` | L2 寫入、dirty 合併 |
| `prompts/compact-npc-archive.md`、`compact-summary.md` | 短呼叫 prompt；judge 不進熱路徑 |
| `docs/roadmap/0.5.0/docs/session-compact.md` | 現行路徑與欄位 |
| `docs/research/pi-agent-subagent.md` | 禁止家長委派；平行用 program 再開 session，聚合 `allSettled` |

## 行為約束（實作 agent）

- 繁體中文書面語；不 commit 除非使用者要求。
- 勿 `rm` live `kb/runtime`。例證虛構。
- 先打穿驗收。勿做非目標。
- INDEX 已定案不要再問；沉默才提問。
