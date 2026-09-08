# 0.4.0 HOW — NPC 記憶路徑與一回合

對照：[`../INDEX.md`](../INDEX.md)。常數以 INDEX 已定案為準。

## 目錄（runtime）

```text
{kbRuntimeDir}/npc-memory/
  pool.json
  dirty-set.json
  l2/
    {npc_id}/
      current.json
      archive/          # 本版不得建立此目錄或其中檔案
```

`kbRuntimeDir` 預設 `kb/runtime/`；測試必須 `VIBE_GAMEVERSE_KB_RUNTIME`。

缺 `pool.json`：視為 `{ "npcs": {} }`。缺 `dirty-set.json`：視為 `{ "since_session_archive": null, "touched": [], "near_cap": [] }`。讀取路徑 **不**補建 L2 檔、**不**因此 `needs_setup`。Writer 本回合若更新記憶，可把空結構落盤（這是本版寫入，不是 hop migrate）。

## JSON 形狀

### `pool.json`

```json
{ "npcs": { "<id>": { "tier": 0, "last_substantive_turn": 12, "body": "…" } } }
```

- `tier`：`z.literal(0).or(z.literal(1))`（L2 不得留在 pool）。
- `last_substantive_turn`：`z.number().int()`，等於當時 `turn_id` 數字（`t0001` → `1`），**不是** `"t0001"` 字串。
- `body`：落盤後 trim、UTF-16 長度 1–600；空節刪 key。升檔判定用 **截斷前** 候選長度。

### `l2/{npc_id}/current.json`

```json
{ "npc_id": "bartender", "body": "…", "updated_turn": 3 }
```

- `npc_id`：`z.string()`，必須等於目錄名。
- `body`：UTF-16 0–800（空字串合法）。
- `updated_turn`：`z.number().int()`，與 pool 相同（本回合 `n`），**不是** `"t0003"`。

`memory_tier === 2` 但缺 `current.json`：`npc_memories` **省略**該 id；**不**改 entity、不 500。升 2 失敗必須回滾，使此態不該由 Writer 產生。單測可用 fixture 半套證明不 500。

### `dirty-set.json`

```json
{ "since_session_archive": null, "touched": ["bartender"], "near_cap": [] }
```

`since_session_archive`：`z.string().nullable()`，本版恒 `null`。`touched`／`near_cap`：`z.array(z.string())`。id 須為已存在 npc。`near_cap` ⊂ L2 ids。每回合重算 `near_cap`：現盤 L2 body UTF-16 ≥ 640 則列入，否則移出。

### Archive（本版只 zod、不落盤）

`NpcArchiveIndexSchema`：`{ npc_id: string, entries: [{ npc_archive_id, session_archive_id?: string, turn_from, turn_to, title, body_chars, quote_count }] }`

`turn_from`／`turn_to`：`z.string()`，格式與對局 `turn_id` 相同（例 `"t0030"`）。compact 日後用 `n` 組字串；本版 L2／pool **不**存 `t00xx`。

`NpcArchiveEntrySchema`：`npc_archive_id`、`npc_id`、可選 `session_archive_id`、`turn_from`／`turn_to`、`title`、`summary`（UTF-16 1–800）、`salient_quotes` 長度 0–3，元素 `{ turn_id: string, speaker, text }` 且 `speaker` 為該 `npc_id` 或 `"player"`，`text` UTF-16 1–120。

`npc_archive_id` 格式：`^na_[a-z][a-z0-9_]*_[0-9]{3,}$`（例 `na_bartender_003`）。

## Entity

`memory_tier: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional()`  
`kind !== "npc"` 且該欄有值 → parse **失敗**。  
npc 缺欄 → 讀取時當 0（可在 Writer／load coerce 寫回）。

Custom 生成：parse `GeneratedWorld` 之後、commit 之前，每個 `kind === "npc"`：缺欄、1、2 **一律寫成 0**。不要因非法 2 整次 retry 失敗。

## `GmContext`

```ts
npc_memories: { npc_id: string; tier: 0 | 1 | 2; body: string }[];
```

僅含 `scene.present` 裡且 `kind === "npc"` 的 id。L2 有合法 `current.json`（body 可空）則列入；無池節的 L0／L1、以及缺檔的 L2，省略。

**時序：** 回合 n 的 GM **先**讀盤上記憶，再產 JSON，再 Writer 落世界＋記憶。本回合寫入下一回合才進 `npc_memories`。不要在同一 `runTurn` 裡先 Writer 再重跑 GM。

