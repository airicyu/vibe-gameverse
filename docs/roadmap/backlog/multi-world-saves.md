# 多世界存檔（多份 kb runtime）

**狀態：** 已排入 [0.7.0](../0.7.0/INDEX.md)（`planned`）。**契約以該版 INDEX 為準**；本檔為構想原文。仍有待拍板，尚未可開工。

**現行：** 產品只有 **一份** playthrough 目錄：`kbRuntimeDir`（預設 `kb/runtime/`；測試覆寫 `VIBE_GAMEVERSE_KB_RUNTIME`）。`POST /api/new-game`／setup 原子 commit **清空該目錄內本場檔**（含 `pi-sessions/`、`npc-memory/`）。[0.2.0](../0.2.0/INDEX.md) 非目標曾寫「不做多存檔槽」——本項就是要在之後某版 **推翻該非目標**，改成可並存多個世界。

本檔**不**覆寫 0.4.0 契約。例證皆虛構；勿把 live `kb/runtime` 正文寫進日後 INDEX。

與 [kb-runtime-upgrade](./kb-runtime-upgrade.md) 分工：upgrade 管 **單一 runtime 目錄內的磁碟形狀世代**；本項管 **多個 runtime 目錄當不同世界**。與 [0.5.0](../0.5.0/INDEX.md)／[0.6.0](../0.6.0/INDEX.md) 分工：compact 仍發生在 **目前選中的那一份** runtime 內。

---

## 產品句（構想）

玩家可以同時保留 **幾個已開打的世界**，各自一份完整 KB／pi session／NPC 記憶，**切來切去接著玩**。開新世界 **不得** 抹掉其他世界。每個世界 **只有一條一直 run 的紀錄**——不是同一世界再複製多個 SAVE 槽。

開畫面（needs_setup 或明確「回選單」）可以：

1. **開新世界**（再選 default 模板或 custom 引子；落進 **新的** runtime 目錄）。
2. **開舊世界**（從已存在的存檔清單挑一個，指向該目錄，接續 `continueRecent` 語意）。

---

## 現行行為（錨點）與缺口

| 層 | 現在 | 缺口 |
|----|------|------|
| 路徑 | 全域一個 `kbRuntimeDir` | 無法並存第二局 |
| 新遊戲 | 清空 **同一個** runtime | 想換世界＝丟棄這一局 |
| Setup | 原子 commit 寫進該 runtime | 沒有「另開目錄再 commit」 |
| `world.json` | `source`／`title`／`created_at` | 沒有穩定的 **save id**（目錄名） |
| UI | 起始二選：default／custom | 沒有「已有世界清單」 |
| 對局 session | 依目前 runtime 的 `pi-sessions/` | 切世界須 dispose 再開／continue **該目錄** 的 jsonl |
| 測試 | `VIBE_GAMEVERSE_KB_RUNTIME` 指到 **一個** temp 目錄 | 多槽測試要能指 parent 或 mock 清單 |

失敗模式：開新局仍 `clearPlaythrough` 打到舊目錄；切世界後 `getSession()` 仍接上一局 pi；清單掃描讀到半套（無有效 `world.json`）卻當可玩。

---

## 構想：目錄形狀

傾向 **一個 parent、底下每個世界一個子目錄**（名稱待拍板），例如：

```text
kb/saves/
  rust-lamp-a/          # 一份完整 runtime（今日 kb/runtime 的內容）
  fog-harbor-b/
  custom-2026-09-07-1/
```

**不要** 在同一世界目錄內再做 `save-1`／`save-2` 快照。一世界＝一目錄＝一條時間線（含其 `pi-sessions/`、`npc-memory/`、`gm_note`）。

