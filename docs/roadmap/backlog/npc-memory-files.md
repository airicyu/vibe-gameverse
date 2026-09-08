# NPC 專屬記憶檔

**狀態：** 構想原文。**已由 [0.4.0](../0.4.0/INDEX.md) 出貨現用記憶**。實作與驗收 **只認 0.4.0 INDEX＋docs**；本檔若與 0.4.0 衝突，以 0.4.0 為準。Archive 落盤見 [session-compact](./session-compact.md)。

**現行：** 0.3.0 已 shipped。對局仍是 **單一 GM session** 寫全部 `npc_lines`；NPC 不是獨立 agent。人設在 runtime `entities.json` 的 `persona`；另有可選 `private_notes`。每回合 `memory_slice` 給近 8 則 **世界** episode 摘要 + 全部 entity（僅 `id`／`name`／`summary`）+ 全部 relations。`private_notes` **不進** slice。Writer 只吃 `events[]` 改世界 KB。

本檔**不**覆寫 0.3.0 契約，也**不**把真・多 agent 拉進 POC。與 [session-compact](./session-compact.md)、[kb-runtime-upgrade](./kb-runtime-upgrade.md) 分工：本檔定 **角色記憶落盤形狀**（池、L2 現用、**L2 archive schema**）；**何時 compact、怎麼觸發、搬 jsonl** 由 session-compact **實作**。本項設想 **compact 行為存在**（長局會封存 session、角色 archive 會被寫入），但不在本項寫觸發器。例證皆虛構；勿把 live `kb/runtime` 對白寫進日後 INDEX。

---

## 產品句（構想）

NPC 依 **重要性 0／1／2** 分層記主觀記憶。0 與 1 **同一份池檔**（欄位區分能否過期）；只有池內該角篇幅夠長才升到 **2**，才有獨立現用 summary，且 **永不降級**。開場即可是 L2 的角色（例如預設瑪拉／灰）**不必**先有「過上限」的記憶檔，短 summary 合法。L2 archive 的**格式在本檔定案方向**；**寫入發生在 compact 管線**（session-compact 實作）。

GM 寫台詞時讀「該角所在層的切片」。活著的 pi session 仍可當全場 context；compact 之後舊 jsonl 不在場，不知情靠 **該角 summary／archive（只含他在場時的素材）** 約束，而不是把整段別人密談留在新 session。

---

## 現行行為（錨點）與缺口

| 層 | 現在 | 缺口 |
|----|------|------|
| 人設 | `Entity.persona` | 怎麼演，不是記得什麼 |
| 私筆記 | `private_notes` 不進 slice | 無成長／分層 |
| 世界記憶 | episodes + entity summary + relations | 無「誰在場才知情」 |
| `gm_note` | 導演筆記 | 非角色主觀 |
| 對局 | 單一 GM + 全文 jsonl | compact 前無法從 session **實體刪掉**離場者沒聽到的話；只能 prompt + compact 後改餵什麼 |
| 新角色 | `ensureEntity` | 不進記憶池 |

---

## 重要性 0／1／2（已收斂的方向）

標記只對 `kind: "npc"`。等級在 entity 上（名稱待拍板：`memory_tier`），與正文分開。

| Level | 誰 | 落盤 | 遺忘 | 升降 |
|-------|----|------|------|------|
| **0** | 路人、無實質互動 | **與 L1 同一池檔**，`tier: 0` | N 回合沒再被**實質**用到 → 刪該筆池節 | 可升 1 或跳 2（跳級規則待拍板） |
| **1** | 有實質互動、記憶仍短的常駐 | 同上池，`tier: 1` | **不過期刪人**；池總量超限先 distill 各節 | **不降回 0**。池內**該角色節**過長度上限 → 升 2 |
| **2** | 獨立檔角色 | `{npc_id}` 現用 summary；archive 目錄 **schema 見下、compact 才寫** | 現用硬上限；超了等 compact 進自身 archive，其間可 distill／截斷 | **永不降級**。**不是**「出場＝L2」，也**不是**「L2 必須先有很長的檔」 |

