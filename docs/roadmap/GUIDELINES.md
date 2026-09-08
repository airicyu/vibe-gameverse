# Roadmap 寫作指南（vibe-gameverse）

> 自 airwave/docs/agent-roadmap 通用模板複製並填入本專案補充（2026-09-05）。本檔在 vibe-gameverse 獨立 git 內自足。
> 另見 docs/brainstorm.md、docs/handover.md。


← 專案 overlay 請見各 repo 的 `docs/roadmap/GUIDELINES.md` · **開發節奏：** 同目錄 [agent-workflow.md](./agent-workflow.md)

本檔是 **跨專案共用** 的 roadmap 寫作規範，讓 **另一個沒有對話紀錄的 agent** 也能正確開工。  
寫 roadmap 的 agent 與實作的 agent 常常不是同一個；**對話裡談過但沒寫進檔案的內容，對實作 agent 等於不存在。**

各專案（Engram、vibe-gameverse 等）在自己的 `docs/roadmap/GUIDELINES.md` 放 **薄 overlay**：先遵守本檔，再補專案專屬路徑、測試指令、隱私邊界。

**怎麼開新 agent、何時 design-review／implementation-review、HANDOFF、Track 間自測** → 見 [agent-workflow.md](./agent-workflow.md)。本檔專注 **文件自足與 INDEX 結構**。

---

## 核心原則：Self-sufficient（強制）

Roadmap 是 **跨 agent 交接文件**，不是當下對話的備忘草稿。

| 要求 | 說明 |
|------|------|
| **自足** | 只靠本版 `INDEX`＋其連結的 `docs/`，新 agent 就能知道要做什麼、不要做什麼、怎麼驗收 |
| **禁止腦內省略** | 寫的人「知道那是什麼」不夠；讀的人必須不靠猜測也懂 |
| **禁止過短條目** | 不可只有幾個關鍵字（如「改 path」「加 API」）；每條須寫清 **改什麼、做成什麼樣子、邊界在哪** |
| **相關脈絡一併寫清** | 依賴的舊行為、要推翻的舊語意、對照的 API／檔案路徑，都寫在檔內或明確連結並摘要，勿假設讀者讀過某次 chat |
| **隱私** | **不要把真實的敏感／私人資料寫入 roadmap**（見下節）；例證用虛構情節 |

### 自檢（寫完／開工前）

> **若一個新 agent 只讀這些檔、完全沒有我們的對話，會不會誤解或亂猜？**

若答案不是「幾乎不可能誤解」，就還沒寫夠——補句子，不要補暗示。

### 壞例子 → 好例子

| 壞（靠對話腦補） | 好（自足） |
|------------------|------------|
| Track：搬 day 檔 | 將 `days/{id}.md` 遷到 `days/{YYYY-MM}/{id}.md`；對外 id 不變；行為與上一版等價 |
| 加 retry | `POST /foo/retry`，body `{ reason }` 必填；pending 時對同一 scope 先取消再新 run |
| 不要 supersede | pending 時再跑主流程 → `409`；UI 移除無理由「強制取代」 |

---

## 典型工作流

```
A. 先談再寫
   與 agent 討論 scope → 寫入／更新 roadmap →（可）detail briefing → 開新 agent 實作

B. 先記再談
   先寫 rough INDEX → 再談 detail → 更新 roadmap → 開新 agent 實作
```

**無論哪種：實作前檔案必須已自足。**  
開新 agent 做 changes 是預期行為；**不能把定案留在舊 conversation。**

---

## 隱私（強制）

`docs/roadmap/` 通常進 git，**不是**私人資料庫。規劃／實作／審查 agent **禁止**把 live／私人內容寫進路圖。

| 可以寫 | 不可以寫 |
|--------|----------|
| 結構觀察（路徑、API 欄位、有無某類檔） | 從真人庫／生產資料抄出的正文或近原文 |
| 產品詞、契約、**虛構**好／壞例 | 可識別的生活／客戶／健康／關係／地址／雇主等情節 |
| 測試慣用假 id（如 `acme`、`harbor`） | 把真實人物／專案當例（即使 id 碰巧與 fixture 同名） |

說明失敗模式時，另造虛構人物／專案／地點。

各專案 overlay 可再收緊（例如禁止貼某 store 目錄的內容）。

---

## 生命周期

| 階段 | 產物 | 門檻 |
|------|------|------|
| 構想 | `backlog/*.md`（可較短，但仍須讓人看懂題目） | 非承諾 |
| 排程 | `docs/roadmap/X.Y.Z/INDEX.md`（可先 rough） | 有版本號與產品句 |
| Briefing | 更新 INDEX：已定案、非目標、驗收；需要時加 `docs/`、`reasoning.md` | **待拍板清空或標成非目標** |
| 開工 | — | **「讀完本版 roadmap 即可開工」** |
| 出貨 | 勾驗收；版本／changelog／契約同步；**清 backlog** | 狀態 → `shipped` |