| 待拍板 | 選項 |
|--------|------|
| Parent 路徑 | `kb/saves/` vs 仍叫 `kb/runtime/` 但改成「目前 pointer + 兄弟目錄」 |
| 目錄 id | 人類可讀 slug（title 轉檔名）vs uuid vs `created_at` 前綴 |
| 「目前在玩哪一個」 | 小檔 pointer（例 `kb/saves/current`）vs 僅記憶體＋env vs `world.json` 旁的 app 狀態 |
| 與 env | `VIBE_GAMEVERSE_KB_RUNTIME` 繼續指 **單一** 測試局；另加 `VIBE_GAMEVERSE_KB_SAVES` 指 parent（測試建兩個子目錄） |
| 舊 `kb/runtime` | 第一支 hop：若存在有效單目錄、尚無 saves parent → **視為第一個世界**搬進去（細節交給排程＋[kb-runtime-upgrade](./kb-runtime-upgrade.md)） |

`ensureRuntime` **禁止**再假設「空就等於可以偷灌唯一 runtime」。空 parent＝沒有舊世界，進選單。

---

## 構想：產品流程

### 開新世界

- **不** recursive 刪 parent 下其他子目錄。
- 建 **新** 子目錄 → 既有 default copy 或 custom 原子 commit **只寫該目錄**。
- 成功後 pointer 指向新目錄，`createPlaySession`。
- 現行「新遊戲」語意須拆：
  - **回選單／換世界**：dispose 對局 session；**不清**其他目錄。
  - **刪除某世界**（若做）：只刪該子目錄；須 UI 確認。本項 **可以不做刪除**，列為待拍板；沒有刪除時只能靠手刪磁碟。

禁止把今日 `POST /api/new-game` 的「清空 runtime」原樣當成開新世界。

### 開舊世界

- 清單來源：掃描 parent 下子目錄，**僅** `syncWorldGate` 會判 **ready** 者可進（有效 `world.json`；custom 尚須非空 `gm_canon.md`）。半套／無效 world **不要**當可玩項；是否在清單顯示「損壞」待拍板。
- 選中後：dispose 舊 session → 設 pointer → 若該目錄有 jsonl 則 `continueRecent`，system 仍依 **該世界** 的 `world.source` 組 prompt。
- Ready 後重開 `bun start`：continue **pointer 指向的那一份**，不是「磁碟上最近改過的任意目錄」。

### 一世界一條紀錄

- **禁止**「另存新檔」「分支周目」「同一 title 開第二條時間線」作為產品功能。
- 若玩家想重打同一模板：那是 **開新世界**（新目錄），舊的鏽燈局仍留著。
- 同一目錄內 compact／jsonl archive 仍是 **這一條** 的歷史，不是第二個 SAVE。

---

## HTTP／UI（方向，非定案 path）

現有 setup／turn／new-game 要能表達 **作用在哪個 save**。傾向：

- `GET` 清單：id、title、source、`created_at`、是否 ready。
- `POST` 選舊世界：body 含 save id；409 若 generating／id 不存在／非 ready。
- 開新世界：沿用 default／custom setup，但 commit 目標為新目錄。
- 已 ready 且未明確「回選單」時，turn 仍只打 **目前 pointer**；不要每回合帶 save id（易打錯檔）。

UI：setup 畫面除「預設模板／自訂引子」外，有 **已有世界** 列表。Header 仍隨 **目前** `world.title`。

---

## 非目標（本項）

- 同一世界多 SAVE 槽、匯出世界包、雲同步、社群分享。
- 多地點／戰鬥／真・多 agent。
- 在兩個世界之間 **共用** 同一 pi session 或 merge KB。
- 自動刪「最舊的世界」做容量管理（除非排程時另開）。

---

## 與測試／BAN

- 測試只動 env 指向的 parent／子目錄，**禁止** `rm` 專案 live `kb/runtime` 或 live saves。
- 必測方向：開 B 不清 A；切回 A 後 `world.title`／entities／pi 接續正確；半套目錄不可 turn；new-world 不 `clearPlaythrough` 打到 A。

---

## 待拍板（排進 INDEX 前須收斂）

1. Parent 路徑、save id 生成、pointer 檔名。
2. 要不要 UI「刪除此世界」。
3. 損壞／needs_setup 子目錄是否列出。
4. 與結構 hop 的順序：先搬單 runtime → 再多槽，或同版一起做。
5. 已 ready 時可否從 header 開清單切走（不經「新遊戲」清空）。傾向 **可以切**，否則「切來切去」不成立。
