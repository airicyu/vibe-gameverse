# 0.1.0 HOW — 酒館一回合迴圈

對照基準：[`../INDEX.md`](../INDEX.md)。描述 **0.1.0 當下**行為；0.2.0 已改之處見該版 INDEX「與上一版對照」。

## 狀態機

```text
boot → ensureRuntime（空 entities 則 copy kb/seed）
     → 可立即 POST /api/turn
     → 重開 bun start：有 jsonl 則 continueRecent，否則新酒館 session
新遊戲 → 清 runtime → 再灌 seed → resetPiGm（立刻對局）
```

沒有 `needs_setup`。沒有 `POST /api/setup/*`。

## 一回合

1. Body：`player_text`（必填）；`scene_id` 可省，缺則用已載入 scene 或後備 `tavern`。
2. Context：`gm_note`、`scene`、`memory_slice`（近 8 episode 摘要 + entities + relations）、`turn_id`、`timestamp`；pi 另有 session 全文。
3. GM：`program/gm-pi.ts` 或 `gm-mock.ts`。
4. `parseGmOutput`／coerce：`narration` 非台詞；台詞只在 `npc_lines`；缺 `npc_id` 可落到已知酒館角色；缺 `gm_note` 可補酒館進行中語句。
5. Writer：`events[]` → episodes／entities／relations。
6. Presenter：Web 氣泡顯示 `narration` + `npc_lines`。

## HTTP（本版）

典型：`GET` 狀態（gm_note、scene、episodes…）、`POST /api/turn`、新遊戲（清庫並重開酒館）。**沒有** setup 409。

## 檔案

| 路徑 | 角色 |
|------|------|
| `kb/seed/*.json` | 模板：`player`、`bartender`、`ash`、`tavern`、`sealed_note` |
| `kb/runtime/` | 本場：entities、episodes、relations、gm_note、scene、turn_counter、`pi-sessions/` |
| `prompts/gm.md` | JSON 契約與酒館故事同檔 |
| `prompts/npc-bartender.md`、`npc-ash.md` | 僅這兩名開場 NPC；遊玩中新角色進 runtime entities，不預寫 `npc-*.md` |

無 `world.json`。Custom `gm_canon` 本版不存在。

## Prompt

對局 system＝整份酒館 GM 稿 + 兩份 npc。Mock 只準這套卡司。

## Session

`resetPiGm`：釋放後**立刻** `createSession` 酒館 prompt。Ready／開服即視為可玩，故重啟可 continue。
