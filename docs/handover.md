# vibe-gameverse — Handover for Cursor

> 給接手的 coding agent 用。Eric 會把本檔連同 repo 一併交給你。  
> 語言：與 Eric 溝通用**繁體中文書面語**。  
> 日期：2026-09-05（Asia/Hong_Kong）

---

## 你是誰、要做什麼

你在實作／細設計專案 **vibe-gameverse**：一款 AI LLM 當 GM 的自由冒險遊戲（POC）。

設計腦暴已在另一個助手（Grok Bot「Vibe coding 調研」）完成並凍結。**請以本檔 + `docs/brainstorm.md` 為規格起點**，不要重新大開腦暴，除非 Eric 明確要求改定案。

專案根目錄（WSL）：

```text
/home/airic/airwave/vibe-gameverse
```

必讀：

1. `docs/handover.md`（本檔）— 怎麼接、先做什麼  
2. `docs/brainstorm.md` — 定案、POC scope、一回合 I/O、待決清單  

---

## 已定案（勿擅自推翻）

### 產品／POC

- **POC scope：** 1 地點「酒館」；玩家 + 2 NPC（老闆、神秘客）；對話影響關係；1 次小事件；離開再回必須記得  
- **故事核：** 酒館 + 一條小線索  
- **驗收：** 玩約 15 分鐘 → **重開 session**（帶入 KB + GM note）→ NPC 仍能正確提到先前事  
- **不做：** 多地點、任務系統、戰鬥、完整生圖管線、多周目、華麗產品 UI  
- **文字 NSFW：** 允許（玩家帶向即可）；不可涉及未成年人  

### 架構

- **主體是遊戲 program**（不是「只開 pi 聊天」）  
- Program 管迴圈：收輸入、組 context、驗 JSON、寫 KB、呈現、管 GM note／之後存檔  
- **熱路徑 GM：** **pi-agent**，**接續 session**；太長 **compact**（compact 前 Writer 先落 KB；compact 後保留 GM note／在場誰／未決鉤子／本場目標）  
- **GM & Writer 模型：** DeepSeek **V4 Flash**，經 **OpenRouter**（Eric 有 key）  
- **NPC：** 同模型、不同 persona system + 每回合記憶切片（先不要真多 agent）  
- **記憶：** 瘦版 runtime（Engram **只參考、不 clone、不混個人 Engram**）  
  - Episode / Entity / Relation /（之後）Time block distill  
- **一回合 I/O：** 見 `brainstorm.md` §3.3（已定案）  
  - 玩家：**自由文字**  
  - GM 出：`narration`, `npc_lines[]`, `events[]`, `gm_note`（整份覆寫）, `ui`, `needs_image`  
  - Writer 只吃 `events[]` 落 KB  
  - Presenter 吃 `narration` + `npc_lines`  
- **POC UI：** **簡單 Web UI**（對話區 + 輸入框；可掛靜態圖）。不是 terminal 主畫面，不是 Electron  

### 硬體（實作時可參考）

- 桌機：RTX 4070 SUPER 12GB + ~32GB RAM（本地生圖／之後用；POC 可不接生圖）  
- 不必為 POC 假設已買 Mac  

---

## 仍待決（可在實作中跟 Eric 確認，勿默默擴大 scope）

1. **存檔／讀檔**：KB + GM note + pi session id 如何綁成一個 save  
2. **圖像**：POC 要不要預置 2–3 張靜態圖，或先純文字 web  
3. **酒館劇情細節**：兩 NPC 人設、那條線索的具體內容（可用極簡版開工）  
4. **Program ↔ pi-agent 銜接**：如何常駐 session、如何餵本回合 context、如何收回並驗證 JSON  

細節背景見 `brainstorm.md` §8。

---

## 建議開工順序

1. 讀完 `brainstorm.md` §3、§4、§5、§7  
2. 建最小 repo 骨架：`program`（web UI + turn loop）+ `kb/`（或 sqlite）+ `prompts/`  
3. 實作 **一回合契約**：mock GM JSON → Writer 落盤 → Web 顯示（先不接真模型也可）  
4. 接 **OpenRouter Flash** 與／或 **pi-agent session** 當真 GM  
5. 跑通驗收：對話 → 寫 Episode／Relation → 重開 session → NPC 記得  
6. 再補：compact 策略、極簡存檔、可選靜態圖  

---

## 給你的行為約束

- **先打穿 POC 驗收**，不要順便做引擎／3D／無限制內容／大地圖  
- 約束用 **prompt template + 程式驗證**（JSON schema）；不要只靠模型聽話  
- Flash 的 reasoning 傾向設低或 `none`，避免回合過慢  
- 改定案前先問 Eric；小實作細節可自決並在 PR／說明裡寫假設  
- 需要 API key：用 Eric 的 OpenRouter；**不要**把 key 寫進 git  

---

## 檔案現況

```text
/home/airic/airwave/vibe-gameverse/
  docs/
    brainstorm.md   # 完整設計腦暴與定案
    handover.md     # 本交接檔
```

（其餘程式碼可能尚空，由你建立。）

---

## 一句话交接

> 做一個 **program + 簡單 Web UI** 的酒館 POC：自由文字進、**pi-agent（Flash）** 當 GM session、事件寫進瘦版 KB、重開後還記得；規格以 `docs/brainstorm.md` 為準。
