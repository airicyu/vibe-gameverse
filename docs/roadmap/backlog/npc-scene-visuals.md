# NPC 角色圖、場景圖與立繪疊層

**狀態：** backlog 構想，**尚未排入任何 `docs/roadmap/X.Y.Z/`。** 不是承諾範圍；排程前須再開規劃對話收斂：生圖後端、Live2D vs 靜態表情差分、資產落盤位置、與 `needs_image` 契約。本檔仍**不夠**當 HANDOFF。

**現行：** POC **沒有**圖像生成管線。GM JSON 有 `needs_image`（契約欄，實務幾乎恒 `false`），Presenter 只出文字氣泡。`docs/brainstorm.md` §2.3／§5.4 早已傾向「靜態圖＋快取、重要 NPC 少量表情、同場景多回合重用」；POC 可無圖。多版 INDEX 非目標含「完整生圖」。根目錄 `AGENTS.md` 寫明本版不做華麗產品 UI、不做完整生圖。本項是之後某版要 **真的做角色圖與進行中場景圖**，推翻該非目標。

文字 NSFW 仍允許；圖像另有管線與法規風險。 **不可涉及未成年人**（生圖 prompt、參考圖、Live2D 模型皆是）。例證皆虛構；勿把 live `kb/runtime` 或真人照片寫進日後 INDEX。

與 [多套 Default 模板](./default-world-templates.md)、[多世界存檔](./multi-world-saves.md) 分工：模板／存檔提供 **哪一場世界、哪個 npc_id**；本項管 **圖怎麼產、怎麼疊、何時重產**。不把生圖模型當 GM。

---

## 產品句（構想）

重要 NPC **真的有角色圖**（不是佔位色塊）。遊戲進行中依場面 **動態生成並顯示場景**。畫面採視覺小說式疊層更優先：底層 **背景圖**、上層 **角色立繪**（Live2D 或靜態差分）。場景沒轉就 **不重產背景**。角色可 **on demand** 換表情圖。進階才考慮把 NPC 直接畫進同一張場景（難快取、難換表情）。

沒圖時遊戲仍可純文字進行（失敗降級，不要擋 `POST /api/turn`）。

---

## 現行行為（錨點）與缺口

| 層 | 現在 | 缺口 |
|----|------|------|
| UI | 對話氣泡＋輸入 | 無舞台區（背景＋立繪） |
| GM | `needs_image: boolean` | 無 scene／portrait 資產 id、無表情枚舉 |
| 卡司 | `npc_id`、`scene.present` | 未綁參考圖／seed 外觀描述供一致生圖 |
| 快取 | 無 | 每回合若傻生背景會又慢又漂 |
| 後端 | 不直連 OpenRouter 圖；無 Comfy | 生圖跑哪裡未接 |

---

## 顯示架構（傾向分層，另案合繪）

### 方案 A — 背景＋上層立繪（構想預設）

對齊「有背景、有角色立繪的對話」。

```text
[ 背景：本場 scene_id 的一張（或少數氣氛變體） ]
[ 立繪層：present 內要顯示的 NPC，Live2D 或 PNG 表情差分 ]
[ 文字層：既有 narration／npc_lines 氣泡 ]
```

- **`scene_id` 不變** → 重用已快取背景，不呼叫生圖。
- 氣氛大變（火災、深夜、同一酒館但完全另一照明）是否換背景：待拍板。傾向 **另鍵**（`scene_id` + `mood_key`），只有鍵變才重產；不要每回合因一句台詞重畫整個房間。
- NPC 進出 `present`：只加／拿掉上層立繪，**不**重產背景。
- 說話者可略為前層／亮一點；無 Live2D 時用靜態圖也能做。

### 方案 B — NPC 畫進場景一張圖

每幀合成「房間裡站著誰」。表情或換人幾乎都要重產，貴、易漂、難對齊同一張臉。本項 **不當預設**；若做，應是少見的 establishing shot，不是每回合。

### Live2D vs 表情 PNG

使用者提 Live2D。實作要分清：

