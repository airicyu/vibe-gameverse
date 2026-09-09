# Changelog

版本真相：`VERSION.md`（現行產品字串）＋本檔（已出貨摘要）。各版契約細節以 `docs/roadmap/X.Y.Z/` 為準。

---

## 0.12.0 — 多套 Default 模板（2026-09-10）

開新 Default 世界時可從五套預寫起始劇本擇一（copy 該套 `kb/seed/{id}/`，不是把使用者原文當 seed），或走既有 custom 引子。每套單場景、小卡司、一條鉤子。見 `docs/roadmap/0.12.0/`。

### Added

- 模板 id：`rust-lamp`／`cyberpunk`／`sword-dungeon`／`esper-city`／`mist-rite`
- `POST /api/setup/default` 必帶 `template_id`；`GET /api/templates`；`world.json.template_id`
- 對局 default system 讀 `prompts/gm-default/{id}.md`；mock 分套不串台
- 主頁先選模板（名＋導語）再填存檔顯示名

### Non-goals

- 模板編輯器、章節切換、循環周目、圖像、多地點、以模板為底再 primer、改 0.11 控場 HTTP

---

## 0.11.0 — 玩家過強輸入與 GM 控場（2026-09-10）

故事頻道維持自由文字。超過本場合理範圍的行動先經輕量／深審閘門；仍過線則在獨立 GM 側欄談說服、切分或重輸，終態前不進對局 session／Writer。`player-memory/` 只存已承認事實與能力。待決時故事輸入不鎖，送出新句即改寫。見 `docs/roadmap/0.11.0/`。

### Added

- 硬拒（未成年人／契約攻擊）與輕量／深審兩層閘門
- `POST /api/gm-chat`、`gm-meta-sessions/`、pending 落盤
- `player-memory/current.json`；setup 空檔；(1) 接受時 append
- GM／Debug 同右側抽屜分頁（Debug 僅 `config.debug`）；待決提示可改寫；側欄送出立刻顯示玩家句

### Non-goals

- 技能表／戰鬥、玩家 psyche、無 pending 的 GM 閒聊、故事氣泡確認卡

---

## 0.10.0 — L2 NPC 心理深度（2026-09-10）

`memory_tier === 2` 另存 `npc-memory/l2/{id}/psyche.json`（性格、人生／中期／短期目標、喜好／厭惡）。GM `npc_memories` 附 `psyche`；Default 瑪拉／灰有預製。升 2 建空檔。僅 **離場** NPC compact 後 psyche 短呼叫更新；session near_cap distill **不**改 psyche。不 hop；不進 HTTP。見 `docs/roadmap/0.10.0/`。

### Added

- `l2/{id}/psyche.json` 六欄 schema 與 load/save
- Default seed 瑪拉／灰預製 psyche
- 離場 compact 後 `compact-npc-psyche` 短呼叫
- `gm-contract` psyche／persona／body 優先序

### Non-goals

- L0／L1 心理檔、每回合 GM 改 psyche、玩家可見心理 UI、`private_notes` merge、改 compact 觸發表

---

## 0.9.0 — 回合處理中 UI（2026-09-09）

對局送出一句、`POST /api/turn` 尚未回來時，輸入列可見「處理中」＋簡易 spinner；busy 期間鎖輸入、送出與次要控件。回來後立刻撤掉。不改回合契約、不做 streaming。見 `docs/roadmap/0.9.0/`。

### Added

- 對局 `#form` 內 busy 列（「處理中」＋ CSS spinner）；`setTurnBusy` 設／`finally` 撤
- busy 期間 disable `#send`／`#go-home`／`#restart`／`#delete-world`（及可見 `#debug-compact`）

### Changed

- `showPlay` 進入對局時恢復送出與次要控件可點（避免回主頁後殘留 disabled）

### Non-goals

- Streaming、進度百分比、取消 turn、改 setup「生成中…」、改 debug compact 文案、改 `POST /api/turn` 契約

---

## 0.8.0 — 角色記憶：情景摘要與定位（2026-09-09）

廢 `salient_quotes` 與 session jsonl 剪句餵 GM。過去＝情景 summary + locator。回想新增閘門（iii）：點名 L2＋有 archive 即可掃（不要求 present／不要求名缺席近 8 episode）。對白全文只在 `session-archive` jsonl。不 hop。不改 0.6.0 compact scope。見 `docs/roadmap/0.8.0/`。

### Changed

- NPC archive 新寫入省略 `salient_quotes`；index 帶 `summary`、刪 `quote_count`
- Compact NPC 短呼叫只出 `title`／`summary`／`distilled_body`
- 回想只餵 summary＋locator；刪 `excerptJsonl` 熱路徑
- 點名已離場／不在場 L2 仍可召 archive（閘門 iii）

### Non-goals

- GM 讀檔 tool、每回合掃全部 archive、心理欄、歷史 UI、舊 quotes hop、改 compact 觸發表

---

## 0.7.0 — 多世界存檔（2026-09-09）

