# 0.8.0 角色記憶：情景摘要與定位（廢對白金句）

- 上游：[0.7.0 多世界存檔](../0.7.0/INDEX.md)（`in progress`；本版假設 worlds／pointer 已可玩）
- 下一版：[0.9.0 回合處理中 UI](../0.9.0/INDEX.md)（`in progress`；不依賴本版出貨）
- 構想來源：原 `backlog/memory-situations.md`（出貨後已刪；**契約以本 INDEX＋docs 為準**）
- Changelog：根目錄 [`changelog.md`](../../../changelog.md)；同步 `VERSION.md` 與 `AGENTS.md`
- 狀態：`in progress`
- 日期：2026-09-09（Asia/Hong_Kong）

## 產品句

對「以前發生過的事」，角色與 GM 帶的是 **情景摘要** 和 **去哪份 session／哪段回合查** 的定位，不是沒頭沒尾的金句。對白全文只活在 `session-archive` 的 jsonl。本版允許大改 schema、回想與 compact 短呼叫；不 hop 舊存檔。

## 文件地圖

1. 本檔（WHAT）
2. [`docs/memory-situations.md`](./docs/memory-situations.md)（HOW）
3. [`docs/reasoning.md`](./docs/reasoning.md)（WHY）
4. 開工：[`HANDOFF.md`](./HANDOFF.md)

規格對照（勿當本版契約）：[0.4.0](../0.4.0/INDEX.md) 分層檔位、[0.5.0](../0.5.0/INDEX.md) 回想／archive 舊語意、[0.6.0](../0.6.0/INDEX.md) compact scope。心理欄另見 [0.10.0](../0.10.0/INDEX.md)，**本版不做**。

**上游路徑：** 錨點在「當前 active world 的 runtime」（`npcMemoryDir`／`sessionArchiveDir` 等）；不要求 0.7.0 狀態先改為 `shipped` 才可實作本版記憶契約。禁止 `rm` live `kb/worlds`。

**開工前仍須拍板：** 無（大改方向已鎖；實作細節以 HOW 為準）。

## 與上一版對照

| 行為 | 0.4–0.6 現行 | 0.8.0 |
|------|-------------|--------|
| 過去給 GM | NPC archive `summary` + 最多 3 條 `salient_quotes`；session 再掃 jsonl 剪行 | **只摘要 + 定位**。不餵 quotes、不餵 jsonl 殘句 |
| 對白 SoT | quotes 預摘；jsonl 另存 | **僅** `session-archive/{id}/session.jsonl` |
| NPC archive 短呼叫 | 必出 quotes；speaker 錯則整步／該 id 失敗 | 出 `title`／`summary`／定位／`distilled_body`。**禁止**再產 quotes |
| 回想打開 | 最多 2 份細節，每份最多 3 段原文 ≤120 | 最多 2 份，每份＝summary 全文 + locator 行。**零**原文段 |
| 離場／已死角色 | 回想偏好**在場** L2 | 玩家點名（名或 id）即可打開該角 archive，**不**要求仍在 `present` |
| 舊存檔 | — | **不 hop**。讀舊檔時忽略 `salient_quotes`；新 compact 不寫該欄 |

## 已定案

1. **範圍。** 重寫「過去記憶」的 **內容契約與回想輸入**。保留：L0／L1 池、L2 `current`、離場才 NPC compact、session compact 兩個 scope、Writer 不讀 jsonl、不每 NPC 長活 pi、不對玩家 HTTP 輸出 `npc_memories`／回想。不做心理深度、不做歷史 UI、不給對局 GM 讀檔 tool。
2. **三層職分（大改後仍三層，職分改寫）。**
    - **在場工作記憶**＝`npc_memories`（池 body 或 L2 `current.body`）：**此刻**還要帶著的情景與態度，不是台詞清單。
    - **已封情景**＝L2 `archive/` 各筆：該角對那一段的主觀摘要 + locator。
    - **場次紀錄**＝`session-archive/`：`summary.json` 為世界側情景；jsonl 為對白全文。禁止把 jsonl 複製進每個 NPC 目錄。
3. **廢 GM 側金句。** 刪除 compact 模型對 `salient_quotes` 的產出。zod：**新寫入**的 NPC archive entry **省略** `salient_quotes` 鍵（不得再必填）。舊檔 parse：該欄 **strip／忽略**，不因此 `needs_setup`；回想永不餵其 text。
4. **定位欄必填（新寫入）。** 每筆 NPC archive：`turn_from`、`turn_to`（既有）；`session_archive_id` 僅當同拍或既有 `session-archive/` 已落盤才填（維持 0.6.0：禁止懸空 `sa_`）。無 `session_archive_id` 時 locator 仍寫回合範圍（格式見 HOW）。Index 必須能被回想用來打分：每筆存 **title + summary**（或 summary 截斷），禁止再只掃 title「灰」。新 index **刪** `quote_count`；保留 `body_chars`＝該筆 summary 的 UTF-16 length。
5. **回想餵 GM 的形狀（寫死）。** context 欄名實作自決（沿用 `archive_excerpts` 或改 `past_index` 皆可；對玩家仍不輸出）。每份只含：
    - kind、id（`sa_*` 或 `na_*`）、可選 `npc_id`
    - locator 一行：有 `sa_*` 則含之；無則僅 `npc_id · t0001–t0007`（見 HOW）
    - `summary` 全文（既有 1–800 上限）
    **禁止**附加 quote 列表、禁止附加 jsonl 剪出的行。Session 命中同樣只餵 `summary.json` 的 body + locator，**不再** `excerptJsonl`。
