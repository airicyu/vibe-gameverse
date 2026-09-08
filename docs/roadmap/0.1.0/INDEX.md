# 0.1.0 鏽燈酒館 POC（一回合迴圈）

- 上游：`docs/handover.md`＋`docs/brainstorm.md`（2026-09-05 凍結的 POC 規格）。本目錄為**事後補寫**的已出貨紀錄：當時根目錄 `VERSION.md` 曾為 `0.0.0`，產品語意即本版；**不是**另開一輪實作。
- Changelog：出貨摘要見根目錄 [`changelog.md`](../../../changelog.md)；契約細節以本目錄為準。
- 狀態：`shipped`（約 2026-09-05；後續由 [0.2.0](../0.2.0/INDEX.md) 接 setup／custom）
- 日期：2026-09-05（Asia/Hong_Kong）

## 產品句

玩家打開簡單 Web UI，**直接**進入鏽燈酒館：與瑪拉（`bartender`）、灰（`ash`）對話；程式驗證 GM JSON、Writer 落 Episode／Entity／Relation、覆寫 `gm_note`；重開 pi session 後 NPC 仍能提到先前事。只有這一點、這一條線索，沒有選劇本門。

## 文件地圖

1. 本檔（WHAT）
2. [`docs/tavern-loop.md`](./docs/tavern-loop.md)（HOW：boot、一回合、HTTP、檔案）
3. [`docs/reasoning.md`](./docs/reasoning.md)（WHY）
4. [`HANDOFF.md`](./HANDOFF.md)（歷史交接；**不要**當 0.2.0 之後的實作規格）

規格來源（本版契約已收斂進本目錄；下列僅背景）：`docs/handover.md`、`docs/brainstorm.md` §3.3／§7。

## 與上一版對照

無正式產品上一版。本版＝從零打通 brainstorm POC。

| 層 | 本版 |
|----|------|
| 開服 | `ensureRuntime()`：`entities` 空則 **立刻複製** `kb/seed/` |
| 開畫面 | 直接聊天；開場氣泡／場景即酒館 |
| 新遊戲 | 清 runtime 後 **立刻再灌 seed** 並 `resetPiGm`（dispose + 立刻開酒館對局 session） |
| GM system | 整份 `prompts/gm.md` + `npc-bartender.md` + `npc-ash.md` |
| 世界標記 | **無** `world.json`、無 `needs_setup`、無 custom primer |
| Coerce | 缺欄可補酒館預設（`bartender`、酒館 gm_note／`scene_id`） |

0.2.0 **推翻**上表：選劇本、不偷灌、拆 `resetPiGm`、拆契約與酒館 canon、coerce 禁止預設酒館。讀本目錄時不要把 0.2.0 行為寫回本版。

## 已定案

1. **單場景酒館。** `scene_id` 實務上即 `tavern`。不做地圖／旅行。
2. **開場卡司固定：** 玩家 + 瑪拉（`bartender`）+ 灰（`ash`）；地點 `tavern`；線索實體 `sealed_note`（蠟封紙條／北路燈手）。人設在 repo `prompts/npc-*.md`；實體模板在 `kb/seed/*.json`。
3. **主體是遊戲 program**（Bun），不是只開 pi 聊天窗。Auth／模型經 pi `ModelRuntime`＋`OPENROUTER_API_KEY`；**禁止**本 app 直連 OpenRouter HTTP。預設 `GM_MODE=pi`；`mock` 不打外網、只出酒館卡司。
4. **一回合順序：** 玩家自由文字 → 組 context（`player_text`、`gm_note`、`scene`、`memory_slice` 近 8 則 episode 摘要 + 全 entities／relations）→ GM JSON → zod 驗證／coerce → Writer 只吃 `events[]` → Presenter 吃 `narration` + `npc_lines`。
5. **GM 熱路徑：** 同一 pi `AgentSession` 接續；落盤 `kb/runtime/pi-sessions/*.jsonl`。重開 server 可 `continueRecent`。**Compact 本版不做。**
6. **Writer 是程式**，不呼叫第二個模型、不讀聊天逐字稿。
7. **GM note** 每回合整份覆寫，上限約 800 字。
8. **記憶：** 瘦檔案 KB（episodes／entities／relations）。Engram 只參考概念，不 clone、不混個人庫。
9. **UI：** 對話氣泡 + 輸入框；可掛靜態圖路徑但本版不接生圖。不是 terminal、不是 Electron。
10. **文字 NSFW** 允許（玩家帶向即可）；**不可涉及未成年人。**
11. **空 runtime 即酒館：** boot 偷灌 seed。沒有「先選世界」狀態。
12. **測試**必須用隔離 runtime 目錄（後來的 `VIBE_GAMEVERSE_KB_RUNTIME`）；禁止 `rm` 專案 live `kb/runtime`。
13. **`DefaultResourceLoader` 必須傳 `agentDir: getAgentDir()`。**

## 非目標

- 世界起始選擇、custom 引子生成、`world.json`／`needs_setup`
- Session compact、多存檔槽、多地點、任務、戰鬥、生圖管線、華麗 UI、真多 agent
- KB 結構 migrate（當時無 `store_version`）
- 改 OpenRouter 直連

後續構想：[`../backlog/INDEX.md`](../backlog/INDEX.md)。世界起始已出貨為 [0.2.0](../0.2.0/INDEX.md)。

## 開工前仍須拍板

無（已 shipped）。當時 handover 的存檔槽／預置圖／劇情細節：本版用極簡酒館開工，不阻塞。

## 驗收

- [x] `bun start` 開頁即可對話，無需 setup 選單
- [x] Default 卡司：瑪拉／灰／紙條；mock 與 pi 皆酒館
- [x] 一回合：JSON 過 schema → episodes 增加；關係可更新
- [x] 重開 server／session：帶入 KB + gm_note，可繼續（compact 未做）
- [x] `GM_MODE=mock` 不打外網
- [x] 熱改 `program/` 須重載 server

## 實作軌道（歷史）

當時建議順序即 handover：骨架 → mock 一回合 → pi GM → Writer＋重開驗收。Compact／存檔 UI／圖延後。

## 錨點檔案（本版語意；路徑後來可能被 0.2.0 改用途）

| 路徑 | 本版用途 |
|------|----------|
| `program/kb.ts` | runtime；空則 copy `kb/seed/` |
| `program/turn.ts` | 一回合；`scene_id` 可後備 `tavern` |
| `program/schema.ts` | GM JSON；缺欄可 coerce 酒館 |
| `program/gm-pi.ts` | `resetPiGm`：dispose 後立刻開酒館 session |
| `program/gm-mock.ts` | 只酒館 |
| `program/writer.ts` | events → KB |
| `program/server.ts` | `POST /api/turn` 等；無 setup API |
| `program/public/` | 直接玩；寫死酒館文案／placeholder |
| `kb/seed/` | 開場實體模板 |
| `prompts/gm.md` | 契約＋酒館 canon 同檔（0.2.0 才拆） |
| `prompts/npc-bartender.md`、`npc-ash.md` | 開場人設 |

## 行為約束

- 繁體中文書面語。勿把 live 對白寫進 roadmap。
- 本目錄是 **0.1.0 歷史契約**。現行程式以 0.2.0＋`AGENTS.md` 為準。
