# vibe-gameverse — Agent Context

本檔給 coding agent 開工用。規格起點：`docs/handover.md`、`docs/brainstorm.md`。不要重新大開腦暴，除非 Eric 明確要求改定案。現行版本：**0.4.0**（`VERSION.md`、`changelog.md`）。下一版規劃見 `docs/roadmap/`。其餘 backlog 見 `docs/roadmap/backlog/`。

## 語言（強制）

**無論使用者用什麼語言說話，agent 一律以繁體中文書面語回應。**

- 用書面語，不用口語／網路腔（避免「喔」「啦」「欸」堆疊）
- 專有名詞、程式識別子、API path、檔名可保留英文原文
- 程式碼註解與 commit message：跟隨既有慣例；與使用者對話則用繁中書面語

## 這是什麼

**LLM 當 GM 的自由冒險 POC**。主體是遊戲 program，不是「只開 pi 聊天」。

開局先選 **預設世界起始劇本**（鏽燈酒館 `kb/seed/`）或 **自訂引子**（生成 seed，使用者原文不是 seed）。完成 setup 後才進入回合迴圈。Default 卡司：玩家 + 瑪拉（`bartender`）+ 灰（`ash`）；一條線索（蠟封紙條／北路燈手）。Custom 仍單場景。不做多地點、任務系統、戰鬥、完整生圖管線、華麗產品 UI。

文字 NSFW 允許（玩家帶向即可）；**不可涉及未成年人**。沒有圖像生成管線。

## 怎麼跑

Runtime 是 **Bun**，不是 Node。

```bash
bun install
# .env：OPENROUTER_API_KEY；GM_MODE=pi（預設）或 mock
bun start          # http://localhost:8787/
bun test
```

Auth 走 pi 的 `ModelRuntime`／`OPENROUTER_API_KEY`。**不要**在本 app 直接 HTTP OpenRouter。預設模型：`PI_MODEL=openrouter/deepseek/deepseek-v4-flash:off`。

Engram **只參考架構**，不要 clone、不要混個人 Engram。

## 一回合

未完成 setup 時 `POST /api/turn` 回 409（`needs_setup: true`）。完成後：玩家文字 → `POST /api/turn` → `runTurn` → GM JSON → zod `parseGmOutput` → Writer → Presenter。

| 角色 | 職責 | 實作 |
|------|------|------|
| GM | 裁決、敘事、NPC 台詞、`gm_note` 整份覆寫 | `program/gm-pi.ts`（pi-agent session）；`GM_MODE=mock` 時 `gm-mock.ts`（default 酒館／custom 霧港） |
| Writer | 先吃 `events[]` 寫世界 KB，再機械更新 `npc-memory/`（池／L2 current／dirty set） | `program/writer.ts` + `program/npc-memory.ts`（程式，不另開模型） |
| Presenter | `narration` + `npc_lines` | `program/public/` |

GM 每回合吃：`player_text`、`gm_note`、`scene`、`memory_slice`（近 8 則 episode 摘要 + entities + relations）、**在場** `npc_memories`（L2 讀 `npc-memory/l2/{id}/current.json`，L0／L1 讀 `pool.json` 該節；禁止整份 pool），加上 **pi session 全文歷史**（compact 尚未做；**尚未寫** NPC `archive/`）。Writer **不讀**聊天逐字稿。`private_notes` 不併進 `npc_memories`。`npc_memories` **不**進對玩家 HTTP。

合約與 coerce：`program/schema.ts`。`narration` 是舞台指示，**台詞只在 `npc_lines`**；空 narration 不要填「……」。新開口的角色用新 `npc_id`。缺 `npc_id` → `unknown_npc`；缺 `gm_note` →「本場進行中。」。禁止 coerce 預設酒館。

## 起始與 session

- **needs_setup：** `syncWorldGate` 為唯一真相。無／無效 `world.json`，或 custom 缺／空 `gm_canon.md` → `{ needs_setup: true, world: null }`。Default 忽略 canon 檔。無效檔不改寫。不依 `kb/seed` id 救援舊局；不讀舊 `runtime/prompts/gm.md`。
- **Default 對局 system**＝`prompts/gm-contract.md` + `gm-default.md` + **runtime** NPC `persona` 區塊。
- **Custom 對局 system**＝契約前綴 + `kb/runtime/gm_canon.md` + runtime NPC `persona`。禁止把整份舊 `gm.md` 當 custom 前綴。禁止讀 repo `npc-*.md` 或 seed 組對局 prompt。
- **`disposePlaySession`**：new-game／setup 前只釋放、不建立。**`createPlaySession`**：僅 ready 之後，依 `world.source` 組 prompt。禁止沿用舊 `resetPiGm`（dispose 後立刻開酒館 session）。
- Ready 後重開 `bun start`：有 `pi-sessions/` jsonl → `continueRecent`，system 仍依**當前** contract＋canon。needs_setup 時不得 continue。
- `ensureRuntime` **不再偷灌** seed。測試灌 default 須顯式 `setupDefaultForTest`（或 `POST /api/setup/default`）。

## 檔案

```text
program/          # server、turn、setup、gm-pi、writer、npc-memory、kb、schema、world-mock、public UI
prompts/          # gm-contract + gm-default + world-generate（可留 writer.md）；禁止 npc-*.md
kb/seed/          # Default 開場 JSON 模板（含 NPC persona 與瑪拉／灰 memory_tier: 2）
kb/runtime/       # 本場 playthrough（world、entities、gm_canon.md、episodes、gm_note、scene、pi-sessions、npc-memory/）
docs/             # handover、brainstorm、roadmap
```

- **開場卡司**只在 `kb/seed/`（模板）與 runtime。遊玩中冒出的角色 → Writer 寫 `kb/runtime/entities.json`（預設 `memory_tier` 0），**不要**預寫 `prompts/npc-*.md`。Custom NPC 只進 runtime，setup **不**建 `l2/`。
- `kb/runtime/npc-memory/`：`pool.json`（L0／L1）、`dirty-set.json`、`l2/{npc_id}/current.json`。本版 **不寫** `archive/`。新遊戲 recursive 刪整個 `npc-memory/`。
- `kb/runtime` 是存檔狀態。測試必須用 `VIBE_GAMEVERSE_KB_RUNTIME`（見 `program/test-runtime-env.ts`），**禁止** `rm` 專案裡的 live `kb/runtime`。
- 不要把 API key 寫進 git。

## UI 與 session

- 開頁若 `needs_setup`：先顯示起始選擇，沒有酒館開場氣泡；`scene` 為 null。
- 「**重開畫面**」：只清 DOM 氣泡；KB 與 pi session 仍在。重整／HMR 也會清畫面，不清 KB。
- 「**新遊戲**」：清空 runtime（含 `pi-sessions`）+ `disposePlaySession`，回到起始選擇。不要立刻灌酒館或開對局 session。
- header／`<title>`／placeholder 隨 `world.title`；setup 畫面用中性標題。
- 熱改 `program/` 要重載 server 才生效；重載前確認不要誤觸新遊戲。

## 行為約束

- 先打穿驗收，不要順便做引擎／大地圖／多 agent／多存檔槽。
- 改定案先問 Eric；小實作細節可自決。
- 約束靠 **prompt + zod**，不要只靠模型聽話。
- `DefaultResourceLoader` 必須傳 `agentDir: getAgentDir()`，否則會炸。
- 改 Web UI 後用瀏覽器把該流程點一遍，不要只截一張靜態圖。
