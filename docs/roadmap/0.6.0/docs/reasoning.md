# 0.6.0 WHY — 為何拆 scope、為何同回平行、為何不是背景 job

對照：[`../INDEX.md`](../INDEX.md)。例證虛構。

## 0.5.0 打穿什麼、本版改什麼

0.5.0 要的是 **能封**：活 jsonl 進 `session-archive/`、資格 L2 寫 `archive/`、distill `current`、換 session、一層回想。編排刻意簡單：judge 同意或強制線 → **同一 HTTP 回合串行**做完全部。這讓「半套 compact」不容易發生，也讓測試好寫。

代價是兩件體感問題：

1. **工作量與觸發不對齊。** `present` 進出 `(a)` 問的是「整場要不要封」。一名配角離場，仍可能拖 summary＋全卡司 L2。N=20 才強制問，單次更肥。
2. **延遲是加總。** 觀察（非正式）：GM 數十秒 + summary ~9s + 兩名 L2 各 ~25s **串行**。檔已分 `l2/{id}/`，慢的是 `await` 鏈，不是互踩。

本版不重做「能封」，只改 **何時封誰、同一拍怎麼排**。

## 為何兩個 scope，而不是「較早的整場 compact」

若只把 N 從 20 改成 8，每次仍是 summary＋所有資格 L2。長局會 **更常** 付全價。產品句要的是：人走只封那人；jsonl 換檔是另一條較瘦的 session 線。

NPC scope **禁止**動活 jsonl／別人的 `current`／session 錨點，這樣離場不必跟「整場換幕」綁在一起。

## 為何廢／降級 `(a)`

0.5.0 `(a)` 把「舞台名單變了」當成 **整場 compact 的提問理由**。離場在本版已是 NPC scope 的充分理由，再問整場會重複且偏肥。Session 應改由 jsonl／token／較短 N／換幕（拍板）觸發，而不是「有人走路」。

## 為何同一 HTTP 回合平行，不要背景 job

背景封會讓「玩家已看到氣泡、current 卻還在寫」變成常態，接著就要 per-id 鎖、TTL、crash 半套、歸來撞寫。INDEX 已否決這整包。接受的延遲模型是：玩家等到 `GM + max(本回 NPC compact)`，不是 `GM` 先回。

`Promise.all` 之後 NPC 段趨近最慢那一名。opening 仍必須等 session summary **以及** 本回 distill 後的 current，否則新 jsonl 開場會讀到未壓短或未封完的記憶。

## 為何 program DAG，不要 LLM planner／pi-subagents

節點是死的：GM JSON → Writer →（離場 L2 彼此平行；可選 summary 平行）→ opening。輸入是 `present` 差集與 config。再開一個模型排步驟只增加失敗面，且會把 compact 工具暴露給對局 GM。

SDK 沒有一等 `SubAgent`；平行＝呼叫方自己開多個短 `AgentSession`。研究筆記結論：不要 `pi-subagents`、不要家長 `task` 委派。對局長活 session 仍只負責 GM JSON。

## 為何本版不搬目錄樹

L2 已是每 id 一目錄，平行寫 **不**需要先拆 `episodes.json`／`pool.json`。搬樹是 hop／測規／AGENTS 大改，屬 [kb-runtime-upgrade](../../backlog/kb-runtime-upgrade.md)，與「觸發變早＋並行」可拆。`dirty-set` 平行結束後合併寫一次即可當索引。

## 否決過的方案

| 方案 | 否決原因 |
|------|----------|
| 先回氣泡、背景 compact | 鎖、半套、歸來撞寫；與產品句衝突 |
| 每回合 distill 所有在場 L2 | 費用與延遲無上限；不是離場才封 |
| `clipTail` 冒充 distill | 0.5.0 已禁；失敗應回滾該 id，不是假裝成功 |
| SDK `session.compact()` 當產品封存 | 活歷史仍在同一 session；與 0.5.0 複製＋dispose＋新檔衝突 |
| 家長 GM 叫 subagent 工具 | 對局 JSON 契約被污染；編排應在 program |

## 拍板後的 WHY（2026-09-08）

**N＝8、換幕即封、強制線不動、廢 judge。** 只把 N 改小卻留「問整場」會更常付全價。廢 judge 後滿 N 與 `scene_id` 改變都是硬觸發，換檔頻率上升；接受，換來每次 session 不必重跑未離場且未超長的 L2。8 落在「20 太肥」與「每兩三回換檔」之間。`scene_id` 換幕對齊「敘事切段」而不是「有人走路」。強制線數字不動，避免本版順便改安全閥。`near_cap` 不當 NPC trigger：否則在場角色會無離場也反覆 distill。

**失敗解耦。** 兩條 scope 若仍「任一 L2 失敗＝連 session 也不換」，離場短呼叫的獨立失敗面會拖死換檔。Session 內部仍 fail-closed，避免半套 jsonl。代價是「本回既換檔又封 NPC」不再是單一原子——接受。離場 NPC 可先提交；在場 ≥640 的新筆綁在 session 成功，避免「session 失敗卻已壓短仍在場角色」。

**離場 ≠ 必開模型。** 產品句的「只封那名」是 scope，不是廢 0.5.0 的 trivial／無可寫 body 跳過。無資格不開呼叫，避免空 archive。

**Session 拍在場 ≥640 必跑。** 「可納入」會讓費用與測規兩可；對齊「超長才在換檔時 distill」，未離場且未超長仍禁止開模型。

**不做 debug 分鈕、不搬目錄樹：** 避免本版長出產品面與 hop；驗證靠單測與既有回合。
