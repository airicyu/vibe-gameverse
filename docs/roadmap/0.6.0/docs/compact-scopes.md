# 0.6.0 HOW — 兩個 scope、trigger、同回 DAG、失敗解耦

對照：[`../INDEX.md`](../INDEX.md)。例證虛構。

## 覆寫 0.5.0 的哪些條（其餘才沿用）

路徑、zod 形狀、回想啟發式、jsonl 複製／dispose／opening 欄位、強制線**讀法**、`compact-state.json`、測試隔離：仍以 [0.5.0 session-compact HOW](../../0.5.0/docs/session-compact.md) 與 0.5.0 INDEX 為準。

本檔 **推翻** 下列 0.5.0 契約；實作 **禁止** 並行遵守兩版而把舊行為接回來：

| 0.5.0 | 本版 |
|-------|------|
| INDEX 已定案 3：整步含任一 L2 失敗＝整場沒發生 | 失敗解耦：NPC 按 id；session 自身仍 fail-closed |
| INDEX 已定案 6 與 HOW 步驟 5：`(a)` 進出或滿 N → **judge** | 廢 judge；進出只走 NPC scope；滿 N／換幕／強制線走 session |
| INDEX 已定案 12：同一拍必填 `session_archive_id`；資格 L2 全進同一拍 session | NPC-only 省略該欄；session 拍只跑離場已做完以外的「在場且 ≥640」 |
| INDEX 已定案 15：mock 靠 judge 固定否 | mock 給人玩不跑短呼叫（見下） |
| HOW 步驟 4–6 串行 judge→整步 apply | 本檔 DAG |
| 倉庫 N＝20 | N＝8 |

## 根目錄 `config.yaml`

鍵與 0.5.0 相同（本版 **不加** 新鍵）。倉庫提交預設：

```yaml
compact:
  max_turns_without_compact: 8
  recent_turns_to_keep: 3
  force_after_input_tokens: 100000
  force_after_jsonl_bytes: 400000
```

缺檔／缺鍵／型別錯 → 啟動失敗。測試可用 `VIBE_GAMEVERSE_CONFIG`。

## 兩個 scope（寫死）

| Scope | 觸發 | 做什麼 | 不做什麼 |
|-------|------|--------|----------|
| **NPC** | L2 id 離開 `present`（相對回合開始快照） | **有資格**才短呼叫 archive + distill；成功才改該 id 的 `archive/` 與 `current` | 不換活 jsonl；不 dispose；不改 `anchor_turn_n`；不改 `since_session_archive`；不動別人的 `l2/`；無資格則不開模型、該 id 檔不變 |
| **Session** | 強制線、或 `scene_id` 相對快照改變、或回合差 ≥ N | 複製 jsonl、summary、成功才換檔、dispose、新 session、opening | 不對「未離場且 body ＜640」開 archive 模型。本回已成功 NPC compact 的 id **不得**再跑 |

`near_cap`（≥640）**不是** NPC trigger。Session compact 時，在場且 distill 前 body UTF-16 **≥640** 的 L2 **必須**納入本拍 L2 短呼叫（與離場者、summary 並行）。未離場且 ＜640：**禁止**開 archive 模型。

### NPC 資格（離場 ≠ 必開模型）

離場只決定 **scope／對象 id**。開短呼叫還須同時成立（沿用 0.5.0 已定案 12 的品質門檻，對象改為該離場 id）：

1. `memory_tier === 2`（禁止對 L0／L1 建 `l2/`）
2. 本段該 id 曾可寫 body（event `actors` 或自己的 `npc_lines`）
3. 非整段僅 trivial、未改 `current`。程式判定「本段曾可寫」＝`current.updated_turn` 大於上筆 archive 的 `turn_to` 數字，**或**本回 `events.actors`／`npc_lines` 含該 id。不掃歷史 `episodes.json`。

「本段」＝自該 id **上一筆已存在 archive** 的 `turn_to` 之次回合（無 archive 則自開局 `t0001`）至本 `turn_id`。不以「是否仍在 `dirty.touched`」單獨否決離場者：若 2–3 成立，即使 `touched` 漏記仍開呼叫；若 2–3 不成立，即使在 `touched` 也 **跳過**。

跳過：不開短呼叫、不寫 archive、不 distill、不改該 id 的 `current`／`archive/`。仍不換 jsonl、不改錨點。

`turn_from`／`turn_to`：`turn_from`＝本段起點（上一筆 `turn_to` 的下一回合 id，無則 `t0001`）；`turn_to`＝本 `turn_id`。

## Session trigger 表（無 judge）

「回合開始快照」＝本回 GM **之前**讀到的 `scene.json`。Writer 先落盤新 `scene`，再判斷 compact。

熱路徑 **不**呼叫 `prompts/compact-judge.md`。檔可留 repo，不得掛 `runTurn`。

同一 HTTP 回合最多 **一次** session compact，命中任一：

1. **強制線**（讀法同 0.5.0）：summary 必須 `truncated: true`。
2. **換幕：** 本回 `scene.scene_id` 與快照 trim 後字串不相等。僅 `present`／`visible`／`gm_note` 變而 id 相同 → 不是本行。
3. **滿 N：** `(turnIdToN(turn_id) - anchor_turn_n) >= max_turns_without_compact`（倉庫預設 8）。無否決。失敗則錨點不變，之後差仍 ≥ N 再試。

`present` 進出只驅動 NPC scope，不驅動 session。僅進場、`scene_id` 不變：不 session、不對進場者做 NPC compact。

成功 session compact 後：`anchor_turn_n`＝本回合數字。僅 NPC compact（含跳過資格）：**不**改錨點。