| | 靜態表情差分（較簡單） | 真 Live2D（Cubism） |
|--|------------------------|---------------------|
| 產物 | 同一角色多張臉／半身 PNG，透明底 | 需模型＋貼圖＋綁定，自動生成管線不成熟 |
| on demand | 缺某個表情再生成並快取 | 表情是參數，不是每張新圖；**生成整套模型** 與「缺怒臉再產一張」不是同一件事 |
| POC 下一階段 | **較可排程** | 可列為 **加分／後續**：先 PNG 立繪疊層，Live2D 當同一 UI 槽位的替換渲染器 |

產品句仍寫「像 Live2D 那樣疊在背景上」；排程 INDEX 須寫死第一版是 **PNG 差分** 還是 **必須 Cubism**。傾向第一版 PNG，API／DOM 預留「立繪槽」，避免綁死 Live2D runtime 才能出貨。

---

## 角色圖（一致性）

重要角色（傾向對齊 L2，待拍板是否路人也生）：

- **一張固定參考／character sheet**（或 seed 外觀欄 + 第一張核准圖）之後所有表情、角度都用同一身份，禁止每回合重抽一張完全不同的臉。
- Default 卡司可 **預產** 進 repo 或 setup 時產一次寫入該世界 runtime。
- Custom／中途新 NPC：**第一次要顯示時** on demand 產參考圖＋至少一個中性表情；之後表情按需補。
- 玩家立繪：待拍板（可不出，避免「我長什麼樣」爭吵）。

表情集合待拍板（例：neutral／smile／angry／uneasy／blush）。GM 或 Presenter 只准從 **枚舉** 挑，禁止自由字串當檔名。缺檔：顯示中性＋背景排隊生圖，文字照常。

---

## 場景圖（動態但可快取）

- 鍵：至少 `world save id`（若已有多存檔）+ `scene_id`（+ 可選 mood）。
- 單場景 POC：多數局 **一整場一張酒館背景** 即可，仍要管線，因為 custom／新模板沒有預置圖。
- 生成時機：setup 後第一幀；或 GM 標場面大變。 **不要** 把現行每回合 `needs_image: false` 理解成永遠不生——該欄語意要重定（見下）。
- 落盤在 **該場 runtime**（存檔一部分），不要寫進 repo `prompts/`。測試只用隔離 runtime。

---

## 與 GM 契約

現行 `needs_image` 太粗。方向（擇一寫進排程）：

1. 廢 boolean，改 `visual: { background?: "reuse" \| "regen", speakers: { npc_id, expression }[] }`。
2. Program **不問 GM** 是否生圖：純用 `scene_id`／present／誰在說話推斷；GM 只出文字。較穩、少模型亂要圖。

傾向 **2 為預設**（少改對局 JSON、少 hallucinate 生圖）。GM 要強換背景時再加窄欄。`needs_image` 在啟用本項前可繼續 coerce 為 false。

Turn **不得**等圖生完才回 narration（生圖非同步；UI 先字後圖）。

---

## 後端（待拍板，對齊 brainstorm）

- 文字 NSFW 主路徑仍可雲端 LLM；**無審查／成人向圖** 傾向 **本地** checkpoint（Illustrious／Pony／NoobAI 一類），雲端圖像 API 不當無限制主路徑。
- 硬體備註（handover）：桌機 4070 SUPER 可跑 Comfy；不必為本項假設 Mac 生圖。
- App **不要**在 browser 直打第三方圖商把 key 曝光；program 或本機 Comfy HTTP。不把生圖塞進 OpenRouter GM 同一條 session。
- `GM_MODE=mock`：固定 fixture 圖或純色，不打外網。

---

## 非目標（本項）

- Realtime 影片、3D 場景漫遊、每句話重產整張合繪。
- 用圖像模型當 GM 或 Writer。
- 把真人照片當 NPC 參考（隱私／肖像）。
- 兒童／未成年外觀的任何生成。

---

## 待拍板

1. 第一版 PNG 差分 vs 必須 Live2D。
2. 誰有立繪：僅 L2、present 全員、或開場卡司。
3. 生圖引擎與是否 Comfy；資產目錄 schema（與 [kb-runtime-upgrade](./kb-runtime-upgrade.md)）。
4. mood 何時算「場景已轉」。
5. `needs_image` 廢除或改結構化；GM 是否允許點名表情。
6. 成人向圖與文字 NSFW 同開還是圖永遠較收斂。
