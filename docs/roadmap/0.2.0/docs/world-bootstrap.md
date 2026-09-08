# 0.2.0 HOW — 世界起始（setup）契約

對照基準：[`../INDEX.md`](../INDEX.md)。

## 狀態機

```text
needs_setup  (setup_status: idle | generating)
  ├─ POST /api/setup/default     → ready（原子灌 kb/seed）→ createPlaySession
  └─ POST /api/setup/custom      → generating → 原子 commit → createPlaySession
                                 → 失敗仍 needs_setup，無半套檔
ready
  ├─ POST /api/turn
  ├─ GET  /api/state             → needs_setup: false
  ├─ POST /api/setup/*           → 409（先新遊戲）
  └─ POST /api/new-game          → 清空 + disposePlaySession → needs_setup
```

`needs_setup` 判定 **嚴格依 INDEX 優先序 1→2→3**，不要用「無有效 world 且非指紋則 true、否則 ready」這種兩條件 AND（會把「壞 world.json + seed 指紋」判成 ready）。

摘要：

| 情況 | 結果 |
|------|------|
| 有效 world.json | ready（不理指紋） |
| 有檔但無效 world.json | needs_setup（不改寫、不指紋救援） |
| 無 world.json 且 ids ⊇ seed ids | 補 default world，ready，**保留**多餘 entity |
| 無 world.json 且缺任一 seed id／空／壞 entities | needs_setup |

半套不得開打。下一次成功 setup **取代** runtime，禁止與半套 merge。

## 原子落盤

寫入 runtime **旁**暫存目錄，校驗齊全。Commit 前：刪除或搬走 `kb/runtime` 內 playthrough 檔（entities、episodes、relations、gm_note、scene、turn_counter、world.json、primer.json、`prompts/`；`pi-sessions/` 在 new-game／setup 時一併清）。再把暫存 `rename` 進去。Linux 不可對非空目標目錄 rename 當 merge。失敗：刪暫存。setup 僅在 needs_setup 時發生（ready 時 409）。

## 對局 session 與重啟

- needs_setup：`disposePlaySession`；`getSession` 禁止 lazy／continue。
- setup 成功：`createPlaySession`（`SessionManager.create` 新局）。
- **已 ready 時重開 `bun start`：** `continueRecent` 接 `pi-sessions/` jsonl；`systemPromptOverride` 仍依 **當前** `world.source` 組 contract＋canon。無 jsonl 則 `create` 新對局 session（KB 仍在）。

## Prompt 檔（repo）

| 檔 | 誰用 | 可含 | 不可含 |
|----|------|------|--------|
| `prompts/gm-contract.md` | default 與 custom 對局；生成器也可複用契約段 | JSON keys、narration vs npc_lines、events、gm_note 800、NSFW／未成年人、新角色新 id | 鏽燈、瑪拉、灰、紙條、燈手、酒館 POC |
| `prompts/gm-default.md`（或拆完後的酒館段；可與 npc 檔分開） | 僅 default | 開場卡司、蠟封紙條 canon | — |
| `prompts/npc-bartender.md`、`npc-ash.md` | 僅 default | 人設 | — |
| `kb/runtime/prompts/gm.md` | 僅 custom 對局 | 生成器 `gm_canon` | 契約規則可只放前綴、不要酒館 |

Default 對局 system ＝ contract + default canon + 兩份 npc。  
Custom 對局 system ＝ contract + runtime `gm.md`。  
現行單一 `prompts/gm.md` 可改為拼接或 re-export，**語意與今日 default 等價**。

## 檔案（runtime）

| 檔 | 誰寫 |
|----|------|
| `world.json` | setup commit |
| `entities.json` 等 | 見 INDEX |
| `prompts/gm.md` | 僅 custom |
| `primer.json` | 僅 custom；UI 不展示 |
| `pi-sessions/` | **僅對局** `createPlaySession`；生成 job 用記憶體或獨立 tmp，結束即棄 |

`world.json`：`source`、`title`、`created_at`（UTC ISO）。primer 不放這裡。

## HTTP

### `GET /api/state`

| 欄 | 說明 |
|----|------|
| `needs_setup` | boolean |
| `setup_status` | `"idle"` \| `"generating"`（記憶體） |
| `world` | `{ source, title } \| null` |
| `scene` | `SceneState \| null`；**setup 前必須 null**，禁止 `loadScene()` 的 tavern 後備 |
| 現行 | `gm_note`、`episode_count`、`episodes`、`relations`、`gm_mode`；setup 前空即可 |

