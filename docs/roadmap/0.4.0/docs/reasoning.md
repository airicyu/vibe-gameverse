# 0.4.0 WHY — 分層記憶與本版不寫 archive

對照：[`../INDEX.md`](../INDEX.md)。

## 為何不是「每個 NPC 一份檔」

路人與跑堂若開獨立檔，Writer 隨口新 `npc_id` 會把 runtime 變成檔案農場，且沒人維護。0／1 同池：過期只刪 L0 節；常駐 L1 留在同一檔直到夠長。L2 才值得獨立 current，避免每次讀取 parse 整池裡的主線長文。

## 為何開場 L2 不必先寫滿

瑪拉／灰是產品指定主線，不是「池爆了才重要」。長度上限只驅動 **池內角色升 2** 與 **current 截斷**。要求 L2 必須先有長檔，會逼 seed 灌水或延後真正要獨立檔的時機。

## 為何升級不用 `present`、不用招呼

酒館預設三人一直在場；用在場次數會把永遠站著的跑堂推上去。招呼沒有知情變化，升級只增加空節。寧可漏升。

0.3.0 Writer 對幾乎每個有 NPC 的 event 都會 `upsertRelation`。若記憶側把「relation 變了」當升 1，招呼永遠升等。故記憶只認 **GM events 是否 trivial**，不改世界 relation 啟發式，也不用落盤前後 snapshot。

## 為何刪「池過大 distill L1」

單節 > 600 已升 2。若先截斷再量長度，升 2 主路徑會死。L0 另有合計 4000 刪節。不再用 600 當 L1 distill 目標。

## 為何生成器 1／2 改寫成 0 而不整次失敗

模型亂填 tier 不應讓 custom setup 重打。無 L2 檔的 `memory_tier: 2` 比 coerce 更糟。

## 為何本版不寫 NPC archive

封存要和 session compact 同一拍：何時切 jsonl、哪些 turn 算一段、如何互指 `session_archive_id`。本版若先寫 archive，會做出沒有 session 對應、或與日後 compact 互不相認的目錄。zod 先鎖形狀，避免實作 agent 發明第三套。

沒有 compact 時 L2 超長只能截斷：已知限制，寫在非目標與產品句。

## 為何機械 Writer、不開第二模型

每回合對在場 NPC 再打一槍，會疊在已經同步的 GM 延遲上，且污染「一回合一個 GM JSON」契約。機械一句會乾、會像 episode——接受；潤飾留給 compact 管線。

## 為何 dirty set 不是人氣榜

對局讀取用 `scene.present`。Dirty set 給日後 compact：**不要 glob 全部 L2**。池 id 也進 `touched`，故 compact 必須濾 L2，這是刻意讓一個檔當「誰被寫過」而不是「誰該有 archive」。

## 為何 `MemorySlice` 不塞記憶 body

0.3.0 已禁止把 notes／persona 塞進每回合 slice（世界摘要會膨脹、全場全知）。NPC 記憶按 id、按在場另附，與世界層分開。

## 為何 L2 路徑是 `l2/{id}/current.json`

同目錄不能既有 `bartender.json` 又有 `bartender/`。預留 `l2/{id}/archive/` 給 compact。

## 否決

- 每 NPC 一個 pi session：handover 明確第二階段；POC 不做。
- GM JSON 加 `npc_memory_patches`：與 `gm_note` 搶注意力、漏寫是常態。
- 廢 `private_notes`：無 hop；靜態開場秘密與動態經歷分開較安全。
- 本版做 compact「順便」：範圍膨脹，jsonl 生命週期是另一項。
