# 多套 Default 世界起始模板

**狀態：** backlog 構想，**尚未排入任何 `docs/roadmap/X.Y.Z/`。** 不是承諾範圍；排程前須再開規劃對話收斂已定案。

**現行：** 只有一套 default：`kb/seed/` 鏽燈酒館（玩家＋瑪拉 `bartender`＋灰 `ash`；場景 `tavern`；線索蠟封紙條／北路燈手）。[0.2.0](../0.2.0/INDEX.md) 起始二選為 **這一套 default** 或 custom 引子。`prompts/gm-default.md` 綁酒館 canon。Mock 對局 default 走酒館 fixture。

本檔**不**覆寫 0.4.0 契約。例證皆虛構；勿把 live runtime 對白寫進日後 INDEX。

與 [multi-world-saves](./multi-world-saves.md) 的關係：多模板是 **開新世界時的選項**；多存檔是 **落盤後並存**。可分開排程，但 UI「選模板」在多存檔版會更自然。沒有多存檔時，換模板仍會清掉唯一 runtime——產品句較弱，但仍可先做「開新局前選哪套 seed」。

---

## 產品句（構想）

Default 不再只有鏽燈酒館。開新世界時，玩家可從 **多套預寫好的起始劇本** 選一套（仍是 copy seed → runtime，不是把使用者原文當 seed），或走既有 custom 引子。每套模板：單場景、小卡司、一條鉤子，規模對齊現在的酒館 POC，不是開放世界。

---

## 建議新增的模板（四套＋既有酒館）

下列是 **題材與場面約束**，不是已寫好的 entity JSON。排程時每套須有：seed 實體、default canon（對局 system 用）、開場 `gm_note`／`scene`、L2 與否（對齊 0.4.0：開場重要 NPC 可直接 `memory_tier: 2`）、mock fixture（`GM_MODE=mock` 不得串台到酒館）。

| 暫定 id（待拍板） | 題材 | 場面（單場景） | 卡司規模（方向） | 鉤子（方向） |
|-------------------|------|----------------|------------------|--------------|
| `rust-lamp`（現有） | 低魔邊鎮酒館 | 鏽燈酒館 | 玩家＋老闆＋神秘客 | 蠟封紙條／燈手 |
| `cyberpunk` | 賽博龐克 | **一個**據點（夜店、地下診所、或資料販子舖），不是整座巨城地圖 | 玩家＋1–2 名開場 NPC | 一筆委託／一枚植入物／一段被抹的記憶 |
| `sword-dungeon` | 劍與魔法、地下城 | **一處**入口：冒險者公會角落、或地城第一層前廳／篝火，不是層層地圖系統 | 玩家＋1–2 名同伴或公會接案人 | 一張通緝／一扇封門／一件會動的遺物 |
| `esper-city` | 超能力與魔法並存的現代都市 | **一處**室內或屋頂（喫茶、能力仲介所、深夜電車車廂擇一鎖死） | 玩家＋1–2 NPC | 一次能力失控現場的傳聞、或一張「不得在市區釋放」的警告 |
| `when-they-cry` | **只借結構**，見下節 | 封閉小鎮／祭典週的 **一個**公共場所（神社拜殿、祭屋、或村裡唯一的集會所） | 玩家＋2 名 **成年** 村民／外人 | 祭典前後的謠言、誰在說謊、同一句話對不上的時間 |

所有模板遵守：文字 NSFW 可（玩家帶向）；**不可涉及未成年人**；custom 與 default 皆然。

### 「寒蟬」參考範圍（強制寫清，避免實作抄錯）

要的是 **敘事結構**，不是版權角色、不是原作童角卡司、不是血腥解謎攻略文：

- **可借：** 封閉社區、祭典／儀式、鄰居口徑不一致、親切表面下的監視感、資訊被改寫的不安、短鉤子「今晚不要出門」。
- **不可：** 使用《寒蟬鳴泣之時》角色名、地名商標、具體劇情轉寫、循環殺局當系統（本產品無戰鬥／無多周目狀態機）。
- **不可：** 把主角或開場 NPC 做成未成年人。卡司全員 **明確成年**（設定寫年齡區間或職業即可）。兒童若在世界觀遠處存在，不得出現在 `present`、台詞、或可被帶向的性描寫對象。

排程 INDEX 須把上列寫進已定案，避免生成器／作者「還原原作學園」。

---

## 現行行為（錨點）與缺口

| 層 | 現在 | 缺口 |
|----|------|------|
| Seed 路徑 | 單一 `kb/seed/*.json` | 多套會撞檔名（都有 `player.json`） |
| `world.source` | `"default"` \| `"custom"` | 無法區分「哪一套 default」 |
| Default canon | `prompts/gm-default.md` 一份 | 須按模板拆或 `prompts/gm-default/{id}.md` |
| Setup API | `POST /api/setup/default` 無模板 id | 須帶 `template_id`（名稱待拍板） |
| Mock | 酒館 vs custom 霧港 | 每套 default 要有自己的 mock，禁止回落到瑪拉／灰 |
| Coerce | 禁止缺欄填酒館 | 多模板後更不可把未知 id 填成 `bartender` |
| UI | 「預設世界」一顆 | 須列出模板名＋一句導語 |

---

## 構想：磁碟與契約

傾向 **每套模板一個目錄**（待拍板）：

```text
kb/seed/rust-lamp/     # 現行檔遷入，語意不變
kb/seed/cyberpunk/
kb/seed/sword-dungeon/
kb/seed/esper-city/
kb/seed/when-they-cry/
```

對局 default system＝`gm-contract.md` + **該模板** canon + runtime `persona`。禁止開 A 模板卻讀 B 的 `gm-default.md`。禁止讀 repo `npc-*.md`（0.3.0 已刪）。

`world.json` 須能還原模板（否則重開 process 組錯 prompt）。方向（擇一寫進排程）：

1. `source: "default"` 外加 `template_id`。
2. `source` 改成 `"default:<id>"`（破壞舊 world，須 hop）。

傾向 **1**：少改 gate；舊存檔無 `template_id` → 視為 `rust-lamp`。

Custom **不**從這些目錄組 prompt；仍是引子生成。不要做「以某模板為底再 primer」（非目標，除非另開）。

---

## 規模約束（對齊 POC，防膨脹）

每套模板：

- **一個** `scene`／`scene_id`（一個 place）。
- 開場 NPC **最多 3**（含重要配角）；預設傾向 2，與酒館同量。
- **一條**明確線索／鉤子，不要任務日誌。
- 不做地城樓層狀態機、都市區塊旅行、網路入侵小遊戲。
- 開場 L2：僅標成 `memory_tier: 2` 的角色建 `l2/`；路人不要預寫進 seed。
- 測試灌某模板須顯式 setup（對齊「禁止 `ensureRuntime` 偷灌」）。

---

## 非目標（本項）

- 玩家編輯器改 seed、社群上傳模板。
- 把四套做成「章節可切換的同一世界」。
- 實作寒蟬式真・循環存檔（與「一世界一條紀錄」衝突，見 [multi-world-saves](./multi-world-saves.md)）。
- 圖像管線。

---

## 待拍板

1. 模板 id、中文顯示名、一句 UI 導語定稿。
2. Seed 目錄遷徙是否與 [kb-runtime-upgrade](./kb-runtime-upgrade.md) 同 hop（舊 `kb/seed/` 扁平檔）。
3. Mock：手寫每套 vs 只測兩套＋其餘 skip（POC 傾向 **每套至少一條 mock 對局不串台**）。
4. 「寒蟬」模板的正式產品名（避免商標）；canon 用原創鎮名。