玩家可同時保留多份完整 playthrough（各 uuid 目錄），從主頁開始新故事或載入；開新不得抹其他存檔。遊玩中可回主頁（不清檔）或輸入 `delete` 刪目前這份。新 process 啟動刪 pointer→一律主頁。舊 `kb/runtime/` 不讀不搬。見 `docs/roadmap/0.7.0/`。

### Added

- Parent `kb/worlds/`；每存檔 `kb/worlds/{uuid}/`（`world.json` 含 `save_name`）；`current.json` pointer
- 主頁畫面；`GET /api/state` 的 `screen`／`save`；`GET /api/worlds`；`POST /api/worlds/load`｜`/home`｜`/worlds/delete`
- Setup 必帶 `save_name`（寫入單一 `world.json`，兼 UI title；無另檔 `save.json`／`title`）；env `VIBE_GAMEVERSE_KB_WORLDS`
- Setup／首次進入（零 episode）自動開場回合；回應 `opening`；UI 只渲染 GM 氣泡

### Changed

- 廢「清空唯一 runtime」的 new-game 語意（`/api/new-game`＝`/api/home`）
- 忽略舊鍵 `VIBE_GAMEVERSE_KB_RUNTIME`；gitignore `kb/worlds/`
- `world.json` 單檔含 `save_name`（不再另開 `save.json`／`title`）

### Non-goals

- 舊 runtime hop、同一世界多槽、匯出／雲同步、開機「繼續上次」

---

## 0.6.0 — Compact 分 scope 與同回合平行（2026-09-08）

人離開舞台時只封該名 L2；jsonl 換檔是較瘦的 session 線。廢 0.5.0 judge 與進出問整場。同一 HTTP 回合內 `allSettled` 平行短呼叫，不背景、不鎖。失敗解耦。倉庫 `max_turns_without_compact` 預設 8。見 `docs/roadmap/0.6.0/`。

### Changed

- Compact 拆 NPC／session 兩 scope；`present` 進出不再觸發 session compact
- 熱路徑不呼叫 judge；session 觸發＝滿 N、`scene_id` 換幕、或強制線
- 離場有資格 L2 與（若 session）summary／在場 ≥640 同時開跑，聚合 `allSettled`
- NPC 失敗只回滾該 id；session 自身仍 fail-closed，不回滾已提交的離場 NPC

### Non-goals

- 背景 compact、per-id 鎖、搬 `kb/runtime` 樹、debug 分鈕、`pi-subagents`

---

## 0.5.0 — Session compact（封存活對局 + L2 archive + 一層回想）（2026-09-07）

長局把活 jsonl 封進 `session-archive/`、開新對局 session；同一拍寫重要性 2 的 NPC `archive/` 並 distill `current`。取消 L2 800 硬截。活目錄改名 `play-sessions/`。根目錄 `config.yaml`。對局 GM JSON 必填 `scene`。回想：啟發式才掃，最多兩份細節。見 `docs/roadmap/0.5.0/`。

### Added

- 根目錄 `config.yaml`（缺檔／鍵型錯誤則啟動失敗）；測試可用 `VIBE_GAMEVERSE_CONFIG`
- `kb/runtime/play-sessions/`、`session-archive/`、`compact-state.json`
- Compact judge／summary／NPC archive 獨立短呼叫；整步失敗回滾
- 一層回想（GM 前啟發式；摘錄不進玩家 HTTP）

### Changed

- 廢 L2 current UTF-16 800 硬截；`near_cap` 640 仍只當 distill 優先，不觸發封存
- 日常 Writer 保留 `since_session_archive`；成功 compact 才寫入 `archive_id`
- GM JSON 必填 `scene`；Writer 每回合落盤 `scene.json`
- 開機舊 `pi-sessions/` 在尚無 `play-sessions/` 時改名一次
- 新遊戲刪 `play-sessions/`、`session-archive/`、`compact-state.json`

### Non-goals

- 歷史 UI、多存檔槽、第二層章 rollup、clone Engram、對局 GM JSON 回想點名欄

---

## 0.4.0 — NPC 分層記憶（池 + L2 現用 + dirty set）（2026-09-07）

對局除世界 KB 外，NPC 有分層主觀記憶：L0／L1 同在 `npc-memory/pool.json`；升到 2 才有 `l2/{id}/current.json` 且永不降級。Default 瑪拉／灰開場即 L2（短常數）。Writer 在世界 KB 之後機械更新；不開第二模型。本版 **不寫** NPC archive、**不** compact jsonl。見 `docs/roadmap/0.4.0/`。

### Added

- Entity `memory_tier`（僅 `kind: "npc"`；缺欄當 0；非 npc 有值則 parse 失敗）
- `kb/runtime/npc-memory/`：`pool.json`、`dirty-set.json`、`l2/{id}/current.json`
- `GmContext.npc_memories`（僅 `scene.present`；對玩家 HTTP 不含此欄）
- 升 2 原子寫入與測試注入回滾；L0 十二回合遺忘；custom 生成 1／2 改寫為 0
- Archive 僅 zod 契約（`NpcArchiveIndexSchema`／`NpcArchiveEntrySchema`），回合／setup／new-game 不建 `archive/`

