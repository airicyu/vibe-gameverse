# HANDOFF — 0.10.0 L2 NPC 心理深度

狀態：設計閘門已通過（見 [`docs/design-review.md`](./docs/design-review.md)）。契約以 [`INDEX.md`](./INDEX.md) 為準；HOW：[`docs/npc-l2-psyche.md`](./docs/npc-l2-psyche.md)。

**Do not commit unless the user asks.**

對使用者：繁體中文書面語。

## 讀檔順序

1. `AGENTS.md`
2. `docs/roadmap/0.10.0/INDEX.md`（已定案＋驗收＋Track）
3. `docs/roadmap/0.10.0/docs/npc-l2-psyche.md`、`docs/reasoning.md`
4. 錨點：`program/schema.ts`、`program/kb.ts`、`program/npc-memory.ts`、`program/compact.ts`、`prompts/gm-contract.md`；測：`program/npc-memory.test.ts`、`program/compact.test.ts`
5. 上游記憶契約：`docs/roadmap/0.8.0/`（本版 **不**改 archive／回想）

只認檔案，不認 chat history。INDEX 已寫的不要再問；沉默才提問。

## 產品摘要

L2 另存 `psyche.json` 六欄；GM `npc_memories` 附 `psyche`。升 2 建空檔；Default 瑪拉／灰有預製。更新僅 NPC compact 後 psyche 短呼叫。不 hop；不 HTTP 暴露；near_cap 仍只看 body。

## Track 順序

A（schema／kb／promote／Default seed）→ B（snippet＋gm-contract）→ C（compact distill）→ D（測試／VERSION／changelog／AGENTS／刪 backlog）。

每 Track 結束跑相關窄測；全部結束 `bun test`。實作開始 INDEX → `in progress`。

## 禁區

INDEX 非目標。勿 `rm` live `kb/worlds`。勿每回合 GM psyche。勿 L0／L1 psyche。勿 merge `private_notes`。勿改 compact 觸發表。

## 完成檢查

- Default／promote／assemble／compact 驗收句（INDEX checklist）
- `bun test` 全綠；VERSION＝`0.10.0`；changelog／AGENTS；刪 backlog

## Paste-ready starter prompt

```text
你是 0.10.0 實作 agent。只認檔案，不認 chat history。
先讀 AGENTS.md → docs/roadmap/0.10.0/HANDOFF.md → docs/roadmap/0.10.0/INDEX.md → docs/roadmap/0.10.0/docs/npc-l2-psyche.md → docs/reasoning.md。
依 Track A→B→C→D。禁非目標。INDEX 已定案不要再問；沉默才提問。
繁體中文書面語。不要 git commit，除非使用者明確要求。
勿 rm 專案 live kb/worlds。測試用 VIBE_GAMEVERSE_KB_WORLDS 隔離慣例。
```
