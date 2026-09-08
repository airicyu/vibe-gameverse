# 0.2.0 WHY — primer、default 劇本、兩套 session

對照：[`../INDEX.md`](../INDEX.md)。

## 使用者輸入為什麼不是 seed

若把四段表單原文寫進 `entities.json`，GM 每回合只會複誦玩家的世界觀作文，沒有可引用的 **id／私密 notes／在場名單**，Writer 也無法對「新開口的人」做 upsert。POC 的記憶契約是瘦 KB（entity／episode／relation）+ 短 gm_note，不是一篇設定集 markdown。

因此：表單＝**生成種子的引子**；生成器必須產出具體人名、snake_case id、place、scene.present。校驗為 **全等或整欄被 summary／private_notes 包含**（不只 summary 全等）。

## 為什麼還要 default `kb/seed/`

酒館 canon 已通過「可玩 15 分鐘」路徑，也是無 API／mock 的回歸基準。每次開發都強制 custom＋真模型會又慢又不穩。Default 等於凍結的 **世界起始劇本**；custom 是另一條 bootstrap，不刪 seed、不在 custom 成功時改寫 repo 裡的 seed 檔。

## 為什麼生成 job 與對局 GM 分開

對局 session 的職責是 **一回合 JSON**（narration／npc_lines／events），且 `continueRecent` 會把歷史越積越長。若用同一條 session 先「寫世界」再「當 GM」，歷史裡會混進大段設定 JSON，干擾回合契約，也難在失敗時「沒有對局 session」。

分開的失敗模式：生成失敗 → 丟棄 job、不 `createAgentSession` 對局。成功 → 全新對局 session，system 已是本場 canon。

## 為什麼空庫不再自動灌酒館

產品句是「一開始先選劇本」。若 boot 仍 `ensureRuntime` 複製 seed，UI 還沒選就已經是鏽燈局，custom 變成「先洗掉酒館再生成」，新遊戲也無法真正回到選擇門。自動灌只保留給 **明確** `POST /api/setup/default`。

因此指紋是 **id 集合 ⊇ seed 全部 id**（玩過後 Writer 多出來的 npc／item 仍算舊酒館局），不是全等。缺任一開場 id 才當半套。有檔但無效的 `world.json` 優先於指紋：寧可進 setup，也不把壞標記救成 default。

## 為什麼拆 `resetPiGm`

現行函式在新遊戲當下就 `createSession` 且讀瑪拉／灰。0.2.0 的 new-game 必須停在選單；custom 的 system prompt 要等 `gm_canon` 落盤。沿用舊函式會在選單期寫出酒館 `pi-sessions/`，或在 Track C 之前用錯人設。

## 為什麼拆契約前綴

現行 `prompts/gm.md` 把 JSON 契約與酒館 canon 寫在同一檔。整檔當 custom 前綴＝世界觀與瑪拉紙條打架。契約必須零酒館專有名詞。

## 為什麼改 coerce

Flash 常漏 `npc_id`／`gm_note`。缺省填 bartender／「本場：酒館。」會在 custom 局冒出開場卡司，即使 prompt 已換。後備 `scene_id: tavern` 會讓 setup 前的 UI 以為已開打。

## 為什麼 custom 仍單場景

handover／brainstorm 的 POC 邊界是一地點。本版只換「這一點從哪來」（檔案 seed vs 生成 seed），不把旅行系統偷渡進來。`starting_point` 描述的是 **開場那一幕**，不是世界地圖。

## 否決過的作法

| 方案 | 否決原因 |
|------|----------|
| 四段文字當第一句 `player_text` 讓 GM「開場」 | 不會產生 entity 檔；重開 session 只剩 note，世界結構不穩 |
| Custom 也改寫 `kb/seed/` | 污染 default 劇本；測試與 git 難分清 canon |
| 生成結果寫入 `prompts/npc-*.md` | 與現行約定衝突（遊玩產物只進 runtime） |
| 已 ready 時 setup/default 直接覆蓋 | 容易誤觸；要求先新遊戲，語意清楚 |
| 無 world 的非空 entities 一律 default | 半套 custom 會被當酒館（H1） |
| 沿用 `resetPiGm()` | 選單期即開酒館 session（H2） |
| 整份 `gm.md` 當 custom 前綴 | 酒館 canon 汙染（H3） |

## 反例（實作審查可用）

- Custom 成功但 `gm-pi.ts` 仍只讀瑪拉／灰檔 → 世界觀與人設打架。
- UI 仍 `scene_id: "tavern"` 或 coerce 缺省 bartender。
- 生成失敗已寫 entities 未寫 world.json，且舊局規則過寬 → 半套當 default。