### Changed

- Default setup 寫瑪拉／灰 L2 current 與 dirty `touched`；custom 空池、無 `l2/`
- `clearPlaythrough`／新遊戲 recursive 刪 `npc-memory/`
- `prompts/gm-contract.md` 加不串台短規則（僅 pi system）

### Non-goals

- session compact、寫入 NPC `archive/`、第二模型、記憶編輯 UI、hop migrate 舊存檔

---

## 0.3.0 — NPC 人設離開 source；custom canon 改名（2026-09-06）

執行期只寫 `kb/runtime/`。NPC 人設進 entity `persona`（seed copy 進 runtime）；對局只讀 runtime，不讀 repo `npc-*.md` 與 seed。Custom `gm_canon` 落在 `gm_canon.md`。`syncWorldGate`：custom 缺／空 canon 與無效 world 同形 `needs_setup`＋`world: null`。不做舊路徑 migrate。見 `docs/roadmap/0.3.0/`。

### Changed

- `Entity.persona`（optional；空 trim 當缺欄；非空 1–2000 UTF-16）；default 瑪拉／灰全文自原 npc markdown 遷入 seed
- Default 對局 system＝`gm-contract.md` + `gm-default.md` + runtime persona；custom＝契約 + `gm_canon.md` + runtime persona
- `commitCustomWorld` 寫 `gm_canon.md`；`clearPlaythrough` 刪該檔並仍刪殘 `runtime/prompts/`
- 刪 repo `prompts/npc-*.md` 與殘留 `prompts/gm.md`
- 引子洩漏檢查含 `persona`；生成器 userPrompt／retry 與 zod 同一套

### Non-goals

- 不 migrate 舊 `runtime/prompts/gm.md`；不恢復指紋；不改 `MemorySlice`；不把 GM 契約搬進 kb

---

## 0.2.0 — 世界起始劇本（default / custom primer）（2026-09-06）

開局先選預設鏽燈酒館（`kb/seed/`）或自訂四段引子；引子經獨立 pi job 生成 KB，**使用者原文不是 seed**。完成 setup 後才進入既有回合迴圈。未完成時 `POST /api/turn` 回 409（`needs_setup: true`）。**無** KB runtime 結構 migrate（構想見 `docs/roadmap/backlog/kb-runtime-upgrade.md`）。見 `docs/roadmap/0.2.0/`。

### Added

- `world.json`（`source`：`default`｜`custom`、`title`、`created_at`）作為 setup commit 標記
- `POST /api/setup/default`；`POST /api/setup/custom`（primer → 生成 seed）；`POST /api/new-game` 清空 runtime（含 `pi-sessions`）後只 `disposePlaySession`，回到起始選擇
- Custom：獨立生成 session（`noTools`、不寫對局 jsonl）；mock 走霧港 harbor fixture，不打外網
- Web：needs_setup 時起始選擇；header／`<title>`／placeholder 隨 `world.title`

### Changed

- `ensureRuntime` 不再偷灌 seed；測試灌 default 須顯式 `setupDefaultForTest`（或 `POST /api/setup/default`）
- Default 對局 system＝`gm-contract.md` + `gm-default.md` + `npc-bartender.md` + `npc-ash.md`；custom＝契約前綴 + runtime `gm_canon`
- `createPlaySession` 僅 ready 之後依 `world.source` 組 prompt；禁止 `resetPiGm`（dispose 後立刻開酒館 session）
- Coerce 禁止預設酒館；缺 `gm_note` →「本場進行中。」
- **有效** `world.json` → ready；缺檔或無效 → setup，無效檔不改寫。不依 `kb/seed` id 救援舊局

### Non-goals

- 多存檔槽、多地點、戰鬥、生圖、真多 agent NPC、session compact、KB store migrate
- 改 OpenRouter 直連（仍只經 pi）
- 把 NPC 人設遷出 repo `prompts/`（0.3.0 已做）

---

## 0.1.0 — 鏽燈酒館 POC（一回合迴圈）（2026-09-05）

單一地點鏽燈酒館可玩：玩家 + 瑪拉 + 灰 + 一條紙條線索。Program（Bun）管回合；GM 為 pi 接續 session（或 mock）；Writer 落 Episode／Entity／Relation。開服空庫即 copy `kb/seed/`；開頁直接對話，無 setup。**無** `world.json`、**無** compact。見 `docs/roadmap/0.1.0/`（事後補寫）。

### Added

- Web UI 對話迴圈；`POST /api/turn`
- `kb/seed/` 開場實體；runtime KB + `pi-sessions/`
- `prompts/gm.md`（契約與酒館 canon 同檔）+ `npc-bartender.md`／`npc-ash.md`
- `GM_MODE=pi`｜`mock`；模型經 pi／OpenRouter，app 不直連

### Non-goals

- 選劇本／custom 生成、多地點、戰鬥、生圖、session compact、多存檔槽

