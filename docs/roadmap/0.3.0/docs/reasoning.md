# 0.3.0 WHY — NPC 人設是世界資料，不是程式

對照：[`../INDEX.md`](../INDEX.md)。

## 失敗模式（為何 BAN `prompts/npc-*.md`）

若 custom 或遊玩中新 NPC 被寫成 `prompts/npc-foo.md`：

- 污染 git 與下一場 default（酒館 GM 吃到上一場人設）
- 多場存檔互相覆蓋同一檔名
- 測試改到 live 範本；`VIBE_GAMEVERSE_KB_RUNTIME` 擋不住 repo `prompts/`

0.2.0 已禁止 custom 寫 repo prompts，但 **default 仍從 source 拼瑪拉／灰**，慣例不對稱：實作 agent 會以為「開場卡司本來就在 prompts」。

## 為什麼 GM 契約留在 `prompts/`

`gm-contract.md`／`gm-default.md`／`world-generate.md` 是 **程式怎麼當 GM**（JSON 形狀、default 世界的 GM 規則），不是某一場玩家的存檔。搬進 `kb/` 會讓「換世界」與「換引擎契約」混在同一個可寫目錄，也迫使每場 copy 一份契約、難以修 bug。

`gm-default.md` 仍可含酒館 **GM 規則與線索 canon**（誰在場、紙條是什麼）。那是 default 劇本的固定規則，與「瑪拉這個人怎麼說話」分開：後者進 entity `persona`，前者留 GM 檔。允許輕微重疊（今日 md 與 seed notes 已重疊）；本版不重寫劇情。

## 為什麼是 `persona` 欄而不是 `kb/seed/*.md` 再 copy

獨立 markdown 當 copy 源，看起來仍像 prompt 檔，新 agent 容易再加 `prompts/npc-x.md`。人設掛在 **同一個 entity 物件** 上：setup 本來就要 copy seed JSON；Writer 本來就 upsert 同一檔；custom 生成器本來就出 entities。一條路徑。

否決：在 `program/` 字串常數裡貼瑪拉長文——仍是 source 人設，測試與 git 一樣髒。

否決：只用加長 `private_notes`——該欄已用於引子洩漏與「GM 秘密」，與「角色表／語氣」混在一起難校驗上限；且 0.2.0 的 npc md **並未**等於 notes。遷檔時保持兩欄：notes 留原 seed 文案，md 正文進 `persona`。

## 為什麼對局讀 runtime 不讀 seed

若 default 對局直接 `readFile(kb/seed/bartender.json)`：

- 玩到一半無法用 runtime 覆蓋（雖 POC 無編輯器，但 BAN 的精神是「本場資料在 runtime」）
- 測試改 seed 會影響 live 劇本
- 與 custom（只有 runtime、沒有 seed 人設檔）又不對稱

setup copy 一次之後，GM 只認 runtime，與 custom 同一函數。

## 為什麼 runtime 不用子目錄 `prompts/`

`kb/runtime/prompts/gm.md` 與 repo `prompts/gm.md` 在文件裡無法口頭區分。0.2.0 審查已看到錨點寫 `prompts/gm.md` 被當成落盤目標。改名 `gm_canon.md` 後，grep `prompts/gm.md` 應只剩 **歷史** roadmap。

## 為什麼缺 `gm_canon.md` 的 custom 要 `world: null`

若只把 `needs_setup` 設真、仍回傳有效 `world`，現行 `assertCanSetup` 只看「已有有效 world」會 409 already ready，使用者卡在不能重選、對局又讀不到新路徑。與無效 world **同形**（`world: null`）才能開 setup。這不是 migrate：不讀舊 `prompts/gm.md`、不改寫殘檔。

## 為什麼不 migrate 舊 `runtime/prompts/gm.md`

未 public release（`AGENTS.md` 已聲明不依指紋救舊局）。遷移會讓「兩種路徑都合法」再活一版。缺新檔的 custom → setup，使用者選一次即可。

## 為什麼 custom 也附加 runtime persona

只改 default、custom 仍只吃 `gm_canon`，則生成器若把人設寫進 entity 也不會進 system。同一 `formatNpcPersonas` 讓「人設在 entity 上」對兩條起始路徑都真。不強制生成器填 `persona`：現有 `gm_canon` 仍夠 mock／harbor。

## 為什麼不把 memory_slice 加上 private_notes／persona

那會改 0.2.0 每回合 token 形狀與 Writer 無關的 Presenter 契約，超出「搬檔＋BAN」。System prompt 在 **開 session／override** 時讀 persona 已夠開場卡司；中途新 NPC 仍靠 events + slice summary（與今日相同）。

## 否決過的作法

| 方案 | 否決原因 |
|------|----------|
| 保留 repo npc 檔「只給 default」 | 正是 BAN 對象 |
| custom 人設寫回 `prompts/npc-*.md` | git／多存檔污染 |
| GM 契約整包進 `kb/` | 引擎與存檔耦合 |
| 讀舊 `runtime/prompts/gm.md` fallback | 雙路徑；文件繼續叫錯 |
| boot 指紋救無 world 的酒館 | 已作廢；本版不帶回 |