非強制路徑的封存 title **只用** summary 模型產出的 title（無 judge title）。

## `session_archive_id` 與落盤時點

`NpcArchiveEntrySchema.session_archive_id` 可選，本版語意：

- **禁止**把尚未寫入 `session-archive/` 的 `sa_` 寫進 NPC archive。
- **NPC-only**（本回無成功 session）：省略該欄。
- **同回兩者：** NPC 檔可先提交且當時省略該欄。僅當 session compact **已成功寫入** `session-archive/{id}/` 之後，才把該已落盤 `archive_id` **補寫**進本回新建的 NPC archive 筆。若 session 隨後失敗：已提交的 NPC 筆保持省略，**不得**留下指向不存在目錄的 id。
- Session 拍為在場 ≥640 新建的 archive：同樣只在 session 換檔成功後填該欄；若採「與 session 暫存同一 scratch、整步成功才搬進活目錄」則可在搬入時一次寫上 id，失敗則連該在場 L2 的新 archive 也不進活目錄（在場 ≥640 屬 session 拍工作，失敗＝該拍這些 L2 新筆沒發生）。**離場 NPC scope 已先提交者不得因此回滾。**

## 一回合 DAG（ready、同一 `POST /api/turn`）

禁止背景 queue、禁止先回玩家再封、禁止家長 LLM 排步驟。平行＝program 同時開多個既有 scratch／`createAgentSession`。聚合必須 `Promise.allSettled`（或逐任務 catch）：單 id reject **不得**讓整個 `await` 拋掉而跳過其他離場提交、summary、或 session 決策。**禁止**裸 `Promise.all` 當失敗屏障。

NPC 檔提交與 session 換檔 **解耦**：離場 NPC 成功可在 session 結束前寫入活 `l2/`。換活 jsonl／dispose **只**在 session 整步成功之後。Opening 進**新**對局 session（建立於換檔成功之後），不寫入即將封存的舊 jsonl；並行階段只**等待** distill／summary 完成，不提前送 opening。

```text
GM JSON → Writer（世界＋記憶＋scene.json）
  → 同時開跑（allSettled）：
       離場且有資格的 L2：各一 archive／distill → 成功即提交該 id（可先於 session）
       若本回 session：summary
       若本回 session：在場且 body ≥640、且本回尚未因離場做完的 L2 各一 archive／distill
         （這些筆進活目錄綁在 session 成功，見上節）
  → 離場 NPC 失敗只回滾該 id，不取消上列其他節點
  → session 成功：換活 jsonl／dispose／建立新 session → 此時才送 opening（已等 summary 與會進活目錄的 distill）
  → HTTP 才回玩家
```

等待體感：有離場 NPC 時，玩家等到 `GM + max(離場 NPC, 若有 session 則另含 summary 與在場 ≥640)`。僅 session、無離場短呼叫：等到 `GM + summary +（在場 ≥640）+ opening`。

兩名以上離場有資格者：總等待趨近最慢一名（測可用 spy／注入延遲）。

## dirty-set 三結局（平行結束後合併寫一次）

Writer 本回合已把有寫記憶的 id 放進 `touched`。Compact 在 Writer 之後。`since_session_archive` 僅 session 成功時改。

| 結局 | `touched` | `since_session_archive` |
|------|-----------|-------------------------|
| **僅 NPC**（含部分離場失敗） | 每個 **成功** NPC compact 的 id **移除**。失敗或跳過的 id：失敗者不因失敗而假裝清掉（仍可留著）；跳過者不改該 id 是否在集合中（無新 archive）。其他人保留 | **不變** |
| **僅 session** | 清空後寫回「本回合 Writer 剛寫過的 id」，再 **減去** 本拍因在場 ≥640 而 **成功** distill 的 id | ＝本次 `archive_id` |
| **兩者** | 先套「僅 NPC」的成功移除，再套「僅 session」的清空寫回減去。**禁止**把本回已成功離場 NPC compact 的 id 再寫回 `touched` | ＝本次 `archive_id`（僅 session 成功時）。Session 失敗：等同「僅 NPC」列 |

`near_cap` 依本回實際提交的 distill 後 body 重算。

## 失敗解耦

| 失敗 | 該 scope | 另一 scope | 對局 Writer |
|------|----------|------------|-------------|
| 離場 L2 archive／zod／distill 仍 ≥640 | 只回滾**該 id**（不寫假 distill、不 `clipTail`、不留半套 archive） | session **照常** | 已落盤不回滾 |
| Session：summary／zod／複製／opening／在場 ≥640 寫入 | 該次換檔沒發生；在場 ≥640 新筆不進活目錄 | 已成功的 **離場** NPC compact **不**回滾 | 已落盤不回滾 |

禁止「任一離場 L2 失敗＝連 session 也不換」。多名離場：A 失敗不阻止 B 提交。

## Mock

`GM_MODE=mock` 給人玩：**不**因 N、換幕或離場自動跑 compact 短呼叫。強制線在給人玩路徑同樣不跑（避免 mock 無 jsonl 用量卻誤切）；**單測**可用注入或假大檔測強制線／session／NPC，不依賴給人玩自動觸發。Mock GM 仍須產出合法 `scene`。

## Debug／UI

不加 session／NPC 分鈕。Header／氣泡不變。失敗不向玩家解釋暫存。

## 測試 BAN

`VIBE_GAMEVERSE_KB_RUNTIME`。禁止 `rm` 專案 live `kb/runtime`。非成功 NPC／session compact 回合不得建對應新 archive 檔。熱路徑不讀 `compact-judge.md`。
