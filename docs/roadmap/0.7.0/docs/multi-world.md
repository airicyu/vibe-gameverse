# 0.7.0 HOW — 多世界路徑、畫面、HTTP

契約以 [INDEX](../INDEX.md) 為準。本檔寫路徑與 API 形狀。例證虛構。

## 目錄

倉庫預設 parent：`{repo}/kb/worlds/`。測試／覆寫：`VIBE_GAMEVERSE_KB_WORLDS`（絕對路徑，trim 非空）。缺 env 用倉庫預設。舊鍵 `VIBE_GAMEVERSE_KB_RUNTIME` **忽略**（不讀、不當單一 runtime、不當 parent）。

```text
kb/worlds/
  current.json          # 僅遊玩中。主頁不得留下有效檔
  {uuid}/
    world.json          # { "id": "<uuid>", "source", "save_name", "created_at" }
    entities.json
    …（與今日 kb/runtime 同一套 playthrough 檔，含 play-sessions／npc-memory）
```

`save_id`＝UUID 字串（實作 `crypto.randomUUID()` 即可；目錄名小寫 `8-4-4-4-12`）。目錄名與 `world.json.id` 全等。掃描 parent 時只把符合該格式的子目錄當候選世界；其餘檔案／目錄／`current.json` 略過。

`save_name`：trim 後 UTF-16 1–40。非法 400。同時當 UI title（header／清單）；不進 GM。

`current.json`：`{ "id": "<uuid>" }`。zod：`id` 非空字串。指向的目錄必須存在且 **ready**（下節），否則視為無 pointer：刪檔、畫面主頁。

啟動 `bootWorlds()`：`mkdir` parent，並刪 `current.json`（新 process＝主頁）。**不要**建立任何 uuid、**不要**讀 `kb/runtime/`。

內部「目前 runtime 根」＝`join(parent, pointer.id)`（`setActiveWorld`）。無 pointer 時不得對「幽靈 runtime」做 Writer／compact／`clearPlaythrough`。

`clearPlaythrough` 若仍存在：只許清 **單一 uuid 目錄內部**（例如 setup 原子 commit 前清**該** staging 目標），禁止清 parent、禁止 `rm` 兄弟 uuid。

**Legacy `pi-sessions/`：** 僅在某 `{uuid}/` 首次成為有效 pointer（load／setup 成功／ensure 該目錄）時，若該目錄內仍有舊名 `pi-sessions/`，改名一次為 `play-sessions/`。禁止在 parent 根掃改名。舊倉庫級 `kb/runtime/` 仍不處理。

**失敗／殘目錄：** 原子 commit 失敗不得留下半套可玩項；若 process crash 留下 orphan／半套 uuid 目錄，本版 **不**自動 GC——不列出、不可 load；開發者可手刪。

## Ready／清單

對單一 `{uuid}`：合法 `world.json`（含 `id`＝目錄名、`save_name`、`source`、`created_at`）；custom 尚須非空 `gm_canon.md`。

- 可玩 → 可進 `GET /api/worlds`、可 `load`。
- 否則：不列出；`load` 409；不得寫成 pointer。

不要把 parent 下的非 uuid 目錄、檔案、`current.json` 當世界。

## 畫面 × state

| `screen` | 條件 | UI |
|---------|------|-----|
| `home` | 無有效 pointer | 主頁。`world`／`scene` 對玩家為 null。可開新故事（default／custom 表單）或載入 |
| `playing` | 有效 pointer 且該 uuid ready | 對局。header＝`save_name` |

`needs_setup`：本版 **不要**再用「整個 app 沒有唯一 runtime」當主頁條件。建議 `GET /api/state` 以 `screen` 為準；若保留 `needs_setup` 欄，僅當 `screen !== "playing"` 時為 true（好讓舊 UI 過渡），但新 UI **必須**認 `screen`。Turn：非 `playing` → 409。

開機與重整（寫死）：pointer 以磁碟 `current.json` 為準。`GET /api/state` 有有效 pointer → `playing`。**新 process 啟動時刪 `current.json`**（`ensure`／listen 前），故新的 `bun start` 第一次 state＝home。同 process 內瀏覽器重整仍認 pointer，可繼續對局。本版不做「繼續上次」捷徑。

## HTTP

### `GET /api/state`

```json
{
  "screen": "home",
  "setup_status": "idle",
  "world": null,
  "save": null,
  "scene": null,
  "gm_note": "",
  "episode_count": 0,
  "episodes": [],
  "relations": [],
  "gm_mode": "pi",
  "debug": false
}
```

`playing` 時：`world`＝`{ id, source, save_name }`；可另回 `save: { id, save_name }`（與 world 同源，便於舊 UI）。不要把 uuid 清單整包塞進每回合 state（清單用下一支）。

