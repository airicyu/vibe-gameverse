# Design review — 0.6.0 Compact 分 scope 與同回合平行

- **對照基準：** [`../INDEX.md`](../INDEX.md) 已定案＋驗收；HOW [`compact-scopes.md`](./compact-scopes.md)；WHY [`reasoning.md`](./reasoning.md)。本檔不是已定案。
- **HANDOFF：** [`HANDOFF.md`](../HANDOFF.md) **存在**，含 paste-ready starter prompt（**M7** 第 3 輪關閉）。
- **上游／構想（非本版契約）：** [0.5.0 INDEX](../../0.5.0/INDEX.md)、[0.5.0 session-compact HOW](../../0.5.0/docs/session-compact.md)、[kb-runtime-upgrade](../../backlog/kb-runtime-upgrade.md)（明確非本版）。
- **現行程式抽樣（第 3 輪仍同基線）：** `program/turn.ts`（Writer 後 `maybeCompactAfterTurn`）、`program/compact.ts`（judge＋整步串行 `runCompactPipeline`／`qualifyingL2Ids` 依 `touched`）、`program/config.ts`／根目錄 `config.yaml`（N＝20）、`program/schema.ts`（`session_archive_id` 可選）、`docs/research/pi-agent-subagent.md`。現碼未實作本版 ≠ 設計 HIGH。

---

## 本輪（第 3 輪複審）

- **日期：** 2026-09-08（Asia/Hong_Kong）
- **角色：** 設計審查（只認檔案；不改 INDEX／HOW／reasoning／HANDOFF／程式）
- **總評：** 提案**可行**，非整份否決。規劃已把 **M8**（`allSettled`／禁止裸 `Promise.all` 當失敗屏障）寫進 INDEX 已定案 6、HOW DAG、Track B；**L4**（opening 在新 session、離場＋session 等待含在場 ≥640）寫進已定案 6 與 HOW DAG；**HANDOFF.md** 存在且含 paste-ready。**無未關閉 HIGH。** 無仍開應修 MEDIUM。待拍板空。**產品閘門通過；開實作閘門通過。** 殘餘 **L2**（上游 0.5.0 `in progress`）、**L5**（對照表／已定案 7 仍寫 `Promise.all` 作同時開跑，不覆寫已定案 6 聚合句）皆非阻擋。

### 本輪 Findings 狀態

| ID | 本輪判定 | 依據（現檔） |
|----|----------|----------------|
| **H1** | **關閉**（維持） | 同第 2 輪：離場＝scope；有資格才開模型。 |
| **M1–M6** | **關閉**（維持） | 同第 2 輪，現檔未倒退。 |
| **M7** | **關閉** | `docs/roadmap/0.6.0/HANDOFF.md` 存在：讀檔順序、產品摘要、Track A→D、禁區、完成檢查、paste-ready（只認檔案、先讀 AGENTS／HANDOFF／INDEX、跟 Track、禁非目標、INDEX 已寫勿再問）。 |
| **M8** | **關閉** | INDEX 已定案 6：聚合 `Promise.allSettled`（或逐任務 catch），禁止裸 `await Promise.all` 取消他人／session。HOW DAG 同句。Track B 做 `allSettled`、不做裸 `all` 當失敗屏障。HANDOFF 禁區同義。 |
| **L1、L3** | **關閉**（維持） | 同第 2 輪。 |
| **L2** | **仍開（非阻擋）** | INDEX 上游仍寫 0.5.0 `in progress`。 |
| **L4** | **關閉** | INDEX 已定案 6／HOW：開場正文在新 session 建立之後送出、不寫進舊 jsonl；DAG 為換檔／dispose／新 session **之後**才送 opening。等待句：`GM + max(離場 NPC, 若有 session 則含 summary 與在場 ≥640)`。 |
| **L5** | **開（本輪新增，非阻擋）** | 見下。 |

**門檻：** 設計／產品自洽 **通過**（無未關 HIGH；同意應修 MEDIUM 均已寫進檔）。開實作檢查清單 **通過**（待拍板空；HANDOFF 含 paste-ready；非目標寫清；同意項已併入 INDEX／HOW）。現碼仍為 0.5.0 基線，屬未實作，不是設計缺口。

---

## 第 2 輪複審（歷史）