### `POST /api/setup/default`

無 body。已 ready 或 `generating` → 409。成功：原子灌 seed、`createPlaySession`（default prompts）。回 `{ ok: true, world }`。

### `POST /api/setup/custom`

Body 四 string 鍵，缺省 `""`。校驗：INDEX 第 4 條。已 ready 或 generating → 409。成功原子 commit 後 `createPlaySession`（custom）。`idleTimeout` **≥ 180s**。連線中斷仍須 `finally` 將 `setup_status` 設回 `idle`，且不落盤。

生成：同一 session 最多 3 次模型回覆。Mock setup：`program/world-mock.ts` 霧港，不重試。

### `POST /api/turn`

needs_setup → 409。`scene_id` 預設＝當前 `scene.scene_id`，**不要** schema default `"tavern"`（改為可選；缺則用已載入 scene；無 scene 則 409）。

### `POST /api/new-game`

刪 playthrough 檔與 `pi-sessions/`、runtime `prompts/`。`disposePlaySession()`。**不要** `createPlaySession`。回 `{ ok: true, needs_setup: true }`。

若 `setup_status === generating`：能 abort 生成 job 則 abort 並清空；否則 409 直到該請求 `finally` 回到 idle。任何 setup 結束路徑都必須 `idle`。

## 生成器輸出

```ts
{
  title: string,      // 1–40
  gm_note: string,    // 1–800
  gm_canon: string,   // 1–8000
  entities: Entity[],
  scene: SceneState,
  relations?: Relation[],  // 缺省 []
}
```

加碼：恰好一個 `kind: "player"` 且 `id === "player"`；≥1 npc；≥1 place 且 `scene.scene_id` 為其中一個 place id；`present` 含 `player` 與至少一 npc id，且皆在 entities；id 唯一且 `^[a-z][a-z0-9_]*$`；primer 規則 INDEX 16；relations 若有則 schema + 兩端存在。

生成器 prompt 必須列出這些規則（可從 zod 描述組字），不要只靠事後打槍。

User 內容：四欄 primer +「具體化姓名與 private_notes；不要把引子原文當 summary／private_notes」。

## Coerce（`program/schema.ts`）

現行：`npc_id` 缺省 `"bartender"`；`gm_note` 空則「本場：酒館。」；`KNOWN_NPC_NAMES`；`PlayerInputSchema.scene_id` default `"tavern"`。

本版：缺 `npc_id` → `"unknown_npc"`（或丟該 line）；缺 note → `"本場進行中。"`。Display：有 `name` 用 name；否則 default 世界才查 `KNOWN_NPC_NAMES`；custom 查 entities 或顯示 id。

`loadScene` 無檔時 **不要** 回 tavern 物件給 `/api/state`（回 null）。`turn.ts` 不要 `?? "tavern"`。

## Mock：setup fixture vs 對局

- **Setup custom mock**（`world-mock.ts`）：title `霧港`；place `harbor_inn`；npc `keeper`；player `player`。summary／private_notes 不得全等或包含測試 primer。
- **對局 mock**（`gm-mock.ts`）：`world.source === "default"` 可維持現行酒館劇情。`source === "custom"` 必須讀 runtime entities／scene 出對白（至少 `keeper` 或 scene 裡的 npc id），**禁止**瑪拉／灰／紙條。`GM_MODE=mock` 的瀏覽器 custom 一回合走這條。

## UI

- needs_setup：選擇區；disable 回合輸入。中性 `<title>`（如「vibe-gameverse」）。
- `setup_status === generating`：disable 送出。
- ready：header／title／placeholder 用 `world.title`；系統氣泡「世界：{title}。隨便說一句。」
- turn 的 `scene_id` 用 state.scene。

## 測試

- 空庫 boot 不灌 seed。
- `setupDefaultForTest()`（或 POST default）才有酒館實體。
- 指紋：ids ⊇ seed → 無 world 時補 default；缺任一 seed id → needs_setup。
- 無效 world.json + 即便 ids ⊇ seed → needs_setup。
- custom mock；壞 JSON 無 world。
- 缺 npc_id 的 GM JSON → 不是 bartender。
- 隔離 `VIBE_GAMEVERSE_KB_RUNTIME`。
