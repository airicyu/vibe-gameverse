# vibe-gameverse — Brainstorm

> 匯整自 2026-09-04～09-05 與 Vibe coding 調研的討論。  
> 本檔是設計腦暴／定案紀錄，**不是** research-lab knowledge base。  
> 交接給 Cursor：見同目錄 `handover.md`。  
> 狀態標記：`[定案]` `[傾向]` `[待決]` `[已擱置／之後]`

最後更新：2026-09-05（Asia/Hong_Kong）— 已鎖定一回合 I/O 契約

---

## 1. 專案一句话

做一款 **AI LLM 當 GM 的自由冒險遊戲**：世界與 NPC 有可查、可壓縮的記憶；玩家用文字（之後可換皮）探索；重要角色有一致圖像（先靜態）。

專案路徑（WSL）：`/home/airic/airwave/vibe-gameverse`

---

## 2. 體驗與形態

### 2.1 遊戲形態 `[定案]`

- **文字驅動 + 場景圖／立繪**（現代 AI RPG／視覺小說感）
- **不**一開始追 3D 即時或每幀生成動畫
- 類型視為 **Presentation 可換皮**：世界真相（事件、NPC 記憶、關係、GM note）不跟某一種 UI 綁死
- 之後可演化：更重視覺小說、點擊冒險、輕度模擬等；3D／即時最晚考慮

### 2.2 節奏與延遲 `[定案]`

遊戲不能每走一步都等完整 LLM。分三速：

| 速度 | 何時 | 做法 |
|------|------|------|
| 即時（0 LLM） | 走路、背包、地圖、已生成選項、切場景圖 | 狀態機 + 快取 |
| 短等 | 小動作、一句 NPC | 小模型或預寫／檢索 |
| 長等 | 新章、重大抉擇、場面轉換 | 跑 GM；過場蓋等待；Writer 可在玩家看到結果後背景落盤 |

### 2.3 圖像表現 `[傾向]`／部分 `[待決]`

- 主要是 **靜態圖 + 快取／預製**，不是 realtime 動畫生成
- 重要 NPC：character sheet + 固定參考圖／少數表情差分，重用同一套
- 場景圖：新地點或氣氛大變才換；同一場景多回合重用
- POC：**簡單 Web UI** 呈現文字；立繪／場景可先 2–3 張預置靜態圖，沒圖也能玩
- 完整圖像資產流程（預產 vs 進場景才產、檔名／角色 id）→ **`[待決]`**
- 3D model：不省 LLM token；前期資產貴、後期少重繪。POC 不做

### 2.4 內容尺度 `[定案]`（POC）

- POC 文字：**允許成人向／NSFW**（玩家帶向即可）；法律底線：**不可涉及未成年人**
- 之後若要無審查生圖：本地 NSFW checkpoint（如 Illustrious／Pony／NoobAI）；雲端圖像 API 仍不適合作無限制主路徑
- 雲端 API（Grok／GPT 圖像等）不適合作無限制主路徑

---

## 3. 角色分工（Runtime）

### 3.1 三角色 `[定案]`

| 角色 | 職責 |
|------|------|
| **GM** | 讀記憶切片、裁決互動元素與故事走向、產生事件草案、維護短 **GM note** |
| **Presenter** | 把已定案的場景狀態／對話／選項做成呈現（POC：簡單 Web UI） |
| **Event Writer** | digest 事件，寫入世界 KB（episode／entity／relation 等） |

- Writer 寫的是 **世界／故事內容**
- GM note 是 **當下薄工作筆記**（本幕目標、在場誰、未決後果、下一輪鉤子），與 Writer 的 KB 分開
- GM note：**GM 自己維護、可覆寫短檔**，硬上限（例如 300–800 字），超了壓縮不追加

### 3.2 NPC 怎麼演 `[定案]`

- 起步：**同一模型、不同 system（persona）+ 每回合記憶切片**
- 看起來像多人，實作是按需召喚的角色面具
- 真・多 agent 並行：第二階段（大量背景生活模擬等）再考慮

### 3.3 一回合流水線與 I/O 契約 `[定案]`（POC）

順序：

1. 玩家輸入（自由文字）  
2. 組 GM 短 context（GM note + 相關記憶切片 + 場景狀態）  
3. GM 裁決 → 敘事／NPC 台詞／事件草案／更新 GM note  
4. Event Writer 落盤 KB（吃 `events[]`）  
5. Presenter 演出（吃 `narration` + `npc_lines`）  
6. 等下一輪  

#### 玩家輸入

- **形態：** 自由文字  
- POC 可附 `scene_id`；酒館固定時幾乎只要一句 `player_text`

```json
{
  "player_text": "我走向吧台，問老闆今晚有沒有怪人來過",
  "scene_id": "tavern"
}
```