- **日期：** 2026-09-08（Asia/Hong_Kong）
- **總評（當時）：** 可行。H1、M1–M6、L1、L3 關閉。無未關 HIGH。應修仍開 **M8**；**M7** 缺 HANDOFF（非阻擋產品、擋開實作）。新增 L4。產品門檻通過；開實作門檻未過。

---

## Findings

### HIGH

#### H1 — 離場 NPC compact：必做，或仍走 0.5.0 資格跳過？

**狀態：** 關閉（第 2 輪複審；第 3 輪維持）

INDEX 已定案 2 與驗收第 1 條把「L2 離開 `present`」寫成對該 `npc_id` **做** archive／distill。HOW「兩個 scope」表同樣以離場為 NPC trigger，但同節又寫資格過濾沿用 0.5.0 已定案 12（`touched`、本段曾可寫 body、整段僅 trivial 則跳過），並以 dirty／archive 定義「本段」。

現行 `qualifyingL2Ids`（`program/compact.ts`）另要求 `dirty.touched` 且 `current.updated_turn > anchor_turn_n`。若規劃意圖是「人走就封」，則 HOW 不得再把「不在 touched／僅 trivial」當跳過；若意圖是「人走且本段有可寫記憶才封」，則 INDEX 已定案 2、驗收第 1 條與產品句「人離開舞台時只封那名 L2」須改成有資格才寫，並寫清跳過時不開短呼叫、不改檔。

此分叉會讓主路徑測規無法客觀判（離場但本段無 body → 寫或不寫皆可被某一份文件宣告正確）。

**複審：** 分叉已關。現 INDEX 已定案 2＝離場為對象、**有資格才**短呼叫（tier 2、本段可寫 body、非整段 trivial；細節見 HOW）；驗收分「有資格才寫／無資格不開模型」兩勾。HOW 並寫不以 `touched` 單獨否決或單獨開跑。現碼 `qualifyingL2Ids` 仍依 `touched`∩錨點——屬未實作，不是契約分叉。

---

### MEDIUM（預設應修）

#### M1 — 同回 NPC＋session 的 `session_archive_id` 與落盤時點

**狀態：** 關閉（第 2 輪複審；第 3 輪維持）

0.4.0／現 zod：`session_archive_id` **可選**。0.5.0 已定案 12：同一拍填該欄。0.6.0 已定案 9：session 失敗 **不**回滾已成功 NPC；NPC-only **不**換 jsonl。HOW 未寫：

- NPC-only：省略 `session_archive_id`（禁止發明未落盤的 `sa_`）。
- 同回兩者都有：是否等 session 真正寫入 `session-archive/` 再填；若平行時先填即將使用的 id、其後 session 失敗，是否允許 NPC archive 指向不存在的 `sa_`。

0.5.0 現碼在 scratch 階段即把 `archiveId` 寫進 NPC entry，整步失敗才回滾。本版若 NPC **先提交**、session 後失敗，沿用「先填 id」會留下懸空互指。須在 HOW 寫死時序，以免實作沿用 0.5.0 原子 apply 而違反失敗解耦，或留下假 `sa_`。

**複審：** HOW 已寫禁止懸空、NPC-only 省略、先提交後補寫、session 失敗保持省略；在場 ≥640 綁 session 成功才進活目錄。INDEX 已定案 9 同義。

#### M2 — `dirty-set` 在三條結局下的合併規則不足

**狀態：** 關閉（第 2 輪複審；第 3 輪維持）

HOW 要求平行寫 L2、**合併寫 dirty 一次**；NPC 成功「自 `touched` 去掉該 id」；不改 `since_session_archive`（NPC-only）。0.5.0 session 成功則 `since_session_archive`＝本次 id，且 **`touched` 清空再寫回本回合剛寫過的 id**（現碼 `runCompactPipeline` 正是如此）。

同回「先 NPC 去掉離場 id、再 session 把本回 `events`／`npc_lines` 的 id 寫回 `touched`」會把剛封完的離場者又放回去。後續 session 是否再跑該 id，依賴資格句是否以 archive／`updated_turn` 擋住——HOW 未把三結局寫成表：僅 NPC、僅 session、兩者。實作很容易與 0.5.0 收拾語意混用。

