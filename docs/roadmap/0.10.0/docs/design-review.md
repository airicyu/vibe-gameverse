# Design review — 0.10.0 L2 NPC 心理深度

- 日期：2026-09-10（Asia/Hong_Kong）
- 輪次：**第 2 輪複審**
- 角色：設計審查（不改 INDEX／HOW／reasoning／HANDOFF／程式；不以本檔當已定案）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收；HOW [`npc-l2-psyche.md`](./npc-l2-psyche.md)；WHY [`reasoning.md`](./reasoning.md)；[`../HANDOFF.md`](../HANDOFF.md)（待閘門）；上游 [`0.9.0`](../../0.9.0/INDEX.md)／[`0.8.0`](../../0.8.0/INDEX.md)；構想 [`../../backlog/npc-l2-psyche.md`](../../backlog/npc-l2-psyche.md)（非契約）
- 現行程式抽樣：`program/schema.ts`、`program/kb.ts`、`program/npc-memory.ts`、`program/compact.ts`、`prompts/gm-contract.md`（本版尚未實作 ≠ 設計 HIGH）
- **總評：** 無未關閉 HIGH；初審 M1–M3 已關閉、M4 已文件化；非整案不可行。**審查門檻通過**；可依 HANDOFF Track A→D 開實作。

## Findings（本輪）

關閉＝已寫進 INDEX／HOW／reasoning；仍開＝契約仍分叉；非阻擋＝記錄即可。

### HIGH

（無）

### MEDIUM

#### M1 — HOW 以 `commitNpcWrite` 描述 psyche distill 時機，未排除 session scope — **關閉**

**初審題旨（保留）：** HOW「NPC compact — psyche distill」寫「時機：`commitNpcWrite` 成功之後」，未點名僅離場 scope；0.6.0 session compact 的 `sessionNpcWrites` 也會呼叫 `commitNpcWrite`，易誤掛 psyche distill。

**本輪核對（對照現 INDEX／HOW）：** 已定案 **9** 寫「僅在 **離場 scope**…`departedWrites` 迴路內 `commitNpcWrite`」；**Session compact** 的 `sessionNpcWrites` **不**呼叫 psyche distill。已定案 **10** 寫觸發點僅 `departedWrites`、**禁止** `sessionNpcWrites` 後呼叫。HOW「NPC compact — psyche distill」改為「**僅**離場 scope…**`departedWrites` 迴圈**…**禁止**掛在共用 `commitNpcWrite` 函式尾」。Track C「做」對齊 `departedWrites`、「不做」`sessionNpcWrites`。**關閉位置：** INDEX 已定案 9–10；HOW「NPC compact — psyche distill」；Track C。

#### M2 — 定案 9「Mock 給人玩 psyche distill 仍跑（與 archive 同）」易 misread — **關閉**

**初審題旨（保留）：** 「仍跑」可讀成 mock 給人玩也要自動 psyche 更新，與 `mockPlaySkipsAutoCompact`／非目標「不改 compact 觸發表」衝突。

**本輪核對：** 已定案 **9** 改寫為 psyche 短呼叫 mock 行為 **與** `modelNpcArchive` **相同**：`mockPlaySkipsAutoCompact` 為真則 psyche 亦 skip；管線有跑時走 mock fixture／test hook。HOW「Mock」段同級表述。**關閉位置：** INDEX 已定案 9；HOW「NPC compact — psyche distill」Mock 段。

#### M3 — 驗收／測試未覆蓋「session scope 不更新 psyche」與 promote 原子回滾 — **關閉**

**初審題旨（保留）：** 驗收缺 session `sessionNpcWrites` 不變 psyche；缺 promote 時 `saveL2Psyche` 失敗回滾。

**本輪核對：** INDEX 驗收已加「Session compact 含 `sessionNpcWrites`…`psyche.json` **內容不變**」；「promote 1→2：`saveL2Psyche` 失敗時…回滾」。HOW `promoteToL2` 與「測試要點」亦列 session psyche 不變、promote 失敗回滾。**關閉位置：** INDEX 驗收對應兩勾；HOW「promoteToL2」「測試要點」。

#### M4 — 常駐 L2 在一般對局中 psyche 可能僅 seed、不再 evolve — **關閉（非阻擋）**

**初審題旨（保留）：** Default 瑪拉／灰常駐，mid_goal 等 compact 路徑在典型酒館 POC 可能永不觸發；reasoning「封段」易讀成 session compact。

**本輪核對：** [`reasoning.md`](./reasoning.md)「為何不每回合 GM JSON 改 psyche」已明示：常駐 L2 psyche 可能 **長期僅 seed 值** 直到離場 compact——**不是** bug；session near_cap distill 刻意不碰 psyche（定案 9–10）。與 INDEX 非目標「改 0.6.0 compact 觸發表」一致。**關閉位置：** reasoning「為何不每回合 GM JSON 改 psyche」段。

### LOW

