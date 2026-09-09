# HANDOFF — 0.11.0 玩家過強輸入與 GM 控場

狀態：`in progress`。契約以 [`INDEX.md`](./INDEX.md) 為準；HOW：[`docs/overreach.md`](./docs/overreach.md)；WHY：[`docs/reasoning.md`](./docs/reasoning.md)。設計審查：[`docs/design-review.md`](./docs/design-review.md)（第 3 輪門檻通過；M8 已併入 INDEX 定案 17）。

**Do not commit unless the user asks.**

對使用者：繁體中文書面語。

## 讀檔順序

1. `AGENTS.md`
2. 本檔
3. `docs/roadmap/0.11.0/INDEX.md`
4. `docs/roadmap/0.11.0/docs/overreach.md`、`docs/reasoning.md`
5. 錨點：`program/turn.ts`、`program/server.ts`、`program/gm-pi.ts`、`program/schema.ts`、`program/kb.ts`、`program/public/*`、`prompts/gm-contract.md`
6. 上游 busy：[0.9.0 INDEX](../0.9.0/INDEX.md) 已定案 10（待判決 **取代** busy）

只認檔案，不認 chat history。INDEX 已寫的不要再問；沉默才提問。

## 產品摘要

兩層裁決後才進故事 GM。深審為獨立短呼叫（`decision`）；僅 `discuss` 才建 meta session（disposition）。過線則獨立 GM 側欄談 1／2／3；`player-memory/` 只記事實與已承認能力。Pending 時對外故事 409。Meta 不進 `play-sessions/`。`skipOverreach` 僅內部參數，仍跑硬拒。玩家氣泡僅故事成功後留在 `#log`。

## Track 順序

A（player-memory＋context）→ B（閘門插入 turn）→ C（meta API＋pending）→ D（UI）→ E（測試／出貨文件）。

實作開始 INDEX → `in progress`。`shipped` 僅在驗收、`bun test`、瀏覽器路徑通過且使用者同意出貨時。

## 禁區

INDEX 非目標。勿 `rm` live `kb/worlds`。勿把勸說寫進故事 log／對局 jsonl。勿 Writer 改 `player-memory`。勿玩家 psyche。勿無 pending 的 GM 閒聊頻道。勿把 skip 做成 HTTP 可送的旗標或整段跳過硬拒。勿先刪 pending 再跑 (1)(2) 的故事 GM。勿待決或 gm-chat 等待時鎖死回主頁／刪世界。勿把深審與側欄塞進同一 jsonl 換 schema。

## 完成檢查

- INDEX 驗收可勾
- `bun test` 全綠
- 瀏覽器：正常句、過線、重輸
- 出貨：VERSION＝`0.11.0`；changelog；AGENTS；刪 backlog 列與 `player-overreach-adjudication.md`

## Paste-ready starter prompt

```text
你是 0.11.0 實作 agent。只認檔案，不認 chat history。
先讀 AGENTS.md → docs/roadmap/0.11.0/HANDOFF.md → docs/roadmap/0.11.0/INDEX.md → docs/roadmap/0.11.0/docs/overreach.md → docs/reasoning.md。
依 Track A→B→C→D→E。禁非目標。INDEX 已定案不要再問；沉默才提問。
繁體中文書面語。不要 git commit，除非使用者明確要求。
勿 rm 專案 live kb/worlds。測試用 VIBE_GAMEVERSE_KB_WORLDS。待判決 UI 取代 busy，不要兩套。
skipOverreach 只跳輕量／深審，仍硬拒；不得進公開 turn body。深審是獨立短呼叫，不是 disposition。玩家氣泡僅故事成功後保留。gm-chat 等待勿套 setTurnBusy 全鎖。
```
