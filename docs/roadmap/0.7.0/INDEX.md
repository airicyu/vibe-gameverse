# 0.7.0 多世界存檔

- 上游：[0.6.0 Compact 分 scope 與同回合平行](../0.6.0/INDEX.md)（`shipped`）
- 構想來源：[backlog/multi-world-saves.md](../backlog/multi-world-saves.md)（排程中保留；**契約以本 INDEX 為準**；本檔仍有待拍板）
- Changelog：出貨時寫根目錄 [`changelog.md`](../../../changelog.md)；同步 `VERSION.md` 與 `AGENTS.md`
- 狀態：`planned`（**尚未**自足到可開工；須先清空或拍板「開工前仍須拍板」）
- 日期：2026-09-09（Asia/Hong_Kong）

## 產品句

玩家可以同時保留幾個已開打的世界，各自一份完整 KB／pi session／NPC 記憶，切來切去接著玩。開新世界不得抹掉其他世界。每個世界只有一條一直 run 的紀錄——不是同一世界再複製多個 SAVE 槽。

## 文件地圖

閱讀順序：

1. 本檔（WHAT；拍板後升格）
2. 構想背景（勿當已定案）：[`../backlog/multi-world-saves.md`](../backlog/multi-world-saves.md)
3. 單一 runtime 結構 hop 另案：[kb-runtime-upgrade](../backlog/kb-runtime-upgrade.md)（本版是否同做 hop 見待拍板）

規格對照（勿當本版契約）：`docs/handover.md`、`docs/brainstorm.md`、根目錄 `AGENTS.md`、[0.6.0 INDEX](../0.6.0/INDEX.md)。

## 與上一版對照

| 行為 | [0.6.0](../0.6.0/INDEX.md) 現行 | 0.7.0 目標 |
|------|-------------------------------|-----------|
| 路徑 | 全域一份 `kbRuntimeDir`（預設 `kb/runtime/`） | 多個世界目錄並存；對局只打 **目前 pointer** |
| 新遊戲 | 清空 **同一個** runtime | 開新世界＝新目錄；**不清**其他世界 |
| Setup | 原子 commit 寫進該 runtime | commit **只寫目標世界目錄** |
| 開畫面 | 起始二選：default／custom | 另有 **已有世界** 清單 |
| 重開 `bun start` | continue 該單一 runtime 的 jsonl | continue **pointer 指向的那一份** |

## 已定案（構想已鎖、開工前勿推翻）

1. **推翻 0.2.0 非目標「不做多存檔槽」的產品禁令。** 本版做的是 **多個世界目錄**，不是同一世界多 SAVE 槽。
2. **一世界＝一目錄＝一條時間線。** 禁止產品功能「另存新檔」「分支周目」「同一 title 開第二條時間線」。想重打同一模板＝開 **新世界**（新目錄）；舊局仍留。目錄內 compact／jsonl archive 仍是這一條的歷史。
3. **開新世界不得 recursive 刪 parent 下其他子目錄。** 禁止把今日 `POST /api/new-game` 的「清空 runtime」原樣當成開新世界。
4. **現行「新遊戲」語意須拆：** **回選單／換世界**＝dispose 對局 session、**不清**其他目錄；**刪除某世界**是否做見待拍板。
5. **開舊世界清單**只把 `syncWorldGate` 會判 **ready** 者當可玩項（有效 `world.json`；custom 尚須非空 `gm_canon.md`）。半套／無效 world **不要**當可玩。損壞項是否列出見待拍板。
6. **選中舊世界：** dispose 舊 session → 設 pointer → 若該目錄有 jsonl 則 `continueRecent`；system 依 **該世界** `world.source` 組 prompt。
7. **已 ready 且未明確回選單時，turn 只打目前 pointer。** 不要每回合帶 save id。
8. **Header** 仍隨 **目前** `world.title`。
9. **兩個世界之間禁止共用**同一 pi session 或 merge KB。
10. **Compact 仍發生在目前選中的那一份 runtime 內**（0.5.0／0.6.0 契約不因多世界而改 trigger 語意）。
11. **測試只動 env 指向的 parent／子目錄。禁止 `rm` 專案 live `kb/runtime` 或 live saves。**
12. **`ensureRuntime` 禁止**再假設「空就等於可以偷灌唯一 runtime」。空 parent＝沒有舊世界，進選單。

## 開工前仍須拍板

1. Parent 路徑（`kb/saves/` vs 仍叫 `kb/runtime/` 但改成 pointer＋兄弟目錄）、save id 生成、pointer 檔名。
2. 要不要 UI「刪除此世界」。
3. 損壞／needs_setup 子目錄是否列出。
4. 與 [kb-runtime-upgrade](../backlog/kb-runtime-upgrade.md) 的順序：先 hop 單 runtime 再多槽，或同版一起做。舊 `kb/runtime` 若存在有效單目錄、尚無 saves parent → 視為第一個世界搬進去（細節與 hop 綁定）。
5. 已 ready 時可否從 header 開清單切走（不經清空）。傾向 **可以切**，否則「切來切去」不成立。
6. HTTP path 與 body（清單 GET、選舊世界 POST、開新世界 commit 目標）。
7. `VIBE_GAMEVERSE_KB_RUNTIME` 與可能的 `VIBE_GAMEVERSE_KB_SAVES` 語意。

## 非目標

- 同一世界多 SAVE 槽、匯出世界包、雲同步、社群分享
- 多地點／戰鬥／真・多 agent
- 自動刪最舊世界做容量管理
- 華麗產品 UI、完整生圖管線
- 改 compact trigger／兩個 scope（那是 0.6.0）

## 驗收（拍板後再寫死測規；下列為方向）

- [ ] 開世界 B 不清世界 A 的檔與 session。
- [ ] 切回 A 後 `world.title`／entities／pi 接續正確。
- [ ] 半套目錄不可 `POST /api/turn`。
- [ ] 開新世界不把 `clearPlaythrough` 打到 A。
- [ ] Ready 後重開進程：continue pointer 指向的那一份。
- [ ] `bun test` 全綠；出貨時 VERSION＝`0.7.0`。

## 實作軌道

拍板後再拆 Track。預期至少：目錄／pointer、setup／new-world 語意拆分、清單 HTTP＋UI、測試隔離。

## 錨點檔案（現行；拍板後補 HOW）

| 路徑 | 用途 |
|------|------|
| `program/kb.ts`、`program/paths.ts`（或同等） | `kbRuntimeDir`、clearPlaythrough |
| `program/setup.ts`、`program/world-gate.ts` | 原子 commit、`syncWorldGate` |
| `program/gm-pi.ts` | `disposePlaySession`／`createPlaySession`／`continueRecent` |
| `program/public/` | 起始選擇、header、`world.title` |
| `program/test-runtime-env.ts` | 測試隔離 runtime |

## 行為約束（規劃／實作 agent）

- 繁體中文書面語；不 commit 除非使用者要求。
- 勿 `rm` live `kb/runtime`。例證虛構。
- 待拍板未清前 **不要**當可開工 HANDOFF。
