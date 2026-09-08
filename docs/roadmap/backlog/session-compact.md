# Session compact：劇情段落壓縮、archive、回溯

**狀態：** backlog 構想，**尚未排入任何 `docs/roadmap/X.Y.Z/`。** 不是承諾範圍；排程前須再開規劃對話收斂已定案。

**現行：** 0.2.0 已 shipped。對局 GM 接續同一 pi session；`kb/runtime/pi-sessions/*.jsonl` 只增不壓。`AGENTS.md` 寫明 compact 尚未做。`docs/brainstorm.md` §5.2 與 `docs/handover.md` 有早期一句（token／換場／每 N 回合），本檔取代那些一句當「之後要談的題」，**不**覆寫 0.2.0 契約。

**隱私：** 例證皆虛構；勿把 live `kb/runtime` 對白寫進日後 INDEX。

---

## 產品句（構想）

長局不要把全部 GM 對白永遠塞進同一 session：在**有意義的劇情段落結束**時（必要時在 **token 將滿**時強制）把舊 jsonl **archive**，開新 session，帶入本段摘要與現行 `gm_note`／場景；若玩家後來回想起某一刻，要能 **reference 到對應 archive** 再撈細節，而不是只剩一句總摘要。

---

## 現行行為（錨點）

| 層 | 現在做什麼 | 與 compact 的關係 |
|----|------------|-------------------|
| pi session | `program/gm-pi.ts`：`prompt()` 疊在同一 `AgentSession`；ready 重啟 `continueRecent` | compact 後必須 **dispose + 新 session**，不能繼續同一 jsonl 當「活的」歷史 |
| 落盤 | `kb/runtime/pi-sessions/*.jsonl`（pi 寫） | compact 會讓「現行 session 檔」被換成新檔；舊檔不可丟 |
| 每回合短 context | `player_text`、`gm_note`、`scene`、`memory_slice`（近 **8** 則 episode 摘要 + 全 entities／relations） | 這不是 compact；KB 切片與 session 全文是兩條記憶 |
| Writer | 只吃本回合 `events[]` → episodes／entities／relations | compact **前**仍應先落本回合 KB（舊 brainstorm 已寫） |
| 場景 | 0.2.0 **單場景**契約仍在；`scene_id` 可變（地點 id），但沒有多地點狀態機 | 「換房間」在產品上可能只是同一場戲的走動，**不足以**當 compact 條件 |

觀察（可行性，非正式 API 契約）：現行 jsonl 的 assistant `message` 列已帶 OpenRouter／pi 的 `usage`（`input`／`output`／`totalTokens` 等）。這是**單次呼叫**用量，可用來估「下一回合 input 大概多大」，**不是**模型剩餘 context 的官方欄位。

---

## 腦暴：兩條 trigger

### 正常流程 — 段落／場景意義上的轉換

不要用 code 寫死「`scene_id` 一變就 compact」或「每 12 回合就 compact」。

進出隔壁房間、走到吧檯另一側、NPC 短暫離場再回來——往往仍是**同一場戲**，立刻 compact 會把剛講完的語氣、未說完的謊、桌上那封信的用詞切掉，得不償失。

傾向：**備一份獨立 prompt**，另開一次短的 pi-agent 呼叫（對局 session **不要**順便問「要不要 compact」，以免污染 GM JSON 契約），讓模型輸出結構化判斷，例如：

- `should_compact`: boolean
- `beat_kind`: 如 `same_beat` / `soft_transition` / `hard_beat`（名稱待拍板）
- `reason`: 給 log／archive 索引用的短句，不是給玩家看
- 可選 `title`：這一段 archive 的人讀標題（虛構例：「廣場爭論結束、進入公會櫃台」）

Judge 的輸入傾向（未定案）：本回合 `events[]`／`gm_note` 前後、`scene` 差、近幾則 episode 摘要、**不要**整份 jsonl。目標是便宜、穩定、可 zod。

**何時問 judge：** 每回合都問會加延遲與費用；只在 `scene_id` 變才問又會漏「同地點但幕已換」（例如同一酒館從寒暄變成對質）。待拍板：每回合 / 每 N 回合 / scene 或 `present` 有變才問 / GM 輸出加 `beat_hint` 再問。

### 強制流程 — token 將滿

正常 judge 說「還不用」時，若下一回合很可能塞不進 context，仍須 compact。

**可行性研究（排程前必做，本檔只記題目）：**

