# Research：pi-agent SDK 的 subagent 類用法

**狀態：** 研究筆記，非正式產品契約。不覆寫 [0.5.0 INDEX](../roadmap/0.5.0/INDEX.md) 或 [0.6.0 INDEX](../roadmap/0.6.0/INDEX.md)。  
**日期：** 2026-09-08。  
**對照套件：** 本倉 `package.json` 的 `@earendil-works/pi-coding-agent@^0.85.1`（實裝 `0.85.1`）。官方文件在 `node_modules/@earendil-works/pi-coding-agent/docs/sdk.md`。  
**相關：** [0.6.0 INDEX](../roadmap/0.6.0/INDEX.md)（`shipped`）。編排已定為 program DAG，不是 LLM planner。

---

## 一句結論

SDK **沒有**一等型別叫 `SubAgent`。所謂 subagent，是「再開一個獨立的 `AgentSession`（或再 spawn 一個 `pi` 行程）」加上你自己寫的編排。官方文件把「Build custom tools that spawn sub-agents」列為 SDK 用途，但實作仍是呼叫方自己 nest `createAgentSession` 或 spawn CLI。

對 vibe-gameverse：熱路徑 GM 已是長活 `AgentSession`；compact 短呼叫已是 in-process 子 session。若要「多個短呼叫並行」，應在 **program** 裡 `Promise.all` 多個 `openPiSession`／`runScratchJson`，不要裝 `pi-subagents`、也不要把 GM 變成會自己叫 `task` tool 的家長代理。

---

## 1. SDK 真正暴露什麼

`createAgentSession()` 產出單一 `AgentSession`。公開能力（摘自 `docs/sdk.md`）：

| 能力 | 方法／選項 | 與 subagent 的關係 |
|------|------------|-------------------|
| 送一拍並等到結束 | `session.prompt(text)` | 子工作的基本單位 |
| 中途改指令／排隊 | `steer`／`followUp` | 同一 session 內，不是另開孩子 |
| 訂閱事件 | `subscribe` | 家長若 embed 孩子，可轉發進度 |
| 換模型 | `setModel`／`setThinkingLevel` | 同一 session 升／降級，不是角色切換 |
| 樹內跳轉 | `navigateTree` | 同一 jsonl 樹，不是隔離孩子 |
| 內建壓縮 | `compact(customInstructions?)` | **同一**對局歷史摘要；見第 5 節 |
| 銷毀 | `dispose` | 短呼叫結束必做 |
| 工具 | `tools`／`noTools`／`customTools`／`excludeTools` | 孩子可 `noTools: "all"` 或只讀 |
| system | `DefaultResourceLoader.systemPromptOverride` | 每孩子一份獨立 prompt |
| 存檔 | `SessionManager.inMemory()`／`create`／`continueRecent` | 孩子應用獨立目錄或 in-memory |
| session 替換 | `createAgentSessionRuntime()` 的 `newSession`／`fork`／`switchSession` | 換**當前**對局物件，不是平行工人 |

`fork`／`/clone`／`navigateTree` 是「同一段對話的分叉」，孩子仍帶家長歷史。這與「隔離 context 的 subagent」相反。

---

## 2. 社群／官方怎麼做出「subagent」

四層，由輕到重。越往下越像 TUI 編碼代理，越不適合本 POC 的 GM 迴圈。

### A. Program 直接再開 `createAgentSession`（in-process）

家長是 **我們的 TypeScript**，不是另一個 LLM。

```text
program
  ├─ play AgentSession（GM，活 jsonl）
  └─ scratch AgentSession × N（fresh、獨立 cwd／sessionDir、用完 dispose）
```

本倉已這樣做：

- 對局：`program/gm-pi.ts` `openPiSession` → `createAgentSession`（`noTools: "all"`，system 依 world）
- compact 短呼叫：`program/compact.ts` `runScratchJson` → 再 `openPiSession`（臨時 `compact-scratch/call-*`，fresh，結束 `dispose` + 刪目錄）
- 世界生成：`program/world-generate.ts` 同樣開暫時 session

