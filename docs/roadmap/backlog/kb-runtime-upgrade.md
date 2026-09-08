# KB runtime 結構版本與升級（upgrade / migrate）

**狀態：** backlog 構想，**尚未排入任何 `docs/roadmap/X.Y.Z/`。** 不是承諾範圍；排程前須再開規劃對話收斂已定案。

**現行：** 0.2.0 已 shipped。`kb/runtime` 沒有獨立結構世代標記。`world.json` 只有 `source`／`title`／`created_at`。產品字串在 repo 根 `VERSION.md`（現為 `0.2.0`）。`ensureRuntime` **不**依 `kb/seed` id 救援舊局。無效 `world.json` 不改寫。

本檔**不**覆寫 0.2.0 契約。例證皆虛構；勿把 live `kb/runtime` 或個人 Engram store 寫進日後 INDEX。

---

## 產品句（構想）

`kb/runtime` 是存檔狀態，產品 binary 會改它的磁碟形狀。之後某一版若改了 JSON 欄位、目錄名、或檔案契約，舊 runtime **不能**靠「新程式硬讀舊盤」或「偷偷改成最新字串假裝已升級」。要有：**結構世代標記**、**啟動時偵測目前指向的 runtime 是否落後**、以及 **可重複、機械化的 hop（migration）**。傾向：program start（`ensureRuntime` 之後、聽 HTTP 之前）若偵測到須升級，則 **跑 hop 鏈**（或明確拒啟並提示跑同一套 script／skill）——見「與 Engram 的差異」。

---

## 參考：Engram 怎麼做（只借架構，不 clone）

Engram 把「產品發行版」與「記憶庫磁碟結構代」拆開。vibe-gameverse **只參考這套分工**，不要把 Engram store、skill 目錄、或私人庫當本專案 runtime。

| 概念 | Engram | 對本專案的含義 |
|------|--------|----------------|
| 產品版 | binary／`version.md` | 本 repo `VERSION.md`（例 `0.2.0`）。UI／changelog 用這個。 |
| 結構代 | store 內 `store_version`（semver，寫在 `engram.workspace.yaml`） | runtime 自己要有等價標記（檔名待拍板）。語意是 **磁碟形狀世代**，不是「上次用哪版 bun start」。 |
| 比對 | 只比 **major.minor** | 同：patch 不當結構邊界。 |
| 何時 bump 舊庫 | **只有改盤 hop** 才抬最低結構代；沒改盤的產品版不強制 bump 既有庫 | 同：例如只改 prompt／UI 的 0.2.1 **不要**逼所有存檔 migrate。 |
| 同代多字串 | 新建庫可 stamp 當下產品版，形狀仍屬舊結構代 → 多個字串同一 hop | 同：hop 檔須寫准入區間（例 `0.2.x`–`0.4.x` 皆走 `migrate-0.2-to-0.5`）。 |
| 跨代 | **逐 hop**，禁止「任意舊版直達最新」巨石腳本 | 同。 |
| 誰 stamp | 新建 workspace、或 **migrate 成功**。啟動時 **禁止**把缺鍵／舊值偷偷改成產品版 | 同：未跑 hop 就改字串＝假升級，之後 hop 選錯會毀檔。 |
| Boot | `ensureEngramHome` 後 `checkStoreStructure`：缺鍵或 major.minor **低於** `REQUIRED_STORE_STRUCTURE` → **拒啟**（`process.exit`），訊息指向 **engram-migration** skill／`bun ./scripts/migrate-….ts`。**不**在啟動時自動改盤。Escape：`ENGRAM_ALLOW_STALE_STORE=1` 警告後仍啟。非法 semver 仍拒。 | 本專案可借閘門與常數命名；**是否改成啟動自動跑 hop** 見下節（與 Engram 不同，須拍板）。 |
| 執行體 | skill：`SKILL.md`（選 hop）＋每跳 `migrate-FROM-to-TO.md`＋機械 `scripts/*.ts`。只改 `ENGRAM_STORE_DIR`。改檔前備份。優先 script、不要 LLM 重寫正文。離線、**不必先開 server**。 | 本專案可做對等：**upgrade skill 或 `program/` 內 script**，目標目錄＝目前 `VIBE_GAMEVERSE_KB_RUNTIME`（未設則 `kb/runtime`）。 |
| 缺標記 | 0.19+ **拒啟**；啟發式只給人工／skill 選 hop，不自動猜完就改 | 本專案 0.2.0 現場已有無標記 runtime。第一支 hop 必須定義「無鍵＝哪一代」（見待拍板）。 |

