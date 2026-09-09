# 0.10.0 L2 NPC 心理深度

- 上游：[0.9.0 回合處理中 UI](../0.9.0/INDEX.md)（`in progress`；本版 **不**依賴 0.9.0 出貨，只假設現行對局／Writer／compact 已可玩）
- 構想來源：原 [backlog/npc-l2-psyche.md](../backlog/npc-l2-psyche.md)（出貨後已刪；**契約以本 INDEX＋docs 為準**）
- Changelog：根目錄 [`changelog.md`](../../../changelog.md)；同步 `VERSION.md` 與 `AGENTS.md`
- 狀態：`shipped`
- 日期：2026-09-10（Asia/Hong_Kong）

## 產品句

重要角色（`memory_tier === 2`）在 **npc-memory** 落一份結構化心理骨架（性格、人生／中期／短期目標、喜好／厭惡），GM 寫台詞時除 L2 `body`（近事）外還能看動機；L0／L1 不擴。更新只在 **NPC compact** 另開一次短呼叫，不每回合改 GM JSON、不 Writer 機械重寫。

## 文件地圖

1. 本檔（WHAT）
2. [`docs/npc-l2-psyche.md`](./docs/npc-l2-psyche.md)（HOW）
3. [`docs/reasoning.md`](./docs/reasoning.md)（WHY）
4. 開工：[`HANDOFF.md`](./HANDOFF.md)
5. 設計審查：[`docs/design-review.md`](./docs/design-review.md)
6. 實作審查：[`docs/implementation-review.md`](./docs/implementation-review.md)

**開工前仍須拍板：** 無（原 backlog「待拍板」已收斂至本 INDEX 與 HOW）。

## 與上一版對照

| 行為 | 0.4–0.9 現行 | 0.10.0 |
|------|-------------|--------|
| L2 落盤 | 僅 `l2/{id}/current.json`（`body`） | 另加 `l2/{id}/psyche.json`（六欄短字串） |
| `npc_memories` | `{ npc_id, tier, body }` | L2 可選附 `psyche` 物件；L0／L1 不變 |
| 升 2 | 建 `current.json` | 同時建 **空** `psyche.json`（全欄空字串合法） |
| 每回合 | Writer 只改 `body` | **不**改 psyche |
| NPC compact | archive + distill `body` | 成功後 **再**一次 psyche 短呼叫更新中期／短期／好惡（性格／人生目標需強證據） |
| Default 開場 | 瑪拉／灰有 L2 `body` | 同時有產品預寫 `psyche.json` |
| Custom 開場 | 無 L2 | 仍無 psyche；升 2 後才有空檔 |
| `near_cap` | 只看 `body` UTF-16 | **仍只**看 `body` |
| 對玩家 HTTP | 無 `npc_memories` | **仍無** |

## 已定案

1. **範圍。** 僅 `memory_tier === 2` 且存在 `l2/{id}/`。L0／L1 池節 **不加** psyche。不做 UI 編輯器、不做好感度儀表、不每 NPC 獨立 pi session。不廢 `persona`（仍在 system）；不讀 `private_notes` 進 psyche 或 `npc_memories`。
2. **落盤位置。** **`npc-memory/l2/{npc_id}/psyche.json`**（**不**併入 `current.json`）。`current.json` 仍只管經歷 `body`；Writer 截斷／distill `body` 時不得誤覆寫心理欄。
3. **JSON 形狀（新寫入）。** 根物件必填 `npc_id`（與目錄名一致）＋六欄 **字串**（可空）：
   - `disposition`（性格）
   - `life_goal`（人生目標）
   - `mid_goal`（中期目標）
   - `short_goal`（短期目標）
   - `likes`（喜好）
   - `dislikes`（厭惡）
   UTF-16 上限：`disposition`／`life_goal`／`mid_goal`／`likes`／`dislikes` 各 ≤200；`short_goal` ≤120。zod parse 後超出 **clip**（同 Writer `clipEnd` 慣例），不 fail 整回合。