並行只需 `Promise.all` 多個 `runScratchJson`（或抽出共用 factory）。這與 backlog「編排 = program DAG」一致。成本：每孩子一次 `ModelRuntime.create`＋loader＋session 啟動；無行程隔離。

官方 SDK 例子目錄：`examples/sdk/`（`01-minimal` … `13-session-runtime`）。沒有名為 `subagent.ts` 的 SDK 範例；nest session 是預期用法。

### B. 家長 LLM 透過 `customTools` 再 spawn 孩子

`createAgentSession({ customTools: [defineTool({...})], noTools: "builtin" })`。tool 的 `execute` 裡再開一個 `createAgentSession` 或 `spawn("pi", ["--mode", "json", ...])`。

家長模型自己決定何時委派。適合編碼代理「scout／reviewer」。**不適合**本專案對局 GM：契約是固定 JSON、禁止工具、`noTools: "all"`。若給 GM 一個 `task` tool，會污染 GM JSON、拉長對局 jsonl、把 DAG 交給模型。

### C. 官方 example extension：`examples/extensions/subagent/`

註冊 `task` tool，三種參數形狀：

- 單個：`{ agent, task }`
- 平行：`{ tasks: [...] }`（上限 8 個、同時 4 個）
- 串接：`{ chain: [...] }`，下一步可用 `{previous}`

每個孩子是 **另 spawn 的 `pi` 行程**：`--mode json -p --no-session`，可加 `--model`、`--tools`、`--append-system-prompt`。stdout JSONL 事件餵回家長。Agent 定義是 `~/.pi/agent/agents/*.md`（YAML frontmatter：name、tools、model；正文＝system）。

這是 **CLI／TUI 擴充**，假設本機有 `pi` binary、家長 session 有工具迴圈。本 app 是 Bun HTTP 伺服器 embed SDK，不走互動 TUI，也不該讓 GM 呼叫 `task`。

### D. npm 套件 `pi-subagents`（pi.dev packages，研究當日約 0.66.0）

安裝：`pi install npm:pi-subagents`。內建 scout／researcher／worker／reviewer／oracle／delegate；前景孩子在家長行程內、背景孩子要獨立 runner（需 npm 套件目錄，單檔 binary 不行）。另有 FleetView、`maxSubagentSpawnsPerRun`、watchdog。

這是給 **人在 TUI 裡指揮編碼代理** 的產品，不是給遊戲 program 的 runtime API。引入會帶 extension、skills、背景行程與 recursion guard，與 `AGENTS.md`「熱路徑只要 GM JSON」衝突。

週邊還有 `pi-flows`、`mjakl/pi-subagent`（具名持久子 session）、`kngzzz/pi-programmatic-agents`（`subagent_call`＋output contract）。原語相同：隔離的 `pi` 或 `createAgentSession`，外加契約與預算。

---

## 3. 隔離邊界怎麼選

| 邊界 | 做法 | 隔離什麼 | 代價 |
|------|------|----------|------|
| In-process 新 session | 再 `createAgentSession` | 訊息歷史、system、tools、jsonl 路徑 | 同行程、同 API key、同事件迴圈；最快 embed |
| 子行程 | `spawn pi --mode json` 或 RPC | 行程、部分 fs／env（視參數） | 啟動慢、要解析 JSONL、abort 要 `kill` |
| 同一 jsonl fork | `AgentSessionRuntime.fork` | 幾乎不隔離；共享前綴歷史 | 不適合 scratch compact |

本專案 compact／生成已選 in-process 新 session + 獨立 `sessionDir`。短呼叫不要 `continueRecent` 對局目錄。

`SessionManager.inMemory()` 可再減磁碟；現行 `runScratchJson` 寫臨時 jsonl 再刪，語意已 ephemeral。

---

## 4. 對照本倉現況與 compact 平行構想

當時（0.5.0 實作中）：judge → session summary → 各資格 L2 archive／distill，**串行**短呼叫，各走 `runScratchJson`。對局 session 不參與這些 prompt。

[0.6.0](../roadmap/0.6.0/INDEX.md) 要的是：