Engram 契約原文在其 repo 的 `docs/roadmap/0.16.0/docs/store-version.md`、`0.19.0/docs/store-boot-gate.md`、`.agents/skills/engram-migration/SKILL.md`。本檔已摘要；實作 agent **不要**去改 Engram git。

---

## 與 Engram 的差異（本專案傾向）

Engram 記憶庫是長期私人資料，錯誤 migrate 代價高，所以 **boot 只偵測、人／agent 離線跑 skill**。

本專案 POC runtime 是單場遊戲存檔、路徑明確（含測試隔離目錄）。構想傾向：

1. **啟動偵測**目前指向的 kb runtime 結構代 vs 本 binary 的 `REQUIRED_KB_STRUCTURE`（名稱待拍板）。
2. 若落後且存在對應 hop：**在聽 HTTP 之前跑 migration**（逐 hop、機械 script），成功才 stamp、才 `Bun.serve`。
3. 若過新（runtime 結構代 **高於** 本 binary 所知）→ **拒啟**，不要降級亂改。
4. 若無法判定／沒有 hop 檔 → **拒啟**並印指令（同一支 script 也可手動跑），不要猜。
5. **needs_setup**（無有效世界、空 runtime）→ **不 migrate**；第一次 setup／原子 commit 時 stamp **當下產品版**（與 Engram 新建 workspace 相同）。

「自動跑」仍須：備份或寫入 staging 再 rename（對齊現行 setup 原子落盤）、失敗不半套、測試只動 `VIBE_GAMEVERSE_KB_RUNTIME`。

對照 Engram 的 escape hatch：本專案是否要 `VIBE_GAMEVERSE_ALLOW_STALE_KB=1`（警告後跳過 migrate、用舊契約硬開）**預設傾向不要**——遊戲 JSON 欄位對不上會讓 Writer／GM 靜默壞檔。除錯需要再拍板。

---

## 現行行為（錨點）與缺口

| 層 | 現在 | 缺口 |
|----|------|------|
| 產品版 | `VERSION.md` | 與 runtime 磁碟契約未綁在一起 |
| 世界標記 | `world.json`：`source`／`title`／`created_at` | 沒有 `kb_version`／`store_version` |
| Boot | `ensureRuntime` 建目錄、讀 world 決定 `needs_setup` | 不檢查結構代；不會跑 hop |
| 0.2.0 舊局 | 曾用 seed id 指紋補 `world.json`；**已作廢**（未 public release） | **不要**把「升級機制」做成再一次指紋救援 |
| Seed | `kb/seed/` 只讀模板 | hop 改的是 **runtime**（及必要時 seed 範本，那是產品原始碼，不是 migrate） |
| 測試 | 必須用獨立 runtime 目錄 | migrate 測試同樣禁止 `rm`／改 live `kb/runtime` |

失敗模式：新 binary 讀舊 `entities.json` 缺欄 → zod 炸或 coerce 成酒館；或 boot 把 `VERSION.md` 抄進 runtime 卻沒改檔 → 之後 hop 以為已是新代而跳過。

---

## 構想：標記放哪、hop 長什麼樣

### 標記位置（待拍板，擇一寫進排程 INDEX）

1. **`kb/runtime/kb_version` 或 `manifest.json` 單鍵**（最像 Engram workspace 的 `store_version`；不污染 `world.json` 產品欄）。
2. **`world.json` 加 `kb_version`**：ready 局一定有 world；needs_setup／半套則無標記 → 走「空庫不 migrate」。
3. 兩者都寫：manifest 為閘門真相，world 僅複本——多餘，傾向不要。

傾向 **獨立小檔**（選項 1）：setup 未完成時也可以有空目錄＋缺檔＝未 stamp；與「無效 world 不改寫」解耦。

### Hop 目錄（路徑名待拍板）

對齊 Engram skill 形狀，但活在本 repo（不要依賴 `../engram`）：