**複審：** HOW 三結局表已寫；兩者列禁止把已成功離場 NPC 再寫回 `touched`；session 失敗等同僅 NPC 列。INDEX 已定案 10 指向 HOW。

#### M3 — Session 拍「在場且 ≥640」是必跑還是可選

**狀態：** 關閉（第 2 輪複審；第 3 輪維持）

已定案 2／5 與 HOW 用「仍**可**納入」「**不必**對 ＜640 重跑」。驗收只禁止對未離場且 ＜640 開模型，**沒有**「在場 ≥640 必須 distill」的勾項。產品句與 reasoning 要工作量對齊「超長」，與「可」字不等價。兩種實作都能過目前驗收、費用差一截。應改成必做或明確非目標（本版 session 可不 distill 任何在場者）。

**複審：** 已定案 5、驗收第 5 條、HOW 均為 **必須**納入；reasoning 拍板段同義。

#### M4 — DAG 圖未放置「在場 near_cap L2」，且易讀成整批原子成功才落盤

**狀態：** 關閉（第 2 輪複審；第 3 輪維持）

HOW DAG 平行框只有「離場 L2」與「（若 session）summary」。在場 ≥640 的短呼叫未入圖，實作可能串在 summary 之後，與「NPC 段取 max」體感不一致（若 M3 定為必跑）。「成功才換活 jsonl」易被讀成 0.5.0 整步（含 NPC 檔）原子；失敗表其實要求 NPC 可先提交。應在 DAG 補：NPC 檔提交與 session 換檔解耦；在場 near_cap 與離場／summary 的邊。

**複審：** HOW DAG 已含三類平行節點與解耦提交。opening 時序見 **L4**（已關，不重開 M4）。

#### M5 — 「其餘 0.5.0 契約維持」未列被推翻條

**狀態：** 關閉（第 2 輪複審；第 3 輪維持）

INDEX 對照表與已定案已廢 `(a)`／judge、改失敗原子性、改 N。括號內「其餘維持」未點名推翻 0.5.0 已定案 3、6、12（整步含任一 L2 失敗）、15（mock 問 judge）、以及 0.5.0 HOW 步驟 4–6。實作 agent 若並行遵守兩版 HOW，會把 judge 或整場 fail-closed 接回來。建議 HOW 開頭列「覆寫 0.5.0 的條目」，其餘才指向 0.5.0 HOW。

**複審：** HOW 覆寫表＋INDEX 對照表已點名 3、6、12、15、HOW 步驟 4–6、N＝8。

#### M6 — 測試／驗收未覆蓋的次要路徑

**狀態：** 關閉（第 2 輪複審；第 3 輪維持）

建議補進驗收或 HOW 測規（仍屬本版範圍，不是新功能）：

- NPC-only：不建 `session-archive` 新筆、不 `dispose`／不換 jsonl、錨點不變（驗收第 1 條已有活 jsonl／錨點；應明示不寫 `sa_` 目錄）。
- 僅進場、`scene_id` 不變：不 session、不對進場者做 NPC compact。
- 滿 N 失敗後錨點不變、下回差仍 ≥ N 再試（已定案 4 有，驗收無獨立勾）。
- `GM_MODE=mock` 給人玩：不因 N／換幕／離場跑短呼叫（HOW 有；驗收未勾）。強制線是否仍可在 mock 熱路徑觸發，應與 0.5.0「假大檔可測」對齊寫一句。
- 熱路徑不讀 `prompts/compact-judge.md`（驗收有 spy；檔可留 repo 已寫）。

**複審：** 上列均已進 INDEX 驗收及／或 HOW 測試 BAN／Mock 節（給人玩含強制線不跑；單測注入／假檔仍可測）。

#### M7 — 實作前缺 `HANDOFF.md`（流程，非產品語意）

**狀態：** 關閉（第 3 輪複審）

`docs/roadmap/agent-workflow.md`：中改以上實作前應有 HANDOFF。本版無該檔。規劃收斂 H1–M6 後再寫，勿在初審把本項當 INDEX 錯誤。

**第 2 輪：** 檔仍不存在。產品契約已自洽，維持非阻擋產品。開實作前須有 `docs/roadmap/0.6.0/HANDOFF.md`（讀檔順序、Track、禁區、paste-ready starter prompt）。