- GM JSON 之後，離場 L2 的 archive **彼此** `Promise.all`
- 若同回也做 session compact，summary 可與 NPC 並行
- opening 仍等 summary + distill
- **禁止**另開模型排步驟

這對應第 2 節 **A**，不對應 B／C／D。

不該用的：

- 把 GM session 打開 tools，讓模型呼叫 `task` 去封 NPC
- 安裝 `pi-subagents` 當 runtime
- 用 `session.compact()` 取代產品 compact（見下）
- 每 NPC 一條**長活** pi-agent（0.4.0／0.5.0 非目標仍寫「不每 NPC 獨立 pi-agent」；那是指常駐對局 session，不是禁止每拍 ephemeral scratch）

可以考慮的實作細節（研究建議，非正式定案）：

1. 抽出 `runScratchJson` 的 factory，允許呼叫方並行；注意 scratch 目錄名已含 timestamp＋random，並行時目錄不撞。
2. 共用一個 `ModelRuntime`（含 `setRuntimeApiKey`）給同回所有 scratch，避免每孩子 `ModelRuntime.create()`。需實測 SDK 是否 thread-safe／可否共用；文件未保證，先單測再採用。
3. 孩子維持 `noTools: "all"`、獨立 system（`compact-judge.md`／`compact-summary.md`／`compact-npc-archive.md`）。
4. Abort：對局 HTTP 取消時應對每個 scratch `session.abort()`＋`dispose`。官方 C 用 `AbortSignal` kill 子行程；in-process 用 `AgentSession.abort`。
5. 不要把 scratch 掛進 `play-sessions/` 或 `continueRecent`。

---

## 5. 不要把 pi 內建 `compact()` 當成產品 compact

`AgentSession.compact()` 與 `/compact`：當 context 接近視窗，把**同一 jsonl** 舊訊息摘要後仍留在該 session（cut point、`keepRecentTokens`、`CompactionEntry`）。見套件 `docs/compaction.md`。

產品 compact（0.5.0）：複製活 jsonl → 另開模型寫 `session-archive` 與 L2 `archive/` → **dispose 對局 session → 新 jsonl＋opening**。活歷史不得靠 pi 內部 summary 假裝已封存。

[0.5.0 INDEX](../roadmap/0.5.0/INDEX.md) 已寫：開工前查 SDK，不要猜有內建 compact 就依賴它。此處確認：內建 compact **存在**，但語意是 coding-agent 的 context 管理，不是本遊戲的封存管線。

---

## 6. 若日後真要「家長 LLM 委派」

僅在偏離現行 GM 契約時才有意義，例如離線產內容、pi skills、多步研究。最低做法：

1. 家長 `createAgentSession`：`noTools: "builtin"` + `customTools: [delegateTool]`。
2. `delegateTool.execute` 內 `createAgentSession`（`SessionManager.inMemory()`，窄 system，工具 allowlist）。
3. 把孩子最後助理文字（或 zod JSON）當 tool result 回家長。
4. 並行：tool 一次收 `tasks[]`，內部 `Promise.all`（自訂上限），不要依賴 `pi-subagents` 的 8／4。
5. 遞迴：孩子不要再註冊同一 tool，或硬上限 spawn 次數。

這仍是 B，不是 SDK 內建。C／D 是同一原語的 TUI 包裝。

---

## 7. 來源

- 本機：`@earendil-works/pi-coding-agent@0.85.1` 的 `docs/sdk.md`、`docs/compaction.md`、`docs/sessions.md`、`docs/json.md`、`examples/extensions/subagent/`
- <https://pi.dev/>（core 刻意不做內建 sub-agents；用 extension／package）
- <https://pi.dev/packages/pi-subagents>
- <https://piagent.fyi/guides/subagents-and-delegation/>（說明官方 example 為 spawn `pi` + JSON mode）
- 本倉：`program/gm-pi.ts`、`program/compact.ts` `runScratchJson`

← [0.6.0](../roadmap/0.6.0/INDEX.md) · [0.5.0](../roadmap/0.5.0/INDEX.md)