6. **啟發式仍 program、不另開分類模型。** 在 GM 前跑；命中任一支即掃（細節與詞表見 HOW）：
    - **（i）** 詞表「問舊事」子字串；
    - **（ii）** 點名盤上 entity 且該名／id 只在 archive、不在近 8 episode；
    - **（iii）新增：** `player_text` 含某 `memory_tier === 2` 的名或 id，且該 id 已有 archive index 筆 → **即掃並可打開**該角，**不**要求 `present`，**不**要求該名缺席於近 8 episode（「灰怎麼了」在有檔時可召）。
    **推翻** 0.5.0「僅在場 L2 才開 NPC」。總數 ≤2。選槽：
    - 點名多名 L2 皆有 archive → 取 `player_text` 中**最先出現**名／id 者佔 NPC 槽 1；
    - 優先：該 NPC archive 1 + 分數最高 session 1；
    - **Session 候選**＝本回合已載入並打分的 session hit 集合非空（含 score＝0）；
    - 有 session 候選 → **禁止**兩槽皆 NPC；無則第二槽可為另一 NPC archive 或省略；
    - **未點名任一 L2** → 最多 2 份 session；不得開 NPC。
7. **Compact NPC 短呼叫。** Prompt 改為：主觀情景 summary（發生什麼、誰在場、結果、該角態度／未了之事），**禁止**要「名句」。`distilled_body` 仍必須 ＜640，內容＝**現在還帶著的工作記憶**（例如「我已死／已離場」可極短），不是再貼金句。Speaker 校驗刪除。
8. **日常 Writer。** 仍機械、不讀 jsonl。組 body 時寫 **情景短句**（誰做了什麼），**禁止**整段抄 `npc_lines`。Track C 客觀測規：注入的 `npc_lines[].text` **不得**原樣整段出現在寫入後的 `current.body`。不在每回合開模型 distill current。
9. **不 hop。** 不 migrate live worlds。測試用新目錄。舊 `na_*` 回想只讀 summary＋回合欄。
10. **Index 打分。** `overlapScore` 對 NPC 必須用 **title 與 archive summary**（打開細節前 index 就要有 summary；summary 寫進 `archive/index.json`）。

## 開工前仍須拍板

無。

## 非目標

- 對局 GM 呼叫 tool 自己開 jsonl
- 每回合掃全部 archive 或餵全部 summary
- 心理欄、多地點、歷史產品 UI
- 舊 `kb/runtime` 或舊 quotes 的 hop
- 改變 0.6.0 NPC／session scope 觸發表（離場封 NPC、滿 N／換幕／強制線封 session）

## 驗收

- [x] 新 NPC compact 落盤**無** `salient_quotes` 鍵；GM context 不含 quote 正文。
- [x] 回想命中 NPC archive：GM context 含 summary 與 `t00xx` locator（有 `sa_*` 則一併出現；無則省略 sa 段），**不含** quote 正文。
- [x] 回想命中 session：含 `summary.json` body，**不**含 jsonl 剪句。
- [x] 僅閘門（iii）：玩家點名已離場／不在 `present` 的 L2（有 archive）→ 仍可召到該角 archive summary（即使該名出現在近 8 episode、且無詞表）。
- [x] Compact 短呼叫因假 quotes／錯誤 speaker **不再**導致該 id 失敗（prompt＋zod 已無該欄）。
- [x] Writer：注入台詞字串不得原樣整段進 `current.body`。
- [x] `bun test` 全綠；出貨 VERSION＝`0.8.0`。

> 狀態維持 `in progress`：驗收與測試已過，**待使用者同意出貨**後才改 `shipped`／commit。
## 實作軌道

### Track A — Schema 與 compact 短呼叫

- **做：** archive zod／prompt／寫入；index 帶 summary；廢 quotes 產出與 speaker 校驗。
- **不做：** 回想組裝（B）。

### Track B — 回想

- **做：** 組 past 字串；刪 `excerptJsonl` 熱路徑；離場點名可召；打分用 summary。
- **驗收：** 單測無 quotes／無 jsonl 行；離場點名命中。

### Track C — 測試與出貨文件

- **做：** 改 0.5.0 測規；changelog／AGENTS；出貨刪 backlog 本列。

## 錨點檔案

| 路徑 | 用途 |
|------|------|
| `program/recall.ts` | 廢 jsonl 摘句與 quotes；改 locator＋summary |
| `program/schema.ts` | `NpcArchiveEntrySchema`／index |
| `program/compact.ts` | 短呼叫輸出 |
| `prompts/compact-npc-archive.md` | 禁名句、要情景 |
| `program/writer.ts`／`npc-memory.ts` | 日常 body 仍情景短句 |
| `docs/roadmap/0.5.0/` | 本版推翻的回想／quotes 句 |

## 行為約束

- 繁體中文書面語；不 commit 除非使用者要求。
- 勿 `rm` live `kb/worlds`。例證虛構。
