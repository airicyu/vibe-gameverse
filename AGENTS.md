# vibe-gameverse — Agent Context

本檔給 coding agent 開工用。規格起點：`docs/handover.md`、`docs/brainstorm.md`。不要重新大開腦暴，除非 Eric 明確要求改定案。現行版本：**0.9.0**（`VERSION.md`、`changelog.md`）。契約：[0.9.0 回合處理中 UI](docs/roadmap/0.9.0/INDEX.md)。上游：[0.8.0 角色記憶](docs/roadmap/0.8.0/INDEX.md)；[0.7.0 多世界存檔](docs/roadmap/0.7.0/INDEX.md)。未排程構想：`docs/roadmap/backlog/`。

## 語言（強制）

**無論使用者用什麼語言說話，agent 一律以繁體中文書面語回應。**

- 用書面語，不用口語／網路腔（避免「喔」「啦」「欸」堆疊）
- 專有名詞、程式識別子、API path、檔名可保留英文原文
- 程式碼註解與 commit message：跟隨既有慣例；與使用者對話則用繁中書面語

## 這是什麼

**LLM 當 GM 的自由冒險 POC**。主體是遊戲 program，不是「只開 pi 聊天」。

開局先到**主頁**：開始新故事（存檔顯示名 + 預設鏽燈酒館 `kb/seed/` 或自訂引子）或載入可玩存檔。完成 setup／load 後才進入回合迴圈。Default 卡司：玩家 + 瑪拉（`bartender`）+ 灰（`ash`）；一條線索（蠟封紙條／北路燈手）。Custom 仍單場景。不做多地點、任務系統、戰鬥、完整生圖管線、華麗產品 UI。

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

非 `screen === "playing"` 時 `POST /api/turn` 回 409（`not_playing`）。完成後：玩家文字 → `POST /api/turn` → `runTurn` → GM JSON → zod `parseGmOutput` → Writer → Presenter。

| 角色 | 職責 | 實作 |
|------|------|------|
| GM | 裁決、敘事、NPC 台詞、`gm_note` 整份覆寫 | `program/gm-pi.ts`（pi-agent session）；`GM_MODE=mock` 時 `gm-mock.ts`（default 酒館／custom 霧港） |
| Writer | 先吃 `events[]` 寫世界 KB，再機械更新 `npc-memory/`（池／L2 current／dirty set） | `program/writer.ts` + `program/npc-memory.ts`（程式，不另開模型） |
| Presenter | `narration` + `npc_lines` | `program/public/` |

GM 每回合吃：`player_text`、`gm_note`、`scene`、`memory_slice`（近 8 則 episode 摘要 + entities + relations）、**在場** `npc_memories`（L2 讀 `npc-memory/l2/{id}/current.json`，L0／L1 讀 `pool.json` 該節；禁止整份 pool），可選回想摘錄（啟發式才掃已存在的 archive：**summary + locator**，零 quotes／零 jsonl 剪句；閘門含點名 L2＋有 archive），加上 **pi session 活 jsonl**（該 uuid 的 `play-sessions/`；成功 session compact 後換成新檔）。Writer **不讀**聊天逐字稿。`private_notes` 不併進 `npc_memories`。`npc_memories` 與 archive 摘錄 **不**進對玩家 HTTP。對局 GM JSON **必填** `scene`。

Compact **兩個 scope**（同一 `POST /api/turn`、非背景）：L2 離場且有資格 → 只封該 NPC（`Promise.allSettled` 平行）；session 換檔由滿 N（倉庫預設 **8**）、`scene_id` 換幕或強制線觸發，**不**再問 judge、**不**因 `present` 進出整場封。離場 NPC 失敗不拖垮 session；session 失敗不回滾已提交的離場 NPC。`near_cap` 640 不當 NPC trigger。Mock 給人玩不自動跑 compact 短呼叫。

合約與 coerce：`program/schema.ts`。`narration` 是舞台指示，**台詞只在 `npc_lines`**；空 narration 不要填「……」。新開口的角色用新 `npc_id`。缺 `npc_id` → `unknown_npc`；缺 `gm_note` →「本場進行中。」。禁止 coerce 預設酒館。

## 起始、主頁與 session

