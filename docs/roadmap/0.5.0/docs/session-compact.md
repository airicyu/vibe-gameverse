# 0.5.0 HOW — compact 路徑與一回合

對照：[`../INDEX.md`](../INDEX.md)。常數以 INDEX 已定案為準。

## 根目錄 `config.yaml`

開機讀倉庫根目錄（測試可設 `VIBE_GAMEVERSE_CONFIG` 指向隔離檔，**不要**默默缺檔當預設）。zod：

```ts
{
  compact: {
    max_turns_without_compact: z.number().int().positive(),
    recent_turns_to_keep: z.number().int().min(1).max(10),
    force_after_input_tokens: z.number().int().positive(),
    force_after_jsonl_bytes: z.number().int().positive(),
  }
}
```

倉庫提交的預設值見 INDEX 已定案 8。解析 YAML：Bun 可 `Bun.YAML.parse` 或等價；失敗＝啟動失敗。

## 目錄

```text
{kbRuntimeDir}/
  play-sessions/                 # 活對局 jsonl（原 pi-sessions）
  compact-state.json             # { "anchor_turn_n": 0 }；setup 寫 0
  session-archive/
    index.json
    sa_001/
      session.jsonl
      summary.json
  npc-memory/l2/{npc_id}/
    current.json                 # 本版不截 800
    archive/                     # compact 才有
      index.json
      na_bartender_001.json
  compact-scratch/               # 可選暫存；結束必刪；禁止當活 session
```

開機遷移：`pi-sessions/` 存在且 `play-sessions/` 不存在 → `rename`。兩者都存在 → 用 `play-sessions/`，留下 `pi-sessions/`，禁止合併或自動刪舊。`clearPlaythrough`：`rm` `play-sessions`、`session-archive`、`compact-scratch`、`npc-memory`（後者 0.4.0 已做），並刪 `compact-state.json`。

生成 job：臨時目錄名例如 `{jobDir}/generate-sessions`，**不得**叫 `pi-sessions`。

`archive_id`：`sa_`＋至少三位數，單調遞增（下一個＝現有 max＋1，補零到至少 3 位）。

## `session-archive/index.json`

```json
{
  "entries": [
    {
      "archive_id": "sa_001",
      "turn_from": "t0001",
      "turn_to": "t0020",
      "title": "廣場爭論結束",
      "truncated": false
    }
  ]
}
```

`turn_from`／`turn_to`：與對局 `turn_id` 相同字串。例證虛構。

## `summary.json`

```json
{
  "archive_id": "sa_001",
  "turn_from": "t0001",
  "turn_to": "t0020",
  "title": "…",
  "body": "…",
  "truncated": false
}
```

`body` UTF-16 **1–800**（空非法）。強制路徑 `truncated` 必須 true。

NPC archive 欄位仍完全依 [0.4.0 HOW](../../0.4.0/docs/npc-memory.md) 的 `NpcArchiveIndexSchema`／`NpcArchiveEntrySchema`。

## 一回合順序（ready 之後）

1. 組 `GmContext`（含 `npc_memories`、可選本回合回想摘錄——**回想發生在 GM 之前**，見下）。本步讀到的 `scene.json` 即「上回合／本回合開始」快照。
2. GM → parse（**必含** `scene`）→ Presenter。缺 `scene` 則回合失敗，不 Writer、不 compact。
3. `writeFromGm`（世界＋NPC 記憶＋**寫入新 `scene.json`**）。L2 current **不**截 800；`near_cap` 仍 ≥640。寫 dirty 時 **保留**已有 `since_session_archive`，不得寫死 null。
4. 若強制線命中 → compact（跳過 judge）。
5. 否則若 `present` 成員相對步驟 1 快照有進出，**或** `(current_n - anchor_turn_n) >= N` → judge。僅當本步是因 (b)（回合差 ≥ N）而問、且 `should_compact === false`，把 `anchor_turn_n` 寫成本回合數字（(a)+(b) 同回且否決亦改錨點；僅 (a) 否決不改）。**禁止**寫「N 未滿且 judge 否」。
6. compact 成功才開新 session，並把 `anchor_turn_n` 寫成本回合數字；開場第一則見 INDEX 已定案 11。
7. compact 與 GM **同一 HTTP 回合尾**：玩家先看到本回合呈現，封存是幕後。不要先封再讓本回合 GM 跑在新 session（本回合 GM 已結束）。