導出 `buildGmContext`（或 `assembleNpcMemories`）：輸入 scene／entities／pool／l2 map，輸出 `GmContext`（或僅 `npc_memories`）。`runTurn` 呼叫之。單測打此函式。**禁止**把 `npc_memories` 放進對玩家 HTTP JSON。

## Trivial

`TRIVIAL_ACTIONS`（精確小寫；action 先 trim、lower case）：

`greet`、`welcome`、`idle`、`serve`、`nod`、`wave`、`smalltalk`

**僅台詞**啟發式：該 id 不在任何 event `actors`；本回合沒有由**非 trivial event** 寫入的、涉及該 id 的 relation（記憶側不把 trivial event 的 `upsertRelation` 算進去）；僅有該角 `npc_lines`；每條 `text` trim 後 UTF-16 ≤ 16。

世界層仍可對 greet event 做 `upsertRelation`。記憶升等 **不讀** 該次 relation 當「有變更」。

## 單回合 Writer 順序（每個 npc 獨立，最後寫 dirty）

在 `writeFromGm`（episodes／entities／relations）**之後**。記憶判定用 **GM JSON 的 events** 分類 trivial／非 trivial，**不要**用「落盤前後 relation snapshot 是否不同」（招呼也會不同）。

1. 判定本回合可否 **改 body**（INDEX 14：actors 或 `npc_lines`，僅 present 不夠）。不可則跳過該 id 的 body／升等；**禁止**為 L2 建 pool 節。
2. 判定 trivial（INDEX 7）。trivial：可寫極短 L0（測遺忘用）；**已是 L2 則不改 current**。
3. 組候選 body：舊 body（可空）＋換行＋一句 `{turn_id} {摘要 UTF-16 ≤ 80}`，不得整段抄 `npc_lines`。
4. 0→1 **僅當** INDEX 7 三支之一（不是「凡非 trivial」）：同時寫 pool `tier = 1` 與 entity `memory_tier = 1`。
5. 若本回合開始時為 1（或剛走完 4）且候選 trim UTF-16 **> 600** → 升 2（剪池 → current 截 800 → entity 2 → touched）。失敗全回滾。**本步成功則跳過 6。**
6. 若 **本回合開始時** 已是 2 且可寫且非 trivial → 寫 `current.json`（尾端優先、≤ 800）、`updated_turn = current_n`，進 `touched`。不得因步驟 5 再走本步。
7. 否則若 **仍在池**（tier 0 或 1）：body 截斷至 600 寫入；空則刪 key。**禁止** `memory_tier === 2` 出現在 `pool.npcs`。
8. `last_substantive_turn`：**僅**更新仍在 pool 的 L0／L1 節。新建 L0（含 trivial）設為 `current_n`；已存在的 L0／L1 僅在實質命中（非 trivial）時刷新。L2 不寫此欄、不建池 key。
9. 全池：L0 且 `current_n - last_substantive_turn >= 12` → 刪節。
10. 其餘 L0 body 合計 UTF-16 > 4000 → 刪最舊 L0 直到 ≤ 4000。
11. 重算整個 `near_cap`；本回合寫過的 id 併入 `touched`。

升 2 可測失敗：內部在「`current.json` 已寫入、尚未改 `entities.json` 的 `memory_tier`」之間接受測試注入 callback（僅測試入口，**禁止**生產 HTTP 後門）。注入後必須回滾：池節仍在、無 `l2/{id}/`（或刪已寫的 current）、entity 仍 1、dirty **無**該次升檔新增的 touched／near_cap。

## Default 開場 current 正文（虛構、固定）

實作寫死常數（測試可斷言子字串），**不要**從 live runtime 抄。這兩句是記憶常數，不是 `persona`：

- `bartender`：`今晚吧台如常。灰在角落。北路的事不當眾說。`
- `ash`：`坐在角落。蠟封紙條在桌上。還沒決定要不要交給進來的人。`

## Prompt 附加

`npc_memories` 在 `GmContext`，經 `runTurn` 同一 `ctx` 給 `piGm` 與 `mockGm`（mock 可忽略欄位，但 **組裝**不得分叉）。

不串台規則：寫入 `prompts/gm-contract.md` 末節，僅 **pi** `buildPlaySystemPrompt` 會讀到。**mock 不讀**契約檔，不必複製同文。

## 清理

`clearPlaythrough`：`rm(join(kbRuntimeDir, "npc-memory"), { recursive: true, force: true })`。`ensureRuntime` 可 `mkdir` 該根目錄，但不要預建 archive。
