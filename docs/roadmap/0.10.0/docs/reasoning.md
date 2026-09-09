# 0.10.0 WHY — L2 NPC 心理深度

## 問題

0.8.0 起 L2 `body` 是 **近事工作記憶**，`persona` 在 system 管 **怎麼說**。長期動機（今晚想幹嘛、怕什麼、中期弧）混在 `persona` 散文或 `body` 裡會：

- system 與 memory 雙源打架；
- `body` distill 時把動機當近事截掉；
- 路人若也有完整內在戲會 prompt 膨脹。

## 為何只 L2

0.4.0 分層本意：重要角色才 worth 結構化狀態。L0／L1 池節保持「記得幾句」即可；psych 欄只給 `memory_tier === 2`。

## 為何另檔 psyche.json

`current.json` 的 `body` 每回合 append、compact 時整段 distill，頻繁覆寫。心理欄較穩；分檔可避免 Writer 更新近事時誤傷目標欄，也讓 `near_cap` 仍只盯 `body`（已定案 11）。

## 為何不每回合 GM JSON 改 psyche

0.4.0 原則：記憶維護不每回合開模型。若 GM 每回合回傳六欄，易人格漂移、且擴 zod 契約。改在 **離場 NPC compact**（本來就有一次短呼叫）追加 psyche distill。Default 常駐 L2（瑪拉／灰）在典型酒館 POC 中 psyche 可能 **長期僅 seed 值**，直到該角離場 compact——**不是** bug；session near_cap distill 刻意不碰 psyche（定案 9–10）。

## 為何升 2 不從 persona 摘句

自動摘句會把 system 與 memory 再綁一層，且摘哪一句不穩定。寧可空檔，由 Default seed 或第一次 compact 填。

## persona 與 psyche 分工

| 來源 | 職責 |
|------|------|
| `persona` | 語氣、演法、何時交線索（system） |
| `psyche` | 要什麼、怕什麼、好惡（`npc_memories`，GM 每 turn） |
| `body` | 近事知情與態度 |
| `private_notes` | 靜態秘密；**不**進 `npc_memories`（維持 BAN） |

衝突優先：`short_goal`＋`body` 可蓋過過時 `mid_goal`；`disposition`／`life_goal` 需 compact 短呼叫內強證據才改。

## 否決方案

- **併入 current.json：** 已否決（見上）。
- **Writer 每回合修 short_goal：** 規則難寫、易與 GM 敘事打架。
- **從舊 body hop 拆六欄：** 無標記舊存檔，猜錯比空欄更糟。
- **private_notes merge：** 雙源且違反 notes 不進 GM 記憶的既有邊界。