#### 進 GM（每回合組給模型的 context）

| 欄位 | 說明 |
|------|------|
| `player_text` | 本回合自由文字 |
| `gm_note` | 上一輪短筆記（整份帶入） |
| `scene` | 場景狀態：在場誰、可見物等 |
| `memory_slice` | 相關 episode／entity／relation 的短摘要 |
| `turn_id` | 回合 id |
| `timestamp` | 時間戳 |

#### GM 必出（建議 JSON，程式驗證）

| 欄位 | 說明 |
|------|------|
| `narration` | 主敘事（給 Presenter，POC 可直接顯示） |
| `npc_lines` | `{ "npc_id", "text" }[]`，可空陣列 |
| `events` | 事件草案，交給 Writer：誰／做了什麼／結果／相關 entity ids |
| `gm_note` | **整份覆寫**後的新筆記（非 append） |
| `ui` | 可選下一步提示；POC 因自由文字可先 `null`／`[]` |
| `needs_image` | POC 預設 `false` |

```json
{
  "narration": "酒館煙味很重。老闆擦著杯子，沒抬頭。",
  "npc_lines": [
    { "npc_id": "bartender", "text": "怪人？這裡每天都是怪人。" }
  ],
  "events": [
    {
      "actors": ["player", "bartender"],
      "action": "ask_about_strangers",
      "result": "bartender_evasive",
      "summary": "玩家向老闆打聽怪人，老闆含糊帶過",
      "entity_ids": ["bartender", "tavern"]
    }
  ],
  "gm_note": "玩家在打聽怪人；老闆防備中。神秘客尚未出场。鉤子：是否追問／觀察角落。",
  "ui": null,
  "needs_image": false
}
```

#### Writer

- **輸入：** `events[]` + 當下可知的 entity id／既有 relation  
- **輸出：** 寫入 KB（至少新增 Episode；必要時更新 Entity／Relation）  
- 不負責改 GM note、不負責對玩家說話  

#### Presenter（POC）

- **輸入：** `narration` + `npc_lines`（之後可加 `scene_image`／`portrait` 路徑）  
- **輸出：** 給玩家看的內容；不改世界真相  
- **殼：** **簡單 Web UI**（對話紀錄＋自由文字輸入框；可選顯示靜態圖）。不是 terminal 主畫面，也不是獨立桌面 App。  

---

## 4. 記憶系統

### 4.1 原則 `[定案]`

- **不要**把遊戲記憶塞進個人 Engram 生活庫
- **不要**為了遊戲去 clone 整包 Engram 產品當 runtime（可獨立 data dir 當實驗，但定案偏向另做）
- 做 **瘦版 memory runtime**，Engram 只當概念參考：記事、時間維度 distill、節點、節點關聯

### 4.2 最小四件 `[定案]`

1. **Episode** — 事發即寫：誰／哪／做了什麼／結果／時間／相關 entity ids  
2. **Entity（node）** — NPC、地點、勢力、重要物件；短摘要 + 可選私有記憶  
3. **Relation** — A↔B 關係邊（信任、債務、敵對、知情…）+ 強度／一句理由  
4. **Time block（distill）** — 按場景／日／章節壓 episodes；prompt 預設帶 block + 在場切片，細節用 id 回查

分層直覺：

- Working memory：這一幕進 prompt 的東西  
- Episode log：事件卡  
- Distilled memory：摘要；需要時再取細節  

### 4.3 Context 防爆 `[定案]`

- 不要無限 append 同一條 chat 當唯一真相  
- 產出寫入 memory runtime 後，舊對話不應成為唯一狀態來源  
- 可設 GM／NPC turn token 硬上限；超了先 distill／只留摘要  

---

## 5. 模型與執行路徑

### 5.1 文字模型 `[定案]`

- **GM & Writer：** DeepSeek **V4 Flash**，經 **OpenRouter**（Eric 已有 key）
- Composer 2.5／Cursor CLI：**只用於寫遊戲程式**，不當執行時 GM
- Flash 建議 reasoning 設低或 `none`，避免回合被「想太久」拖慢

### 5.2 熱路徑：pi-agent `[定案]`（2026-09-05 鎖定）

- 第一版熱路徑用 **pi-agent**，**接續 session**（非每回合冷 spawn）
- **太長就 compact**：token 閾值／換場景／每 N 回合（如 8–15）
- Compact **前**：Writer 先落 KB  
- Compact **後**保留：GM note、在場誰、未決鉤子、本場目標（細節指向 KB／episode）  
- 場景切換可開新 session，帶入 GM note + 記憶切片  

備註（討論過的備案，非當前熱路徑）：

- 直打 OpenRouter `chat.completions`：狀態在 `gm_note` + KB，每回合重組短 messages；更可預期、更好存檔  
- Engram 式「冷路徑 spawn agent-cli」：適合 distill、章節壓縮、大批產內容，不適合每步同步大腦  