Default 瑪拉／灰：傾向 **開場就是 2**，summary 可極短（酒館常識／對彼此既有印象）。Custom／新 id：預設 **0**。禁止 custom 灌酒館 L2。

酒館雙人常在場、測不到「只餵一角」：**不視為本項缺陷**；角色變多後 `present` 子集才有差。

### 升級：不算露臉、不算招呼

**禁止**用 `scene.present` 次數當升級。站在旁邊不夠。

**也不因**單純招呼／跑堂台詞升級（虛構例：店小二說「歡迎光臨」然後再也沒互動）。

升 0→1 或累積往 2 走，須 **實質互動**，傾向同時滿足或擇一可測條件（閾值待拍板）：

- 該 id 在 `events[].actors`（或 `entity_ids`）且該 event **不是** trivial（見下）
- 與玩家（或已是 L2 的角色）寫入／更新了 **relation**
- 多回合 **非 trivial** 的 `npc_lines`（同一 id 反覆被問、被拜託、被對質）

**Trivial（不升級、可寫進 L0 一筆極短印象或甚至不寫）：**

- 只有問候／讓路／報菜名，且本回合沒有對該 id 的 relation 變化
- 可選：GM／Writer 標 `trivial: true`（若加欄；否則用程式啟發式：單句極短、action 屬 `greet`／`welcome`／`idle` 一類——枚舉待拍板，寧可漏升、不要誤升）

**1→2 的主條件是池內該角正文長度**，不是「戲份感覺主線」。戲份靠實質互動先進 L1；長了才獨立檔。開場 L2 是 seed／產品指定，與長度無關。

升 2：從池 **剪出**該節 → 建獨立現用檔 → `memory_tier: 2`。原子，失敗不半套。不要在升 2 時預建空 archive（第一份 archive 等第一次 compact）。

### L0 遺忘

用最後一次 **實質命中** 的 turn，不是 `present`。N 回合後從池刪該 id。傾向 **不 GC entity**。池總上限：先忘最舊 L0。

---

## 檔案布局

```text
kb/runtime/npc-memory/
  pool.json                 # L0+L1 同一檔
  dirty-set.json            # 已定：dirty set，不是人氣榜；見下節
  {npc_id}.json             # L2 現用（也可用 .md；schema 對齊較易 json）
  {npc_id}/archive/         # compact 才開始有檔；本項只定格式
    index.json
    {npc_archive_id}.json
```

`pool.json` 構想（zod 日後鎖）：

```json
{
  "npcs": {
    "porter": {
      "tier": 0,
      "last_turn": "t0012",
      "body": "幫過一次搬酒，沒問名字。"
    },
    "keeper_aide": {
      "tier": 1,
      "last_turn": "t0040",
      "body": "玩家問過潮燈；我只說聽掌櫃的。"
    }
  }
}
```

L2 現用構想：

```json
{
  "npc_id": "bartender",
  "body": "有人打聽北路；我沒說實話。灰今晚話少。",
  "updated_turn": "t0041"
}
```

現用 `body` 硬上限（數字待拍板，量級同 `gm_note`）。**禁止**現用／池節存逐字對白。

「新遊戲」清整個 `npc-memory/`。測試只用 `VIBE_GAMEVERSE_KB_RUNTIME`。

---

## Dirty set（已定）

每回合讀取仍用 `scene.present` + `memory_tier`，**不要**用 dirty set 當在場白名單。

**已定：做 `dirty-set.json`，不做「熱門角色」榜。** Compact／distill **不要 glob 全部 L2 檔進模型**；掃 dirty set。L2 只有兩三個時檔仍在（可能很短），省略檔會讓 compact 與 Writer 分叉。

```json
{
  "since_session_archive": "sa_014",
  "touched": ["bartender", "ash"],
  "near_cap": ["bartender"]
}
```

- `touched`：自上次 session compact 以來，summary／池節被寫過的 npc id  
- `near_cap`：現用 `body` 接近上限、下次 compact 應優先壓進該角 archive  