Rough INDEX 允許暫時簡短，但 **進入實作前必須升格為自足稿**。

---

## INDEX 最低必要欄位

每版 `INDEX.md` 至少包含：

1. **標題**、上游版本、changelog／version 連結、**狀態**（`planned`／`in progress`／`shipped`）
2. **產品句**（一句：誰得到什麼、本版邊界）
3. **已定案**（題 → 決定；給實作 agent「勿再問、勿擅自改語意」）
4. **非目標**（防膨脹；可鏈 backlog）
5. **驗收**（可勾 checklist；寫清通過長什麼樣）
6. **錨點檔案**（改前必讀的程式／文件路徑 + 一句用途）

強烈建議（中型以上）：

- **文件地圖／閱讀順序**
- **實作軌道**（Track）：每軌寫 **做什麼／不要做什麼／驗收**
- **與上一版對照**
- 未收斂題目用 **「開工前仍須拍板」** 表，**不要**與已定案混寫

狀態用語：`planned` → `in progress` → `shipped`。

---

## 文件分工

| 檔 | 職責 |
|----|------|
| **INDEX.md** | 做什麼、不做什麼、軌道、驗收（**WHAT**） |
| **docs/\*.md** | 路徑、管線、API／UI 契約細節（**HOW**） |
| **docs/reasoning.md** | 為何這樣定、反例、否決過的方案（**WHY**） |

---

## 何時需要 `reasoning.md`

Detail briefing 之後，若定案對後續判斷有影響，**應寫 reasoning**。

### 應該寫

- 否決或推翻舊文件／舊語意
- 討論過 ≥2 個方案並選定
- 定案靠 **反例／失敗模式** 撐住
- 擔心日後有人「好心改契約」卻不懂在防什麼

### 可以不寫

僅當內容 **trivial**，且寫 INDEX 的人有把握：新開 agent 只讀 INDEX 也幾乎不可能誤解。  
不確定時：**寫。**

---

## 依複雜度選厚度

| 類型 | 最低文件 |
|------|----------|
| 小改 | 自足的 INDEX 即可；可不寫 reasoning |
| 中改 | INDEX + 1–2 份 docs |
| 大改（核心契約／多系統） | INDEX + docs + **reasoning** + 分 Track |

**厚度可省，自足不可省。**

---

## Backlog

- `backlog/`＝**尚未出貨**的構想，不是承諾範圍；總表為 [`backlog/INDEX.md`](./backlog/INDEX.md)
- 條目仍應讓人看懂題意；極短 stub 須在排進 version 時寫完整
- 排進某版後（該版仍 `planned`／`in progress`）：版本 INDEX ↔ 該條 `backlog/*.md` **雙向連結**，並在 `backlog/INDEX.md` 備註已排程版本
- **已經出貨的不該再佔 backlog**（強制）：
  - 該構想若已在某版 `INDEX`＝`shipped`（或 `changelog`／`VERSION.md` 已標該版出貨），**立刻**從 `backlog/INDEX.md` **刪列**，並**刪除**對應獨立 `backlog/*.md`
  - 真相只留在 `docs/roadmap/X.Y.Z/`。backlog INDEX 頂部「已出貨、已自本表移除」可記一句指向該版
  - 禁止：碼與 changelog 已出貨，backlog 仍掛「進行中／已排程」

---

## 寫作 agent 檢查清單

- [ ] 不讀聊天紀錄也能執行本版
- [ ] 已定案每條都是完整句子／完整決定
- [ ] 非目標與範圍膨脹項已寫出或鏈到 backlog
- [ ] 驗收可客觀判斷
- [ ] 錨點路徑正確
- [ ] 非顯設計取捨 → 已有 reasoning（或 INDEX 內等長 WHY）
- [ ] 無「待拍板」殘留（否則仍為 planned）
- [ ] **無真實敏感內容**：例證皆虛構

---

## 實作完成時

- 勾驗收；狀態改 `shipped`
- 更新專案的 version／changelog（路徑見各 overlay）
- **清 backlog**
- 若改了 API／操作邊界／詞彙：同步專案約定的契約文件（見 overlay）

---

## 本專案補充（vibe-gameverse）

- 規格／交接：`docs/brainstorm.md`、`docs/handover.md`  
- version／changelog：根目錄 `VERSION.md`、`changelog.md`；各版細節在 `docs/roadmap/X.Y.Z/` 
- UI：簡單 Web UI；熱路徑 GM：pi-agent + DeepSeek V4 Flash（OpenRouter）  
- 額外隱私：勿把真實私人生活／Engram live store 內容寫進本專案 roadmap  