4. **缺檔／舊存檔。** **不 hop**。讀取時無 `psyche.json` → 視為六欄皆 `""` 的合法物件（記憶體內補，不必立刻寫碟）。升 2 或 Default setup **新寫** 實體檔。
5. **升 2 初值。** Writer `promoteToL2` 成功寫 `current.json` 後，**同原子流程**寫 `psyche.json`：**六欄全空**合法。禁止從 `persona`／池 `body` 自動摘句灌入（避免雙源與漂移）；等 compact distill 或 Default seed 填。
6. **Default seed。** `commitDefaultWorld` 為 `bartender`／`ash` 各寫一份產品預製 `psyche.json`（虛構、取自公開 `summary`／`persona` 動機，**不**抄 `private_notes` 全文）。不改酒館故事核；深度「足夠 GM 懂為何而動」即可（具體字串見 HOW）。
7. **誰讀。** `assembleNpcMemories`：在場 L2 且 `current.json` 存在時，snippet 除 `body` 外附 `psyche` 六欄（含空字串）。缺 `current` 仍省略該角（同 0.4.0）。L0／L1 仍只有 `body`。`buildGmContext`／`piGm` JSON 自然帶入；對玩家 HTTP **仍不**輸出。
8. **GM 規則（寫進 `prompts/gm-contract.md`）。** 台詞動機優先該角 `psyche` 的目標／好惡；語氣跟 entity `persona`；近事與態度跟 `body`。衝突時：**`short_goal` 與 `body` 可蓋過過時 `mid_goal`**；`disposition`／`life_goal` **不因單回合翻盤**（compact distill prompt 亦同）。
9. **誰寫、何時改。** 每回合 GM JSON **不**帶 psyche 欄。Writer **不**機械改 psyche。僅在 **離場 scope** 的 NPC compact 成功（`departedWrites` 迴路內 `commitNpcWrite` 已 commit archive＋distill `body`）後，對該 `npc_id` 另開 **一次** psyche 短呼叫（同 `compact.ts` 管線、可 mock／test hook；**不是**每回合）。**Session compact** 內的 `sessionNpcWrites`（near_cap 在場 distill）**不**呼叫 psyche distill；session compact **不**改 psyche。Psyche 短呼叫 mock 行為 **與** `modelNpcArchive` **相同**：`mockPlaySkipsAutoCompact` 為真（給人玩 mock 自動 compact skip）時 psyche 亦 skip；管線有跑時走 mock fixture／test hook。
10. **Psyche compact 觸發點。** 僅在 `applyAutoCompact`（或等價）處理 **`departedWrites`** 的 `commitNpcWrite` **之後**、對該 write 的 `npc_id` 呼叫。**禁止**在 `sessionNpcWrites` 的 `commitNpcWrite` 後呼叫 psyche distill。
11. **Psyche compact 輸入／輸出。** 輸入：舊 `psyche.json`、本段 `archive` 的 `title`＋`summary`、distill 後新 `body`、entity `name`（可選 `persona` 前 400 字作語氣錨，**不**當動機 SoT）。輸出：完整六欄 JSON；`disposition`／`life_goal` 僅在 summary 有明確長期轉折證據時才改，否則 **原樣回傳**。失敗：**不**回滾已成功的 archive／`body` distill；記 log；該角 psyche 保持 compact 前內容。
12. **`near_cap`。** `recountNearCap`／dirty `near_cap` **仍只**計 `current.body.length`；不算 psyche 字數。
13. **測試。** 改／加 `program/npc-memory.test.ts`、`program/compact.test.ts` 相關窄測；全部 Track 結束 `bun test` 全綠。隔離 `VIBE_GAMEVERSE_KB_WORLDS`；禁止 `rm` live `kb/worlds`。
14. **出貨文件。** `VERSION.md`＝`0.10.0`；`changelog.md`；`AGENTS.md` 一句 L2 psyche 落盤／compact 更新／不進 HTTP。出貨後刪 backlog 本列與 `npc-l2-psyche.md`。不 hop 舊 worlds。

## 開工前仍須拍板

無。

## 非目標