1. **訊號從哪來**
   - jsonl 最後一則 assistant 的 `usage.input`（含 system＋歷史）是否已接近該模型 context。
   - 估算：現行 jsonl 全文 char／token 粗算 vs 官方 context。
   - pi-agent 是否另有 remaining-context／compact API（開工前查 `@earendil-works/pi-coding-agent`，**不要**猜有內建 compact 就依賴它）。
2. **閾值怎麼定**
   - 須對 `PI_MODEL`（預設 DeepSeek V4 Flash via OpenRouter）查 **context window** 與 **實際可穩定的 input 上限**（provider 常比標稱更緊）。
   - 預留本回合 `GmContext` JSON、system prompt、輸出預算；「快滿」≠ 100%。
   - cache 欄位（`cacheRead`／`cacheWrite`）是否讓 `input` 語意與「歷史有多長」不一致，避免誤判。
3. **失敗模式**
   - 用量欄缺失（mock、舊 jsonl、provider 不回 usage）→ 必須有後備（檔案大小、訊息則數、char 上限）。
   - 強制 compact 與 judge「同幕」衝突時：**強制優先**，但 summary 仍要寫清「同幕被截斷」。
   - compact 過程中又爆 token（summary 呼叫自己太長）→ summary 不得把整份 jsonl 當 prompt；應吃 `gm_note` + 近 episode + 可選 jsonl **尾端**。

強制路徑 **跳過**「可不可以不壓」的 judge 否決權；仍可跑同一套 archive＋新 session 管線。

---

## 腦暴：archive 與接續

Compact 不是刪記憶，是把「活 session」換成「冷檔 + 一段接續摘要」。

### 建議目錄（路徑名待拍板）

在 `kb/runtime/` 下另開 folder（**不要**與對局 `pi-sessions/` 混寫），例如：

```text
kb/runtime/session-archive/
  index.json          # 有序列表：archive_id、來源 jsonl 檔名、turn 區間、beat title、summary 路徑
  {archive_id}/
    session.jsonl     # 從 pi-sessions 移入或複製後再開新 session
    summary.md        # 或 .json：本段接續摘要（給新 session 的「剛發生的事」）
```

「新遊戲」清空 runtime 時須一併清 archive（與現行清 `pi-sessions` 同命運）。測試仍走 `VIBE_GAMEVERSE_KB_RUNTIME`，禁止 `rm` live runtime。

### Compact 當下要留下什麼（接新 session）

舊 handover 一句：GM note、在場誰、未決鉤子、本場目標。本構想補一層 **本段 summary**（剛結束的那一幕發生了什麼、氣氛、未出口的承諾），寫進 archive，並作為新 session 的第一段 context（system 附加或第一則 user 說明「以上為已封存段落，細節見 archive_id …」）。

新 session 的 system 仍依現行 `world.source` 組 contract＋canon（與 0.2.0 已定案 24 一致），**不要**把整份舊 jsonl 貼回 system。

### 與既有 episode 摘要的分工

| 產物 | 粒度 | 誰寫 | 給誰吃 |
|------|------|------|--------|
| `events[].summary` → episodes | 單回合 | Writer（程式） | 每回合 `memory_slice` 近 8 則 |
| compact **beat summary** | 一段 session（多回合） | compact 管線（模型，待拍板） | 新 session 開場；index |
| entity／relation | 世界事實 | Writer | memory_slice 全量（現行） |

不要讓 beat summary 取代 Writer；也不要以為近 8 則 episode 能代替「三小時前的原句」。

與 [NPC 專屬記憶檔](./npc-memory-files.md)／[0.4.0](../0.4.0/INDEX.md)：**現用記憶在 0.4.0；archive 落盤在本項。** 0.4.0 已鎖 L2 路徑 `npc-memory/l2/{id}/current.json` 與 archive zod。本項實作 compact 時按該 HOW 寫 `archive/`，掃 `dirty-set.json` 且只處理 L2。不要另發明目錄。

---

## 腦暴：回想時找回 archive

玩家或 NPC「回想起某一刻」時，只有 beat summary 往往不夠（需要當時怎麼措辭、誰在場、那張單上寫什麼）。

傾向：