**第 3 輪：** 檔存在且含 paste-ready。讀檔順序、Track A→D、禁區（含勿裸 `Promise.all` 當失敗屏障、勿 rm live runtime）、完成檢查齊。關閉條件已滿足。

#### M8 — `Promise.all` 聚合 reject 與「單 id 失敗不取消他人／session」

**狀態：** 關閉（第 3 輪複審）

INDEX 已定案 6–7 與 HOW DAG 把平行寫成 program **`Promise.all`**。已定案 9 與 HOW 失敗表要求：離場一人失敗只回滾該 id、**不**取消其他離場節點、**不**取消同回 session。

JavaScript 裸 `await Promise.all(...)` 在任一 reject 時整段 throw；未隔離時實作容易把 session／dirty 合併當成「整批沒發生」，接回已推翻的 0.5.0 已定案 3。產品意圖已寫死，缺的是 HOW／INDEX 一句：並行＝同時開跑；聚合須 `allSettled`（或逐 id catch）使單 id 失敗不打斷 summary／其他 id／session 決策。

不關閉則 Track B 測規「一人失敗、他人仍提交、session 仍可換檔」可能被實作成「Promise.all 一炸全停」。屬文件漏網，不是新產品語意。

**第 3 輪：** 已定案 6、HOW DAG、Track B、HANDOFF 禁區均寫死：同時開跑；聚合 `allSettled` 或逐任務 catch；禁止裸 `Promise.all` 當失敗屏障。對照表／已定案 7 仍用 `Promise.all` 描述「同時開多個 scratch」，不覆寫聚合句；殘餘易讀點見 **L5**，不重開 M8。

---

### LOW

#### L1 — 體感句只寫 `GM + max(NPC compact)`

**狀態：** 關閉（第 2 輪複審；第 3 輪維持）

已定案 6 未寫「僅 session、無離場」時玩家等到 GM＋summary＋opening。產品仍可懂；補半句即可。

**複審：** 已定案 6／HOW 已補僅 session 等待句（含在場 ≥640）。

#### L2 — INDEX 上游寫 0.5.0 `in progress`

**狀態：** 開（非阻擋）

本版假設上游「能封、能回想、能換 session」已可玩。與 backlog 一致。實作 0.6.0 前須確認 0.5.0 契約不再改觸發語意；屬排程提醒，不是本 INDEX 自相矛盾。

**第 2–3 輪：** 現檔未變。維持記錄。

#### L3 — HOW 未寫 NPC-only 的 `turn_from`／`turn_to` 算法

**狀態：** 關閉（第 2 輪複審；第 3 輪維持）

0.5.0 用 session 段 `lastTo+1`…本回合。NPC-only 應寫：自該 id 上一筆 archive 的 `turn_to` 之次回合（無則開局 `t0001`）至本 `turn_id`。可跟 H1 資格段一起鎖。

**複審：** HOW NPC 資格節已寫「本段」與 `turn_from`／`turn_to`。

#### L4 — DAG 把 opening 畫在換檔之前；離場＋session 等待句未納入在場 ≥640

**狀態：** 關閉（第 3 輪複審）

HOW DAG 在「session 成功才換活 jsonl／dispose／新 session」**之前**列 opening 等待。0.6.0 覆寫表仍把 jsonl 複製／dispose／opening **路徑**指向 0.5.0 HOW（開場進**新** session，不進即將封存的舊 jsonl）。易誤讀為對舊活 session 先寫開場。補半句「opening 內容等 distill；送出仍在新 session 建立之後」即可。

已定案 6：有離場時等到 `GM + max(離場 NPC)`（summary 更慢則更長），未把同回在場 ≥640 納入 max。與「三類並行」同頁；測規仍以 HTTP 結束前做完為準，不擋開工。

**第 3 輪：** INDEX 已定案 6 寫死開場在新 session 之後、不寫舊 jsonl；HOW DAG 順序為換檔／新 session → 此時才送 opening。等待句已含 session 時的 summary 與在場 ≥640。兩點均已寫進契約。

#### L5 — 對照表／已定案 7 仍寫 `Promise.all`（非聚合契約）

**狀態：** 開（第 3 輪新增；非阻擋）