**回想（步驟 1）：** 只根據 `player_text` 與盤上 entities 的名／id 對**已存在** archive 掃（不含本回合結束後才會寫的那一拍）。不用本回合 events／台詞。

## 強制線怎麼讀

- 時機：本回合 GM 已結束且已寫入活 jsonl 之後（與 HOW 步驟 4 同一拍）。
- 讀活 `play-sessions/` 最新 jsonl **最後一則** assistant 訊息的 `usage.input`（若結構不同，對齊實際 jsonl 欄位，單測用 fixture）。此則即剛結束的本回合 GM，不是再往前一則。
- 缺 usage → `stat` 該檔 `size` ≥ `force_after_jsonl_bytes`。
- 比較用「已經發生」，不要估算下一回。

## Judge／summary 呼叫

獨立 session：`noTools`、臨時 `sessionDir`（scratch），結束刪。Prompt 放 `prompts/compact-judge.md`、`prompts/compact-summary.md`、`prompts/compact-npc-archive.md`。Judge 輸入 episode＝近 **8** 則（與 `memory_slice` 同）。Summary 輸入：`gm_note`、近 episode、jsonl **尾端**（可與 `recent_turns_to_keep` 同級或稍長，**禁止**整份 jsonl）。標題規則見 INDEX 已定案 19。輸出 zod。失敗＝整步 compact 失敗。

NPC archive：資格內每個 L2 一次短呼叫（可共用同一 scratch 根目錄的子目錄）；輸出須通過 0.4.0 `NpcArchiveEntrySchema`，且 distill `current.body` UTF-16 **＜640**。仍 ≥640 或 zod 壞＝整步回滾，**不得** `clipTail`。

Mock 對局：judge 預設視為 `should_compact: false`，除非測試注入。強制線仍可測（假大檔）。Mock GM **必須**產出合法 `scene`（可原樣回傳 context.scene，除非測試要模擬進出）。

## 回想啟發式（程式）

玩家 `player_text` trim 後含下列**子字串**之一（大小寫不敏感；中文原樣）則視為「像在問舊事」：

`當時`、`那天`、`上回`、`上次`、`你說過`、`他說過`、`她說過`、`記得嗎`、`那時候`、`先前記`

**或** `player_text` 含盤上某 entity 的 **名或 id**，且該字串出現在某 `session-archive` 或 L2 archive index／entry 的 `title`／`summary`，且該名／id **不**出現在 `memory_slice.episodes` 近 8 則 `summary` 正文。不要求「名與 id 同時」出現在玩家原文。

皆不命中 → 不掃、不打開。**禁止**讀本回合尚未產出的 `events[]`／`npc_lines`。

打開優先序見 INDEX 已定案 14。打分：title／summary 與玩家原文的簡單重疊次數即可，不必向量庫。

## L2 current zod（本版）

`body`：`z.string()`（可空）；**刪除** max 800。升 2 時 current 寫入截斷前候選，不再「再截 800」。

## 新 session 尾端 3 回

從即將封存的 jsonl 由尾往前取完整「使用者一則＋助理一則」配對，最多 `recent_turns_to_keep` 對，時間正序放進開場說明。解析失敗則省略對白段，**仍可 compact**（summary 仍必有）。

## `compact-state.json`

```json
{ "anchor_turn_n": 0 }
```

`anchor_turn_n`：`z.number().int().min(0)`。setup／custom commit／new-game 寫 `0`。ready 且檔不存在或 parse 失敗：視為 `0` **並寫回**，不得 `needs_setup`。回合差：`turnIdToN(turn_id) - anchor_turn_n`。

## 對局 GM JSON `scene`

`GmOutputSchema` 加 `scene: SceneStateSchema`（與 setup 同形）。`visible` 可空陣列。`present` 成員比較用集合相等（忽略順序與重複）。禁止缺欄 coerce 成酒館 `bartender`／`ash`。
