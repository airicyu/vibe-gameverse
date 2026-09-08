# HANDOFF — 0.3.0 執行期只寫 kb、NPC 人設在 runtime

**本版已 `shipped`（2026-09-06）。** 本檔是歷史實作交接，**不要**再開實作 session 重做 Track A–D。契約以 [`INDEX.md`](./INDEX.md) 為準。

**Do not commit unless the user asks.**

對使用者：繁體中文書面語。

## 讀檔順序

1. `AGENTS.md`（現行 0.3.0 路徑）
2. `docs/roadmap/0.3.0/INDEX.md`（已定案 1–16；驗收已勾）
3. `docs/roadmap/0.3.0/docs/immutable-source.md`、`docs/reasoning.md`
4. `docs/roadmap/0.3.0/docs/design-review.md`（契約以 INDEX 為準）
5. 錨點（**shipped 行為**）：`program/gm-pi.ts`（runtime persona）、`kb.ts`（`gm_canon.md`＋gate）、`setup.ts`、`schema.ts`、`world-generate.ts`、`writer.ts`、`world.test.ts`、`kb/seed/bartender.json`、`ash.json`、`prompts/`（無 npc 檔）

## 產品摘要

NPC 人設不在 repo `prompts/`。Default 瑪拉／灰在 seed JSON 的 `persona`，setup copy 進 runtime；對局 `buildPlaySystemPrompt` 拼 repo 的 GM 契約／`gm-default.md` + **runtime** persona。Custom canon 為 `kb/runtime/gm_canon.md`。`syncWorldGate` 為唯一 ready 真相：custom 缺／空 canon → `{ needs_setup: true, world: null }`，禁止讀舊 `runtime/prompts/gm.md`。不 migrate、不恢復指紋。

## Track 順序（歷史；已完成）

A（schema＋seed persona＋洩漏／生成器字串）→ B（`gm_canon.md`＋clear＋改寫 `syncWorldGate`）→ C（對局只讀 runtime；刪 repo npc／殘留 `gm.md`）→ D（已定案 15 測試＋`AGENTS.md`／`VERSION.md`）。

## 禁區（後續版本仍適用）

INDEX 非目標。勿 `rm` live `kb/runtime`。勿把 GM 契約搬進 kb。勿 fallback 舊路徑。勿改 `MemorySlice`。勿依 0.2.0 INDEX 指紋句改 gate。測試用 `VIBE_GAMEVERSE_KB_RUNTIME`。

## Paste-ready starter prompt（歷史；勿當新開工）

```text
本版 0.3.0 已 shipped。不要依本 prompt 重做 Track。
若要查契約：讀 AGENTS.md 與 docs/roadmap/0.3.0/INDEX.md。
若要修迴歸：對照 INDEX 已定案 9／15，勿發明新語意。
繁體中文書面語。不要 git commit，除非使用者明確要求。
```