INDEX「與上一版對照」LLM 編排列仍寫離場 archive **`Promise.all`**；已定案 7 寫「program 內 `Promise.all` 多個既有 scratch」。已定案 6／HOW／Track B 已禁止把裸 `all` 當失敗屏障。實作若只讀對照表，可能再寫裸 `await Promise.all`。可選把對照表改成「同時開跑、`allSettled` 聚合」；已定案 7 可改成「同時開多個 scratch」而不點名裸 `all`。不重開 **M8**。reasoning 一句仍寫 `Promise.all` 之後趨近最慢——WHY 非契約。

---

## 驗收對照

| 驗收句 | 初審 | 第 2 輪 | 第 3 輪 |
|--------|------|---------|---------|
| 離場、無 session → 只封該 L2；jsonl 不換；他人 L2 不被本回 NPC 覆寫；錨點不變 | **H1** 使「是否必寫」不定 | **H1 關** | 維持 |
| 兩名以上離場 → 並行；同一 POST 結束才回玩家 | 與已定案 6–8 一致 | **M8** 提醒勿裸 `all` | **M8 關**；殘餘對照表用詞見 **L5** |
| `present` 進出不再問 judge、不再僅因進出做 session | 與已定案 3 一致 | 僅進場已入驗收 | 維持 |
| 滿 N／換幕／強制線 → session；＜640 未離場不必重跑；opening 在 summary＋本回 distill 之後 | **M3** 未要求 ≥640 必跑 | **M3 關** | **L4 關**：opening 在新 session |
| 熱路徑無 judge | 一致 | 一致 | 維持 |
| NPC 失敗：無假 distill／無半套；Writer 保留；同回 session 仍可換檔 | **M1／M4** 需 HOW | **M1／M4 關**；**M8** 仍開 | **M8 關** |
| Session 失敗：jsonl 未換、無半套；已成功 NPC 仍在 | 與已定案 9 一致 | 無懸空 `sa_` | 維持 |
| 無背景 job、無 per-id 鎖檔 | 與已定案 8 一致 | 一致 | 維持 |
| Custom 無 L2 仍可換 jsonl | 與 0.5.0 一致 | 一致 | 維持 |
| 倉庫 yaml N＝8 | 現倉仍 20＝未實作 | 契約已鎖 8 | 現倉仍 20＝未實作 |
| `bun test`；VERSION／AGENTS 出貨句 | Track D | Track D | Track D |
| mock 給人玩不跑短呼叫 | （初審在 M6） | 已入驗收／HOW | 維持 |
| 滿 N 失敗錨點不變 | （初審在 M6） | 已入驗收 | 維持 |

未發現驗收要求多地點、戰鬥、背景 compact、或搬 `episodes.json` 樹。

---

## 與現碼抽樣

抽樣目的：提案是否與**現行 0.5.0 實作**不可調和到無法在禁區內改；**不是**把「還沒做 0.6.0」標成 HIGH。第 3 輪未改程式，抽樣結論同初審。

| 現碼 | 與 0.6.0 關係 |
|------|----------------|
| `turn.ts`：`writeFromGm` 後 `maybeCompactAfterTurn`；HTTP 回傳在 compact 之後 | 插入點正確；本版改分流／平行，不必改「先回氣泡」 |
| `maybeCompactAfterTurn`：`presentChanged` **或**滿 N → `judgeCompact`；mock 固定否決 | 本版廢熱路徑 judge；現碼衝突是**預期推翻**，非設計不可行 |
| `runCompactPipeline`：summary 後 `for` 串行資格 L2；任一 distill ≥640 `throw`；失敗 `rollbackApply` 連 NPC | 本版要同時開跑＋`allSettled` 與失敗解耦；現碼是 0.5.0 基線 |
| `qualifyingL2Ids`：`touched` ∩ L2 ∩ `updated_turn > anchor` | HOW 資格改為離場差集＋ body／trivial／tier 2，不以 `touched` 單獨否決；現碼未做 |
| `saveDirtySet({ since_session_archive, touched: 本回 writers })` | HOW 三結局將覆寫此語意 |
| `config.yaml` `max_turns_without_compact: 20` | Track A 改 8；現值符合 0.5.0，不符 0.6.0 出貨驗收（未實作） |
| `NpcArchiveEntrySchema.session_archive_id` optional | 支援 NPC-only 省略；HOW 已寫何時填／補寫 |
| scratch `openPiSession`／`runScratchJson`（研究筆記） | 與已定案 7、非目標「不要 pi-subagents」一致，平行可沿用 |
| 無 per-id 鎖檔、無背景 queue | 與已定案 8 不衝突 |