- **畫面：** `GET /api/state` 的 `screen: "home" | "playing"` 為準（可選保留 `needs_setup: screen !== "playing"`）。主頁：開始新故事／載入存檔。遊玩中：對局 UI、回主頁、刪除此世界（確認字 `delete`）。
- **Pointer：** `kb/worlds/current.json` `{ id }`。僅 playing 有效。Turn／Writer／compact／對局 session 只打 pointer 那份 uuid。
- **新 process 啟動：** `bootWorlds` 刪 `current.json` → 一律主頁，不自動 continue。同 process 內 F5 仍認 pointer。
- **可玩：** 有效 `world.json`；custom 尚須非空 `gm_canon.md`；且 `world.json` 合法且 `id`＝目錄名（含 `save_name`）。半套不列出、load 409。
- **Default 對局 system**＝`prompts/gm-contract.md` + `gm-default.md` + **該 uuid** NPC `persona` 區塊。
- **Custom 對局 system**＝契約前綴 + 該 uuid `gm_canon.md` + runtime NPC `persona`。禁止把整份舊 `gm.md` 當 custom 前綴。禁止讀 repo `npc-*.md` 或 seed 組對局 prompt。
- **`disposePlaySession`**：home／setup／load／delete 前只釋放。**`createPlaySession`**：setup 成功後。**`openLoadedPlaySession`**：load 後（有 jsonl 則 continue）。
- **自動開場：** setup 成功、或 load 時零 episode → `runOpeningTurnIfNeeded`（隱含中性句「我環顧四周。」、不進 UI 氣泡；不假設門／室內）；回應 `opening`。已有 episode 不重跑。`setupDefaultForTest` 不跑開場。
- Setup 必帶 `save_name`（同時為 UI title／清單名；寫入 `world.json`；不進 GM）。parent 已有其他可玩 uuid **不得**擋開新。
- `POST /api/new-game` 語意＝`POST /api/home`（dispose + 清 pointer；**不清**其他 uuid）。
- 缺根目錄 `config.yaml` 則啟動失敗。
- `ensureRuntime`／`bootWorlds` **不偷灌** seed。測試灌 default 須顯式 `setupDefaultForTest`（或 `POST /api/setup/default`）。

## 檔案

```text
program/          # server、turn、setup、gm-pi、writer、npc-memory、kb、schema、world-mock、public UI
prompts/          # gm-contract + gm-default + world-generate（可留 writer.md）；禁止 npc-*.md
kb/seed/          # Default 開場 JSON 模板（含 NPC persona 與瑪拉／灰 memory_tier: 2）
kb/worlds/        # 多世界 parent（gitignore）；current.json + {uuid}/ 完整 playthrough
docs/             # handover、brainstorm、roadmap
```

- 每存檔：`kb/worlds/{uuid}/`＝昔日一份 runtime（`world.json` 含 id／save_name、entities、play-sessions、npc-memory 等）。
- **開場卡司**只在 `kb/seed/`（模板）與該 uuid。遊玩中冒出的角色 → Writer 寫該 uuid `entities.json`（預設 `memory_tier` 0），**不要**預寫 `prompts/npc-*.md`。Custom NPC 只進該 uuid，setup **不**建 `l2/`。
- `npc-memory/`：`pool.json`（L0／L1）、`dirty-set.json`、`l2/{npc_id}/current.json`；成功 compact 才寫 `l2/{id}/archive/`（summary＋locator；**無** `salient_quotes`）。L2 current **不**截 800。刪世界＝recursive 刪該 uuid；回主頁不清目錄。
- 測試必須用 `VIBE_GAMEVERSE_KB_WORLDS`（parent；見 `program/test-runtime-env.ts`）。舊鍵 `VIBE_GAMEVERSE_KB_RUNTIME` **忽略**。**禁止** `rm` 專案 live `kb/runtime` 或 `kb/worlds`。
- 舊 `kb/runtime/`：**不讀、不搬、不自動刪**。
- Legacy `pi-sessions/`→`play-sessions/`：僅在該 uuid **首次**成 pointer 時改名一次。
- 不要把 API key 寫進 git。

## UI 與 session

- 開頁若 `screen === "home"`：主頁；無對局氣泡；`world`／`scene` 為 null。
- 對局等待 `POST /api/turn` 期間：輸入列可見「處理中」＋ spinner（非 streaming；非 setup「生成中…」）；回來後立刻撤。
- 「**重開畫面**」：只清 DOM 氣泡；KB 與 pi session 仍在。重整／HMR 也會清畫面，不清 KB（同 process 仍認 pointer）。
- 「**回到主頁**」：`POST /api/home`；dispose + 清 pointer；不清 uuid。
- 「**刪除此世界**」：dialog 輸入 `delete` → `POST /api/worlds/delete`。
- header／`<title>`／placeholder／清單皆隨 `save_name`；主頁用中性標題。
- 熱改 `program/` 要重載 server 才生效；重載＝新 process → 回主頁。

## 行為約束

- 先打穿驗收，不要順便做引擎／大地圖／多 agent／雲同步。
- 改定案先問 Eric；小實作細節可自決。
- 約束靠 **prompt + zod**，不要只靠模型聽話。
- `DefaultResourceLoader` 必須傳 `agentDir: getAgentDir()`，否則會炸。
- 改 Web UI 後用瀏覽器把該流程點一遍，不要只截一張靜態圖。
