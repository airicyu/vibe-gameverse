# 0.8.0 HOW — 情景記憶與回想輸入

契約以 [INDEX](../INDEX.md) 為準。

## NPC archive 新寫入

```json
{
  "npc_archive_id": "na_ash_001",
  "npc_id": "ash",
  "session_archive_id": "sa_001",
  "turn_from": "t0001",
  "turn_to": "t0007",
  "title": "字條未交、酒館流血",
  "summary": "……主觀情景，1–800……"
}
```

- 可選 `session_archive_id` 規則同 0.6.0。
- **不得**寫入 `salient_quotes` 鍵。讀舊檔：多餘該欄 **strip 後當合法**；缺省亦合法。
- Speaker／quotes 校驗刪除。

`archive/index.json` 每筆至少：

| 欄 | 新寫入 |
|----|--------|
| `npc_archive_id` | 必填 |
| `session_archive_id` | 可選（同 entry） |
| `turn_from`／`turn_to` | 必填 |
| `title` | 必填 |
| `summary` | 必填（可與檔內同文或截斷；打分必須看得到情景詞） |
| `body_chars` | 必填；＝該筆 `summary` 的 UTF-16 length |
| `quote_count` | **刪除**；新 schema 不收此欄。讀舊 index：忽略多餘 `quote_count` |

## Compact 短呼叫 JSON

`title`、`summary`、`distilled_body`。無 `salient_quotes`。zod 多欄可忽略。`distilled_body` UTF-16 ＜640。

## 啟發式掃檔閘門（任一支即掃）

在**本回合 GM 之前**跑；只用 `player_text`、盤上 entities、近 8 則 episode、已存在 archive index。**不得**用本回合 `events[]`／`npc_lines`。

詞表（同 0.5.0）：

`當時`、`那天`、`上回`、`上次`、`你說過`、`他說過`、`她說過`、`記得嗎`、`那時候`、`先前記`

- **（i）** `player_text` 含子字串命中詞表。
- **（ii）** `player_text` 出現盤上某 entity 的名或 id，且該名／id 出現在某筆已存在 archive 的 title／summary，且該名／id **不**出現在近 8 則 episode `summary` 正文。
- **（iii）** `player_text` 含某 `memory_tier === 2` 的 `name` 或 `id`，且 `npc-memory/l2/{id}/archive/` 已有至少一筆 index → **即掃**。不要求 `present`，不要求該名缺席於近 8 則 episode。

未命中任一支 → 不掃、不餵 past。

## 打開優先（總數 ≤2）

**Session 候選**＝本回合已載入並打分的 session index hit 集合**非空**（含 score＝0；只要磁碟 index 有列入本回合 ranking 的 `sa_*`）。

1. **點名 L2（多名時）：** 在 `player_text` 中**最先出現**其 `name` 或 `id` 的那個 L2（皆須有 archive）。該角分數最高的一筆 `na_*` 佔 **1** 槽。
2. 其餘槽優先填分數最高的 **session** `sa_*`。
3. **未點名任一 L2：** 最多 2 份 session（打分排序）；**不得**開 NPC archive。
4. 點名後無 session 候選：第二槽可填另一 NPC archive（分數次高），或留空。
5. 點名後有 session 候選：**禁止**兩槽都是 NPC。

## 回想組給 GM

啟發式命中後最多 2 份。欄位名實作可自決（`archive_excerpts` 或 `past_index`）；對玩家 HTTP 仍不輸出。

有 `session_archive_id`：

```text
[archive npc na_ash_001] ash · t0001–t0007 · sa_001
<summary>
```

無 `session_archive_id`（省略 sa 段）：

```text
[archive npc na_ash_001] ash · t0001–t0007
<summary>
```

Session：

```text
[archive session sa_001] t0001–t0008
<summary.json body>
```

`program/recall.ts` 刪熱路徑 `excerptJsonl`。Locator 從 index／entry 欄組字串，不另開模型。**零** quote 列表、**零** jsonl 剪行。

## Writer 日常 body（測規）

組 L2 `current.body`／池 body 時：情景短句（誰做了什麼）。單測至少一條：注入的 `npc_lines[].text` **不得**原樣整段出現在寫入後的 `current.body`（允許摘要提及事件，禁止 verbatim 整句台詞）。