未抽到現碼強制「必須先拆 `pool.json`」或「必須背景 job」。與 [kb-runtime-upgrade](../../backlog/kb-runtime-upgrade.md) 同版搬樹已列非目標，現碼亦不阻擋分 scope。

---

## 修復追蹤表

| ID | 級 | 題旨 | 關閉條件 | 初審 | 第 2 輪 | 第 3 輪 |
|----|----|------|----------|------|---------|---------|
| H1 | HIGH | 離場必封 vs 資格跳過 | 已寫進 INDEX 已定案＋驗收＋HOW，三處同義 | 開 | **關閉** | **關閉** |
| M1 | MEDIUM | `session_archive_id` 與 NPC／session 落盤時點 | 已寫進 HOW（必要時 INDEX 一句） | 開 | **關閉** | **關閉** |
| M2 | MEDIUM | dirty 三結局合併 | 已寫進 HOW 表 | 開 | **關閉** | **關閉** |
| M3 | MEDIUM | 在場 ≥640 必／可 | 已定案＋驗收同義 | 開 | **關閉** | **關閉** |
| M4 | MEDIUM | DAG：near_cap 邊、NPC 先提交 | 已寫進 HOW DAG | 開 | **關閉** | **關閉** |
| M5 | MEDIUM | 明示覆寫哪些 0.5.0 條 | 已寫進 HOW 或 INDEX 對照 | 開 | **關閉** | **關閉** |
| M6 | MEDIUM | 次要路徑驗收／測規 | 已寫進 INDEX 驗收或 HOW 測試 BAN | 開 | **關閉** | **關閉** |
| M7 | MEDIUM | 缺 HANDOFF | 實作前存在 `0.6.0/HANDOFF.md`（含 paste-ready） | 開（非阻擋產品） | **仍開** | **關閉** |
| M8 | MEDIUM | `Promise.all` vs 單失敗不取消 | HOW／INDEX 寫明隔離聚合（如 `allSettled`） | — | **開** | **關閉** |
| L1 | LOW | 僅 session 的等待句 | 可選補 INDEX 已定案 6 | 開 | **關閉** | **關閉** |
| L2 | LOW | 上游 0.5.0 仍 in progress | 記錄即可 | 開 | **仍開** | **仍開** |
| L3 | LOW | NPC-only turn 區間 | HOW 一句 | 開 | **關閉** | **關閉** |
| L4 | LOW | opening／等待句易讀點 | 可選補 HOW／INDEX | — | **開** | **關閉** |
| L5 | LOW | 對照表／已定案 7 仍寫 `Promise.all` | 可選對齊已定案 6 用詞 | — | — | **開**（非阻擋） |

關閉＝已寫進 INDEX／HOW（或 HANDOFF 產物存在），三處同義；仍開＝契約仍分叉或產物仍缺；非阻擋＝記錄即可。M7 關閉＝HANDOFF 檔存在且含 paste-ready，不是改產品句。

---

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-09-08 | 可行，非整份否決。未關閉 HIGH：**H1**。應修 MEDIUM：M1–M7（M7 擋開實作 agent、不擋產品方向）。缺 HANDOFF。現碼為 0.5.0 基線，抽樣無 POC 禁區衝突。 |
| 第 2 輪複審 | 2026-09-08 | 可行。**H1、M1–M6、L1、L3 關閉。** 未關閉 HIGH：無。應修仍開 MEDIUM：**M8**；**M7** 仍開、非阻擋產品、開實作前須有 HANDOFF。新增 L4。產品門檻通過；開實作門檻未過。現碼仍 0.5.0 基線。 |
| 第 3 輪複審 | 2026-09-08 | 可行。**M7、M8、L4 關閉。** 未關閉 HIGH：無。仍開應修 MEDIUM：無。新增 **L5**（非阻擋）。產品閘門通過；開實作閘門通過。現碼仍 0.5.0 基線。 |

規劃收斂時：勿把本審查檔當契約；同意項須併入 INDEX／HOW 後本表才可標關閉。