- L0／L1 心理檔；每個路人都有人生目標
- 對局 GM JSON 每回合覆寫 psyche
- Writer 每回合機械修短期目標
- 玩家可見心理面板／好感度
- 把 `private_notes` 自動 merge 進 psyche
- 真・多 agent、任務系統、多地點動機引擎
- 舊存檔 psyche hop 或從舊 `body` 自動拆六欄
- 改 0.6.0 compact 觸發表（離場 NPC／session scope）

## 驗收

- [x] Default 新開：`l2/bartender/psyche.json` 與 `l2/ash/psyche.json` 存在且 zod 合法；六欄符合 HOW 預製內容。
- [x] 遊玩中 1→2：升 2 後有 `psyche.json` 且六欄皆空；`current.json` 行為與 0.9.0 一致。
- [x] 在場 L2：`buildGmContext` 的 L2 snippet 含 `psyche` 物件；L0／L1 snippet **無** `psyche` 鍵。
- [x] 缺 `psyche.json` 的舊 L2：讀取不 fail；GM context 仍附空六欄 psyche（或等價空物件）。
- [x] Session compact 含 `sessionNpcWrites`（near_cap 在場 archive）時：該角 `psyche.json` **內容不變**（mtime／內容 assert）。
- [x] promote 1→2：`saveL2Psyche` 失敗時與現行 `promoteToL2` 一致回滾（無 `l2/{id}/`、tier 不留在 2）。
- [x] NPC compact（**離場** scope）成功後：該角 `psyche.json` 被 distill 更新（測試可 mock）；archive／`body` 已成功時 psyche 失敗 **不**回滾 archive。
- [x] `near_cap` 仍只依 `body.length`；psyche 變長不觸發 near_cap。
- [x] `POST /api/turn` 回應 **無** `npc_memories`；`prompts/gm-contract.md` 含 psyche／persona／body 優先序。
- [x] `bun test` 全綠（`GM_MODE=mock bun test`）；出貨 VERSION＝`0.10.0`；backlog 本列已刪。

## 實作軌道

### Track A — Schema 與 kb 讀寫

- **做：** `NpcPsycheSchema`／`psyche.json` path；`loadL2Psyche`／`saveL2Psyche`；缺檔空物件；`promoteToL2` 寫空 psyche；Default seed 寫預製 psyche。
- **不做：** GM context（B）、compact distill（C）。

### Track B — GM context 與 contract

- **做：** 擴 `NpcMemorySnippet`；`assembleNpcMemories` 附 L2 psyche；`gm-contract.md` 規則。
- **不做：** compact（C）。

### Track C — Compact psyche distill

- **做：** `prompts/compact-npc-psyche.md`；`compact.ts` 在 **`departedWrites` 的 `commitNpcWrite` 成功後** 呼叫；mock／test hooks 與 `modelNpcArchive` 同級；失敗不回滾 archive。
- **不做：** `sessionNpcWrites` 路徑 psyche distill；session compact 改 psyche。

### Track D — 測試與出貨文件

- **做：** 窄測；`VERSION`／`changelog`／`AGENTS`；出貨刪 backlog。

## 錨點檔案

| 路徑 | 用途 |
|------|------|
| `program/schema.ts` | `NpcPsycheSchema`、`NpcMemorySnippet` |
| `program/kb.ts` | path、load/save、Default seed 檔案 map |
| `program/npc-memory.ts` | `promoteToL2`、`assembleNpcMemories` |
| `program/compact.ts` | NPC compact 後 psyche distill |
| `prompts/compact-npc-psyche.md` | 短呼叫契約 |
| `prompts/gm-contract.md` | GM 用 psyche 規則 |
| `kb/seed/bartender.json`／`ash.json` | 公開人設錨（**不**寫 psyche 進 entity） |
| `docs/roadmap/0.10.0/docs/npc-l2-psyche.md` | HOW（契約） |

## 行為約束

- 繁體中文書面語；不 commit 除非使用者要求。
- 勿 `rm` live `kb/worlds`。例證虛構。
- 狀態已 `shipped`；後續改動另開版本。