### 5.3 Skill／約束怎麼放 `[定案]`

- 玩的時候：約束用 **prompt template + 程式驗證**（JSON schema、字數上限等）
- pi-agent skills：偏 **開發／離線產內容**；可與 runtime template 共用規則文字  
- 不要指望只靠模型乖乖聽，要用程式 enforce  

### 5.4 圖像模型 `[傾向]`（POC 可極簡）

- 本地（4070）：SDXL／Flux 輕量，SFW，按需 + 快取  
- 雙機構想（之後）：Mac 跑文字 GM、桌機 ComfyUI 生圖；同區網 HTTP API  
- POC 可不接生圖管線  

---

## 6. 硬體結論（討論記錄）

### 6.1 現有桌機 `[定案／事實]`

- DESKTOP-0HAGO2H：RTX **4070 SUPER 12GB** + 約 **32GB RAM**，i5-12400F  
- 12GB：**裝不滿**舒適的完整 27B；8B–14B 較順  
- 三顆 8B：**不能**三路滿速同時駐留顯存；最多約兩顆在 GPU，第三顆 RAM／輪流載入  
- **不必**為了三顆 8B 去買 Mac  

### 6.2 Mac 選項（若之後要買）`[參考]`

| 配置 | 對本地 LLM |
|------|------------|
| M5 Air／Pro 32GB | 27B Q4／Q5 裝得下；Air 無風扇長打易降速；Pro 同晶片但較能持續 |
| M5 Pro 48GB | 27B 很舒適；70B Q4 硬塞、慢，非日常 |
| 70B vs Grok／Composer | 參數≠段位；好的 27B + 短記憶往往比硬追 70B 划算 |

雙機分工構想：Mac 跑 27B GM，4070 專職生圖（POC 可不做）。

---

## 7. POC Scope `[定案]`

**目標：** 打通「玩 → 有記憶 → 再玩時還記得」，不是大世界。

### 7.1 包含

- **1 地點：** 酒館  
- **角色：** 玩家 + 2 NPC（老闆、神秘客）；同模型不同 persona + 記憶切片  
- **故事核：** 酒館 + **一條小線索**  
- **可玩：**  
  1. 跟 NPC 對話（影響關係／印象）  
  2. 觸發 1 次小事件（拿到線索或物品）  
  3. 離開再回來／隔一段再聊，NPC **記得**先前事  
- **系統：**  
  - pi-agent session 當 GM  
  - 寫入 Episode + 至少更新 1 個 Entity／Relation  
  - GM note 每回合可覆寫  
  - Presenter：文字＋簡單 Web UI  
  - Writer：落盤  

### 7.2 刻意不做

- 多地點、任務系統、戰鬥  
- 生圖管線  
- 多周目、華麗 UI  
- 完整 distill／多章節時間線（可之後加）

### 7.3 驗收

玩約 **15 分鐘**後，**重開 session**（帶入 KB／GM note），NPC 仍能正確提到玩家先前做過的事。

---

## 8. 待決清單

| 項目 | 狀態 | 備註 |
|------|------|------|
| 一回合資料流／JSON 契約寫死 | `[定案]` | 見 §3.3；玩家自由文字 |
| POC UI | `[定案]` | 簡單 Web UI |
| 存檔／讀檔（KB + GM note + session id） | `[待決]` | |
| 圖像資產流程 | `[待決]` | POC 可先跳過 |
| 最小切片實作技術棧（語言、repo 結構、pi 怎麼被 game 呼叫） | `[待決]` | |
| Prompt template 初稿（GM／Writer／NPC） | `[待決]` | |
| 酒館兩 NPC 人設與那條線索的具體劇情 | `[待決]` | 可用極簡版開工 |

---

## 9. 討論過但未採為 POC 的想法

- 每回合直打 OpenRouter、完全不經 agent-cli（仍是長期備案）  
- Clone Engram + 獨立 memory dir 當遊戲庫  
- 本地三模型常駐（GM／Writer／生圖）  
- 為多 8B／70B 先買高階 Mac  
- Realtime 角色動畫生成  
- 無限制本地生圖（文字 NSFW 已納入 POC）

---

## 10. 給之後本地 agent 的提示

若要開工實作，建議順序：

1. ~~定一回合 I／O 契約~~（已見 §3.3）  
2. 建最小 KB schema（Episode／Entity／Relation 檔案或 sqlite）  
3. 接 pi-agent session + Flash（OpenRouter）跑通酒館對話  
4. Writer 落盤 + 重開 session 驗收記憶  
5. 再談存檔 UI 與圖像  

筆記標題參考：`Game memory runtime（Engram-inspired）`