| ID | 本輪狀態 | 依據 |
|----|----------|------|
| L1 | **關閉** | reasoning 已對齊「僅離場 NPC compact」；INDEX 已定案 9–10 優先。 |
| L2 | **非阻擋** | 定案 4 仍只寫缺檔 → 空物件；損壞 `psyche.json` 未寫。可沿用 `loadL2Current` 模式，實作可自決。 |
| L3 | **非阻擋** | Track A 未點名 `clipEnd` 放 `schema.ts`；定案 3「zod parse 後 clip」已足。 |
| L4 | **非阻擋** | `prompts/compact-npc-psyche.md` 尚未存在（planned）；HANDOFF 已列錨點。 |
| L5 | **非阻擋**（本輪新增） | HANDOFF 產品摘要寫「更新僅 NPC compact 後 psyche 短呼叫」，未點名「離場」。契約以 INDEX 為準（HANDOFF 已寫）；實作勿只讀 HANDOFF 摘要。 |
| L6 | **非阻擋**（本輪新增） | Track D「做」只寫窄測／出貨，未逐條列 session psyche 不變／promote 回滾；INDEX 驗收與 HOW「測試要點」已自足。 |

## 驗收對照

| 驗收句（INDEX） | 設計層是否可測 | 缺口 |
|-----------------|----------------|------|
| Default 新開：兩份 `psyche.json` zod 合法、六欄符合 HOW | 可 | 無 |
| 遊玩中 1→2：升 2 後空 psyche；`current.json` 同 0.9.0 | 可 | M3 promote 回滾已驗收化 |
| 在場 L2：`buildGmContext` snippet 含 `psyche`；L0／L1 無鍵 | 可 | 無 |
| 缺 `psyche.json` 舊 L2：讀取不 fail；GM 附空六欄 | 可 | L2 損壞檔見 L2 |
| Session compact 含 `sessionNpcWrites`：`psyche.json` 不變 | 可 | M3 已關 |
| promote：`saveL2Psyche` 失敗回滾 | 可 | M3 已關 |
| NPC compact（**離場** scope）後 psyche 更新；失敗不回滾 archive | 可 | M1 離場 scope 已定案；M2 mock hook 已定案 |
| `near_cap` 仍只依 `body.length` | 可 | 與定案 12 一致 |
| `POST /api/turn` 無 `npc_memories`；`gm-contract` 含優先序 | 可 | 現 `gm-contract` 尚無 psyche 段（實作 Track B） |
| `bun test` 全綠；VERSION／backlog | 出貨時 | Track D |

## 與現碼抽樣

現碼未實作本版 ≠ 設計 HIGH。

| 錨點 | 現行 | 0.10.0 提案（INDEX） |
|------|------|----------------------|
| `schema.ts` `NpcMemorySnippet` | `{ npc_id, tier, body }` | L2 可附 `psyche` 六欄物件；需 `NpcPsycheSchema` |
| `kb.ts` `commitDefaultWorld` | 只寫 `l2/{id}/current.json` | 另寫預製 `psyche.json`（HOW 表） |
| `kb.ts` load/save | `loadL2Current`／`saveL2Current` | 需 `loadL2Psyche`／`saveL2Psyche`、缺檔空物件 |
| `npc-memory.ts` `promoteToL2` | 僅 `saveL2Current` | 同 try 寫空 `psyche.json` |
| `npc-memory.ts` `assembleNpcMemories` | L2 只 push `body` | L2 附 `psyche`（`current` 存在時） |
| `compact.ts` `commitNpcWrite` | archive + index + `saveL2Current` | **僅** `departedWrites` 成功後 psyche 短呼叫（M1 已關） |
| `compact.ts` mock | `mockPlaySkipsAutoCompact` skip 自動 compact；`modelNpcArchive` mock fixture | psyche 同級 hook（M2 已關） |
| `prompts/gm-contract.md` | 僅 generic `npc_memories` | 增 psyche／persona／body 優先序 |
| `prompts/compact-npc-psyche.md` | 不存在 | Track C 新增 |

上游 0.8.0 archive／回想、0.9.0 UI 與本版正交。backlog 待拍板項已收斂至 INDEX。

## 修復追蹤表

| ID | 級 | 狀態 | 關閉位置（INDEX 條／HOW 節） |
|----|----|------|------------------------------|
| M1 | MEDIUM | **關閉** | 已定案 **9–10**；HOW「NPC compact — psyche distill」；Track C |
| M2 | MEDIUM | **關閉** | 已定案 **9**；HOW Mock 段 |
| M3 | MEDIUM | **關閉** | INDEX 驗收 session／promote 兩勾；HOW「測試要點」 |
| M4 | MEDIUM | **關閉（非阻擋）** | reasoning「為何不每回合 GM JSON 改 psyche」 |
| L1 | LOW | **關閉** | reasoning＋已定案 9–10 |
| L2 | LOW | **非阻擋** | — |
| L3 | LOW | **非阻擋** | — |
| L4 | LOW | **非阻擋** | — |
| L5 | LOW | **非阻擋** | —（HANDOFF 摘要略短） |
| L6 | LOW | **非阻擋** | —（Track D 摘要略短） |

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-09-10 | 無 HIGH；非整案不可行。**有條件通過**——應修 M1–M3（HOW 離場 vs session、`commitNpcWrite` 措辞；Mock 句；驗收 session 不更新／promote 回滾）。M4／LOW 可非阻擋。 |
| 第 2 輪複審 | 2026-09-10 | 對照現 INDEX／HOW／reasoning：M1→已定案 9–10＋HOW＋Track C；M2→已定案 9 Mock 句；M3→驗收＋HOW 測試要點；M4→reasoning。無未關閉 HIGH；無應修未關 MEDIUM。**審查門檻通過**；可依 HANDOFF 開實作。 |