寫記憶的程式每回合更新；compact 成功後收拾（例如已 archive 的移出 `near_cap`，必要時清 `touched`）。

---

## 誰寫（傾向，仍可在排程時改）

| 產物 | 誰寫 | 何時 |
|------|------|------|
| 世界 episodes | Writer 吃 `events[]`（現行） | 每回合、compact 前 |
| 池節／L2 現用 | **Writer 機械**從本回合非 trivial 的 events／該角 `npc_lines` 覆寫該節短 body（主觀一句，不是抄台詞） | 每回合、只碰相關 id |
| L2 archive 檔 | **compact 管線**（模型 distill，獨立於對局 GM JSON） | session compact 時 |
| `dirty-set.json` | 寫記憶的程式 | 每回合 touched；compact 後收拾 |

不在對局 GM JSON 加厚記憶欄（漏寫成本高）。若機械一句太乾：compact 時用模型重寫該角 summary＋archive，日常回合仍機械。**不要**每回合對每個在場 NPC 再開一次模型。

---

## GM 怎麼讀；session 當 context 與「離場不知情」

活 session 當 context **可以**，也是現況。問題是：灰離場後瑪拉與玩家密談，jsonl 仍在；灰回來時同一 GM **看得到**那段。分檔無法從 jsonl 挖掉。

本構想在 **有 compact** 的前提下這樣收：

1. **寫入角色記憶時過濾在場：** 某 turn 更新 npc X 的池／summary／（compact 時）archive，只准用 X 在 `present`（或該 turn 的 actor）時的公開場面與他自己的台詞。離場期間的密談 **不准**寫進 X。  
2. **Compact 後新 session 不帶回舊 jsonl。** 新 session 帶世界 beat summary + `gm_note` + 在場者的 **L2 summary（及按需該角 archive 摘錄）**。灰沒經歷的密談若只存在已封存的 session archive 與瑪拉的 archive，預設 **不要**為了寫灰的台詞去打開那份 session archive。  
3. **回想**才按需打開 session archive 或該角 archive（見 session-compact）；打開時仍按 npc_id 過濾摘錄。  
4. Compact **之前**的同一條活 session：知情仍靠 prompt（「寫 X 時禁止用 X 不在場時的資訊」）。這是單一 GM 的硬限制，本項不假裝已實體隔離。緩解：離場若構成段落，compact 項可考慮「L2 離開 present」當 judge 輸入，**不**寫死「一離場就 compact」。

酒館兩人一直在場時兩份 L2 會同時進 prompt：接受，靠 prompt 防串台。

---

## L2 archive 格式（本項定形狀；compact 實作寫入）

與 session archive **分目錄、分 id**。同一 beat 可互指，禁止把整份 `session.jsonl` 複製進每個 NPC 目錄。

**何時寫（契約給 compact 實作）：** 每次成功的 session compact，對「本段曾實質出場」的每個 L2（`dirty-set.json` 的 `touched` ∩ 本段 turn 的 present／actor，規則由 compact 實作收斂），寫一筆該角 archive，並把該角現用 `body` distill 成較短的接續 summary。L0／L1 **無**獨立 archive（L0 靠遺忘，L1 留在池）。

`{npc_id}/archive/index.json`：

```json
{
  "npc_id": "bartender",
  "entries": [
    {
      "npc_archive_id": "na_bartender_003",
      "session_archive_id": "sa_014",
      "turn_from": "t0030",
      "turn_to": "t0041",
      "title": "北路被打聽、未說實話",
      "body_chars": 400,
      "quote_count": 2
    }
  ]
}
```

`{npc_archive_id}.json`：

```json
{
  "npc_archive_id": "na_bartender_003",
  "npc_id": "bartender",
  "session_archive_id": "sa_014",
  "turn_from": "t0030",
  "turn_to": "t0041",
  "title": "北路被打聽、未說實話",
  "summary": "有人追問怪人與北路。我含糊帶過，怕扯上燈手。灰在場後半段。",
  "salient_quotes": [
    { "turn_id": "t0036", "speaker": "player", "text": "北路燈手是不是你認識的人。" },
    { "turn_id": "t0036", "speaker": "bartender", "text": "這裡每天都是怪人。" }
  ]
}
```

