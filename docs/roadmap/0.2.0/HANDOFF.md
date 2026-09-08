# HANDOFF — 0.2.0 世界起始劇本

給 **新的實作 agent**。只認檔案，不認規劃對話。

**Do not commit unless the user asks.**

對使用者：繁體中文書面語。

## 讀檔順序

1. `AGENTS.md`
2. `docs/roadmap/0.2.0/INDEX.md`（含複審 H5／H6、已定案 22–26）
3. `docs/world-bootstrap.md`、`docs/reasoning.md`
4. `docs/design-review.md` 文末兩次「收斂」表（契約以 INDEX 為準）
5. 錨點：`kb.ts`、`server.ts`、`gm-pi.ts`、`gm-mock.ts`、`schema.ts`、`turn.ts`、`turn.test.ts`、`public/*`、`kb/seed/`、`prompts/gm.md`

## 產品摘要

開局選 default 或 custom 引子生成 seed。舊酒館局指紋是 **⊇ seed ids**。無效 world.json 不救。禁止 `resetPiGm` 舊語意、整份舊 gm.md 當 custom 前綴、coerce 預設酒館。Mock custom 對局必須出霧港人設。

## Track 順序

A → B → C → D → E。B 不手玩 custom 對局。C 含 mock 第二套 fixture。

全部：`bun test` + 瀏覽器 default 與 **mock custom** 各一回合。

## 禁區

INDEX 非目標。勿 boot 偷灌。勿 `rm` live `kb/runtime`。勿直連 OpenRouter。Commit 勿 merge 半套。

## Paste-ready starter prompt

```text
你是 vibe-gameverse 的實作 agent。只認檔案，不認 chat history。
先讀 AGENTS.md，再讀 docs/roadmap/0.2.0/INDEX.md、HANDOFF.md、docs/world-bootstrap.md、docs/reasoning.md。
設計審查兩輪已併入 INDEX：原子落盤；needs_setup 三路（有效 world／無效 world／無 world 才用 ⊇ seed 指紋）；disposePlaySession vs createPlaySession；gm-contract 拆檔；coerce 不得預設酒館；mock custom 對局走 harbor 不是瑪拉；ready 重啟 continueRecent＋現行 prompt；generating finally；idleTimeout≥180。
依 Track A→B→C→D→E。Track B 不要求 custom 對局人設。
禁止 INDEX 非目標。VIBE_GAMEVERSE_KB_RUNTIME 隔離測試，禁止刪 live kb/runtime。
繁體中文書面語。不要 git commit，除非使用者明確要求。
INDEX 已寫清的不要再問。
```
