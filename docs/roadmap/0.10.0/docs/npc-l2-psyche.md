# 0.10.0 HOW — L2 NPC 心理深度

契約以 [INDEX](../INDEX.md) 為準。

## 檔案位置

```text
npc-memory/l2/{npc_id}/
  current.json    # 經歷 body（既有）
  psyche.json     # 本版新增
  archive/        # 既有
```

**禁止**把 psyche 併入 `current.json`。

## psyche.json 形狀

```json
{
  "npc_id": "bartender",
  "disposition": "話少、帶刺，用問題擋問題",
  "life_goal": "守住酒館與熟客的安穩",
  "mid_goal": "別讓北路話題把店裡捲進麻煩",
  "short_goal": "照顧吧台，少讓人注意到角落的灰",
  "likes": "熟客、乾淨杯子、不追問的人",
  "dislikes": "當眾追問北路、鬧事、逼她表態"
}
```

| 欄 | 上限（UTF-16） | 說明 |
|----|----------------|------|
| `disposition` | 200 | 氣質／防衛；比 `persona` 更短、更內在 |
| `life_goal` | 200 | 長年方向 |
| `mid_goal` | 200 | 本場弧／季節性 |
| `short_goal` | 120 | 今晚／數回合 |
| `likes` | 200 | 短列或一句 |
| `dislikes` | 200 | 短列或一句 |

- 六欄皆可 `""`。
- Parse 後 clip 超限；不因此 fail turn。
- 讀取無檔：記憶體 `{ npc_id, 六欄 "" }`；不強制寫碟。

## Default 預製（`commitDefaultWorld`）

產品字串（虛構；可微調用字但 **語意** 須保留）：

**bartender**

| 欄 | 內容 |
|----|------|
| disposition | 話少、帶刺，用問題擋問題 |
| life_goal | 守住酒館與熟客的安穩 |
| mid_goal | 別讓北路話題把店裡捲進麻煩 |
| short_goal | 照顧吧台，少讓人注意到角落的灰 |
| likes | 熟客、乾淨杯子、不追問的人 |
| dislikes | 當眾追問北路、鬧事、逼她表態 |

**ash**

| 欄 | 內容 |
|----|------|
| disposition | 少露臉，句子短，不先交底 |
| life_goal | 把該辦的事辦完就離開，不拖入他人冒險 |
| mid_goal | 找一個不張揚的人收下蠟封紙條 |
| short_goal | 觀察進店的人，還沒決定要不要推紙條 |
| likes | 安靜角落、不組隊的對話、守口如瓶的人 |
| dislikes | 被當成守燈人、被拉隊、當眾逼問身分 |

不得把 `private_notes` 原文貼入任一欄。

## promoteToL2（Writer）

成功 `saveL2Current` 後：

```json
{
  "npc_id": "<id>",
  "disposition": "",
  "life_goal": "",
  "mid_goal": "",
  "short_goal": "",
  "likes": "",
  "dislikes": ""
}
```

同 try 區塊；失敗則與現行 promote 回滾一致（刪 `l2/{id}/`）。

## npc_memories 餵 GM

L2 snippet 形狀：

```json
{
  "npc_id": "bartender",
  "tier": 2,
  "body": "……近事……",
  "psyche": {
    "disposition": "……",
    "life_goal": "……",
    "mid_goal": "……",
    "short_goal": "……",
    "likes": "……",
    "dislikes": "……"
  }
}
```

L0／L1：**無** `psyche` 鍵。

## gm-contract 增補（摘要）

在既有 `npc_memories` 段後追加（繁中或英皆可，須寫死優先序）：

- `psyche`＝動機／好惡；`persona`（system）＝語氣；`body`＝近事。
- 寫 `npc_lines` 時：動機看 `psyche`；口吻看 `persona`；事實與態度看 `body`。
- `short_goal`＋`body` 可蓋過過時 `mid_goal`；勿因一回合翻 `disposition`／`life_goal`。

## NPC compact — psyche distill

**時機：** **僅**離場 scope：在 `applyAutoCompact`（或等價）的 **`departedWrites` 迴圈**內，單次 `commitNpcWrite` 成功之後，對該 write 的 `npc_id` 呼叫。**禁止**掛在共用 `commitNpcWrite` 函式尾（否則 session 的 `sessionNpcWrites` 也會誤更新 psyche）。Session compact 的 `sessionNpcWrites` **不**呼叫 psyche distill。

**Prompt 檔：** `prompts/compact-npc-psyche.md`

**模型輸入（JSON 或等價結構）：**

- `npc_id`、`name`
- `prior_psyche`：compact 前六欄
- `archive_title`、`archive_summary`：本段新 archive
- `distilled_body`：剛寫入的 `current.body`
- 可選 `persona_excerpt`：entity `persona` trim 後前 400 UTF-16（僅語氣錨）

**模型輸出：** 單一 JSON 物件，鍵同六欄 + `npc_id`。

**規則（寫進 prompt）：**

- 依 archive／distilled_body 更新 `mid_goal`／`short_goal`／`likes`／`dislikes` 為主。
- `disposition`／`life_goal` 僅在 archive 有 **明確** 長期轉折時才改；否則 **複製** `prior_psyche` 原值。
- 禁止貼 `npc_lines` 全文；禁止世界地圖／任務系統。
- 輸出 clip 至欄位上限。

**失敗：** log；保留 compact 前 `psyche.json`；archive 與 `body` distill **不回滾**。

**Mock：** 與 `modelNpcArchive` 同級：`mockPlaySkipsAutoCompact` 為真則整段 compact（含 psyche）skip；管線有跑時用 fixture／test hook。

## near_cap

`current.body.length >= 640` 邏輯不變；**不**讀 psyche 長度。

## 測試要點

- Default setup 後兩份 psyche 存在且欄位符合上表。
- `assembleNpcMemories` L2 含 psyche；L1 不含。
- promote 1→2 六欄空。
- compact mock 後 psyche 有更新（**離場** scope；或 hook 断言呼叫）。
- session compact 含 near_cap `sessionNpcWrites` 時 psyche **不變**。
- promote 1→2：`saveL2Psyche` 失敗回滾同現行 promote。
- psyche distill throw 時 archive 仍在。