欄位規則：

- `summary`：該角主觀，硬上限（待拍板）。只含他在場／為 actor 的素材。  
- `salient_quotes`：可空；**上限條數與每條字數待拍板**（傾向每段 0–3 條）。來源只准：該角自己的 `npc_lines`、以及 events 標到他的**玩家對他說的話**。禁止塞進其他 NPC 的密談、禁止整場劇本。  
- `session_archive_id`：對應那次 GM jsonl 封存；沒有對應（強制 token 截斷等）可省略，但 index 仍要能單獨撈該角。  
- 現用檔 compact 後：`body` 變成「接續短箋」（含指向 `npc_archive_id` 的一句亦可），不是清空角色。

失敗模式：把 jsonl 全文拷進 NPC 目錄；離場期間的對白進該角 archive；index 與 session archive 對不上。約束：prompt + zod；compact 實作負責原子寫入。

---

## 與既有層分工

| 產物 | 視角 | 誰寫 | 給誰吃 |
|------|------|------|--------|
| `persona` | 怎麼演 | setup／生成 | 對局 system |
| episodes／relations | 世界 | Writer | `memory_slice` |
| `gm_note` | 導演 | GM | 每回合 GM |
| **pool（0+1）** | 路人／短常駐主觀 | Writer 機械 | 在場時該 id 一節 |
| **L2 現用** | 該角當前記得 | Writer 機械；compact 時 distill | 寫該角台詞 |
| **L2 archive** | 該角舊段＋少量原句 | compact 管線 | 回想／compact 後按需，不每回合全灌 |
| pi jsonl | 活對局逐字 | pi | compact 前的 GM 歷史 |
| session archive | 全場已封存對局 | compact | 新 session 開場摘要；回想 |

---

## 非目標

- 不排入已出貨版本；不當 0.3.x hotfix。  
- 不做每 NPC 獨立 pi-agent。  
- 不做玩家可瀏覽的 NPC 日記 UI。  
- 不把 Engram 當 NPC 記憶。  
- Writer 仍不讀 jsonl；compact／distill 吃已 parse 的公開產出 + 在場過濾後的摘錄。  
- 不做多地點狀態機。  
- **本項不實作** compact 觸發、不搬 `pi-sessions` jsonl。  
- L0／L1 無獨立 archive；L2 不降級。  
- 禁止 coerce 酒館進 custom。  
- 不可涉及未成年人。

---

## 開工前仍須拍板

1. `memory_tier` 欄名；0→1 實質互動閾值；trivial 啟發式 vs 顯式標籤；可否 0→2 跳級。  
2. L0 遺忘 N、池總上限、L1→2 的**該節**字數上限、L2 現用上限。  
3. pool／現用精確檔名（上列為傾向 json）。  
4. `private_notes` 廢／留／開場併進 L2 body。  
5. 機械 Writer 主觀一句的模板（過乾時是否只等 compact 才用模型潤）。  
6. Dirty set 欄位細節（`since_session_archive` 缺值、池節 dirty 是否與 L2 同一份 list）。檔名已定 `dirty-set.json`，首版就要做。  
7. Mock fixture。  
8. Archive 數字：`salient_quotes` 條數／字數、`summary` 上限、`npc_archive_id` 編碼。  
9. **觸發與落盤程式** → [session-compact](./session-compact.md)（對讀本檔 schema）。

排進某版時：本檔 ↔ 該版 INDEX 雙向連結。本檔不夠當 HANDOFF。

---

## 錨點檔案（日後實作才改；現在只讀）

- `program/schema.ts`、`program/kb.ts`、`program/writer.ts`、`program/gm-pi.ts`、`program/turn.ts`  
- `kb/seed/*.json`  
- `docs/roadmap/backlog/session-compact.md` — 觸發、jsonl archive、**按本檔 schema 寫 NPC archive**  
- `docs/brainstorm.md` §3.2、§4.2、`docs/handover.md`、`docs/roadmap/0.3.0/`