```text
.agents/skills/vibe-gameverse-kb-migration/   # 或 program/migrate/
  SKILL.md                    # 選 hop、共用規則、備份
  migrate-{FROM}-to-{TO}.md   # 結構差、准入區間、拒絕條件、自檢
  scripts/migrate-{FROM}-to-{TO}.ts
```

Program start 呼叫的應是 **同一支 scripts**（skill 給人／agent 手動跑；boot 給 `bun start`）。禁止兩套步驟分叉。

每跳只改 runtime 內允許的路徑。禁止改 repo `prompts/`、禁止碰 Engram、禁止把 hop 寫成「叫 GM 模型重寫存檔」。

### 第一代怎麼認現況

0.2.0 已有無 `kb_version` 的 runtime。第一支結構閘門（若排進某版）須寫死其一：

- **無標記且有有效 world** → 視為結構代 `0.2`（准入第一跳的 From）；或
- **無標記一律 needs_setup／拒啟**（較 Engram 0.19，但會踢現有可玩存檔）。

未 public release 時，也可規定「無標記就當 0.2、只 stamp、不改盤」當 **空 hop**（只寫版本檔）。這仍算一次契約，須測試。

---

## 啟動流程（構想）

```text
解析 KB runtime 路徑（環境變數覆寫）
ensureRuntime 建目錄（不偷灌 seed）
讀結構標記
  空／needs_setup → 不 migrate，繼續現行 setup 閘門
  合法且 ≥ REQUIRED → 繼續
  合法但過舊 → 依 hop 表逐跳執行 script（或拒啟＋印同一指令）
  過新／非法 semver → 拒啟，不改檔
聽 HTTP
```

Migrate 成功才 stamp 該 hop 的 **目標結構代**（完整 semver，例 `0.5.0`），不是抄當下 `VERSION.md` 除非該版就是該結構代代表字串。

`POST /api/new-game` 清空 runtime 後不留舊標記；下一輪 setup commit 再 stamp。

---

## 非目標（構想階段就寫死邊界）

- 不排入 0.2.0 hotfix；**不要**用本檔復活 seed 指紋救援。
- 不 clone Engram、不 migrate `engram-data`、不把私人生活庫當遊戲 KB。
- 不做多存檔槽／雲同步／跨機器 schema registry。
- 不把產品每次 release 都做成一支 hop。
- 不用 LLM 當 migrate 引擎。
- 不在 hop 裡改對局 pi session 語意（那是 compact backlog）；除非某版真的改了 `pi-sessions/` 檔名契約。
- 測試與 live 路徑規則維持 `AGENTS.md`。

---

## 開工前仍須拍板（未定案）

1. Boot：**自動跑 hop** vs **Engram 式拒啟＋手動／skill**。本檔傾向自動跑；須書面同意失敗時的 UX（stderr、程序非 0、UI 尚未 listen）。
2. 標記檔名與鍵名（`kb_version` vs `store_version`）；是否放進 `world.json`。
3. 無標記的 0.2.0 runtime 如何歸代。
4. 是否要 stale escape env。
5. 備份：旁鄰 copy vs staging rename；失敗是否保留 `.bak`。
6. Skill 放 `.agents/skills/` 還是只放 `program/migrate/`（POC 可能只需 script＋boot 呼叫）。
7. `REQUIRED_KB_STRUCTURE` 與 `VERSION.md` 誰在出貨時 bump、寫在哪份常數檔。
8. 過新 runtime（用過更新 binary）開舊程式：只拒啟，或提示「請升級產品」。

排進某版時：本檔 ↔ 該版 INDEX **雙向連結**；該版須另寫自足 INDEX／docs／reasoning。本檔本身**不夠**當 HANDOFF。

---

## 錨點檔案（日後實作才改；現在只讀）

- `program/kb.ts` — runtime 路徑、`ensureRuntime`、new-game 清空清單、原子 commit
- `program/schema.ts` — `WorldSchema`；若標記在 world 則於此加欄
- `program/` 伺服器進入點 — listen 前閘門
- `program/test-runtime-env.ts` — 測試 runtime 隔離
- `VERSION.md`、`AGENTS.md` — 產品版 vs 結構代說明
- `kb/seed/` — 只讀模板，不是 migrate 目標
- `docs/roadmap/0.3.0/` — 執行期只寫 `kb/`；hop 同樣禁止寫 repo `prompts/`