1. **Index 可檢索**：`archive_id`、turn_id 起迄、scene_id、entity_ids、短 title／summary。
2. **不要每回合灌全部 archive。** 預設仍只吃 memory_slice + 現行 session + 最近一次 beat summary。
3. **按需 reference：** 某步（GM 輸出 `recall_archive_ids`，或另一次小 retrieval 呼叫，或 program 用關鍵詞／entity 對 index 打分）決定打開哪些 `session.jsonl`／summary，把**相關摘錄**（不是整檔）餵進**當回合** GM。摘錄規則待拍板（過長要再 distill）。
4. **引用要穩定：** compact 後 jsonl 路徑會變；對局與 Writer 應記 `archive_id`，不要記「當時的 pi-sessions 檔名」。

失敗模式：retrieval 找錯幕、把 NSFW／密談塞進無關回合、index 與檔案不一致。約束仍須 prompt + zod，不能只靠模型。

---

## 與舊一句設計的差異

| `brainstorm.md` §5.2 | 本構想 |
|----------------------|--------|
| trigger：token／換場景／每 N 回合 | 正常＝**智能段落判斷**；強制＝token；**明確反對**瑣碎換場與寫死 N |
| compact 後留 GM note／在場／鉤子／目標 | 同上，另加 **beat summary + archive 檔 + index** |
| 換場可開新 session | 開新 session 綁 compact，不綁每一次 `scene_id` 變更 |
| （未寫）回溯原對白 | 要能按 archive_id 找回當時 context |

---

## 非目標（構想階段就寫死邊界）

- 不排入本檔所屬的任何已出貨版本；**不要**當 0.2.x hotfix。
- 不做多存檔槽、不做玩家可瀏覽的「對話歷史產品 UI」（program 有 archive 即可；UI 以後再說）。
- 不把 Engram／私人庫當 archive。
- 不改「Writer 不讀聊天逐字稿」——回溯是 **GM 熱路徑按需讀 archive**，不是 Writer 重讀 jsonl 改 KB。
- 不做大地圖／多地點狀態機；compact 不是旅行系統。
- 不在對局 GM 的 JSON 契約裡塞整份舊對話。

---

## 開工前仍須拍板（未定案）

1. Judge 呼叫頻率與是否獨立 session。
2. Beat 標籤枚舉與「強制仍寫 summary」的最低欄位。
3. `session-archive/` 精確檔名、index schema、與 `pi-sessions` 是 move 還是 copy。
4. Token 強制：usage 欄 vs 粗估 vs pi API；閾值公式；缺 usage 後備。
5. 新 session 第一則要餵哪些字（summary 長度上限）。
6. 回想：誰觸發 retrieval、一回合最多打開幾份 archive、摘錄上限。
7. Compact 失敗（summary JSON 壞、搬檔失敗）時：中止回合 vs 繼續舊 session。
8. Mock 模式要不要假裝 compact（測試用 fixture archive）。
9. **角色記憶 archive 落盤（本項實作；格式以 0.4.0 為準）：** 對讀 [0.4.0 INDEX](../0.4.0/INDEX.md) 與 [HOW](../0.4.0/docs/npc-memory.md)。路徑為 `npc-memory/l2/{npc_id}/archive/`（**不是** `npc-memory/{id}/`）。濾 `dirty-set.touched` 時只要 `memory_tier === 2`。同一 beat 寫 `npc_archive_id`、distill `current.json`、填 `session_archive_id`；L0／L1 無獨立 archive；禁止複製整份 jsonl。NPC 寫入失敗是否回滾 session archive 仍須拍板。可選 judge 訊號：L2 離開 present。

排進某版時：本檔 ↔ 該版 INDEX **雙向連結**；該版須另寫自足 INDEX／docs／reasoning。本檔本身**不夠**當 HANDOFF。

---

## 錨點檔案（日後實作才改；現在只讀）

- `program/gm-pi.ts` — session 生命週期、`prompt`、jsonl 目錄
- `program/turn.ts` — 一回合順序（Writer 相對 compact 的插入點）
- `program/kb.ts` — runtime 路徑、new-game 清空清單、`buildMemorySlice`
- `program/schema.ts` — 若加 judge／recall 欄位
- `kb/runtime/pi-sessions/` — 現行活 session（測試勿刪 live）
- `docs/brainstorm.md` §5.2、`docs/handover.md` 熱路徑一句 — 舊構想
- `docs/roadmap/0.4.0/docs/npc-memory.md` — archive **schema 與目錄**（0.4.0 不寫檔）；本項負責觸發與落盤
- `docs/roadmap/backlog/npc-memory-files.md` — 構想原文