可選保留 `needs_setup: screen !== "playing"` 以免漏改前端。

### `GET /api/worlds`

回 `{ "worlds": [ { "id", "save_name", "source", "created_at" } ] }`，只含可玩。`created_at`／`save_name` 皆取自 `world.json`。排序：`created_at` 新到舊（字串 ISO；同值則 id）。

### `POST /api/worlds/load`

Body `{ "id": "<uuid>" }`。僅 `screen === "home"`（且非 generating）可載入；**playing → 409**（須先 `POST /api/home`）。非法 body（缺 id／非字串）→ 400。id 合法但目錄不存在或不在可玩清單 → **409**（與 INDEX 驗收一致；本版不用 404）。成功：dispose → 寫 pointer → 必要時該 uuid 內 `pi-sessions`→`play-sessions` → continue 或 create → `{ ok: true, world, save }`。

### `POST /api/home`

dispose；刪 `current.json`。不刪 uuid 目錄。`{ ok: true, screen: "home" }`。無 pointer 也 200（冪等）。generating 中：能中止則中止（同 0.2.0 new-game 精神），否則 409。

### `POST /api/worlds/delete`

Body `{ "confirm": "delete" }`。無 pointer → 409。`confirm` trim 後必須全等 `delete`，否則 400、不刪。成功：dispose；`rm` 該 uuid 目錄 recursive；刪 pointer；`{ ok: true, screen: "home" }`。

### Setup

`POST /api/setup/default` body `{ "save_name": "..." }`。  
`POST /api/setup/custom`：既有 primer 欄 **加上** `save_name`。

僅 `screen === "home"`（且非 generating）可 setup；playing 時 409（先回主頁再開新）。**parent 下已有其他可玩 uuid 不得阻擋開新**；禁止沿用現行 `assertCanSetup`「`!needs_setup` → already ready」——那是單槽語意。分配新 uuid → staging → 校驗 → rename 成 `kb/worlds/{uuid}/`（`world.json` 含 id／save_name）→ pointer → 必要時該目錄 legacy session 改名 → `createPlaySession`。禁止 commit 前清 parent 下其他 uuid。成功回應帶 `world`（含 `id`／`save_name`）；可另帶同源 `save`；另帶 **`opening`**（見下）。

### 自動開場回合

Setup 成功、或 load 時該 uuid **尚無任何 episode**，server 以隱含玩家句（場景中性「我環顧四周。」，不假設門／室內）跑一回合 `runTurn`，回應帶 `opening: { turn_id, gm } | null`。UI 只渲染 `gm` 的 narration／`npc_lines`，**不**顯示玩家氣泡。已有 episode 的載入 → `opening: null`（不重跑）。開場失敗 → `null`，UI 退回短系統句。測試用 `setupDefaultForTest` **不**跑開場。

### `POST /api/new-game`

**禁止**再清全部存檔。實作擇一寫死並測：(a) 刪除此 route，前端改 `/api/home`；(b) 改成與 `POST /api/home` 完全相同。禁止仍 `clearPlaythrough` 打 parent。本版不做 410。

### Turn／debug compact

`POST /api/turn`：無有效 pointer 或目標不可玩 → 409 `{ error: "not_playing" }`（或同等；UI 回主頁）。Compact 只碰該 uuid。

`POST /api/debug/session-compact`：同 Turn——僅 `playing` 且有效 pointer；非 playing → 409；只碰 pointer 那份 uuid，不得碰 parent／兄弟。

## UI

**主頁：** 「開始新故事」「載入存檔故事」。開始新故事：save name 欄 + 既有預設劇本／自訂引子。載入：列表按鈕，標 `save_name`。

**遊玩中：** 選項「回到主頁」→ `POST /api/home`，清 DOM 氣泡（等同今日重開畫面＋回主頁）。「刪除此世界」→ dialog，說明不可復原；input 須為 `delete`；確認鈕打 `/api/worlds/delete`；成功後主頁。

「重開畫面」若仍保留：只清 DOM，不回主頁、不 dispose（0.2.0 已定案 11 維持）。

## 測試 BAN

- 只用 `VIBE_GAMEVERSE_KB_WORLDS` 指向 temp parent；勿再依賴 `VIBE_GAMEVERSE_KB_RUNTIME`（即使設了也應被忽略）。
- 禁止 `rm` 倉庫 `kb/runtime`、`kb/worlds`。
- 必測：兩 uuid 並存（開 B 不因 A ready 而 409）；delete 確認字；開機（新 process）無 pointer；decoy `runtime` 不被列出；playing 時 load 409；半套 load 409。
