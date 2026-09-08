# Backlog

尚未排進版本、但已記下的構想。不是承諾範圍。  
已出貨項目只留在對應 `docs/roadmap/X.Y.Z/`，**不**再佔本表（出貨後刪獨立 `.md`）。

現行產品：[0.4.0](../0.4.0/INDEX.md)（**shipped**）。上游：[0.3.0](../0.3.0/INDEX.md)、[0.2.0](../0.2.0/INDEX.md)、[0.1.0](../0.1.0/INDEX.md)（**shipped**）。

| 項目 | 備註 |
|------|------|
| [Session compact](./session-compact.md) | **未排程**。jsonl archive、開新 session、回溯。NPC archive **落盤**在本項；**格式**已由 [0.4.0](../0.4.0/INDEX.md) 鎖定 |
| [KB runtime 結構版本與升級](./kb-runtime-upgrade.md) | **未排程**。結構代標記 + boot 偵測；hop／skill 或啟動時 migrate。參考 Engram `store_version`，不 clone Engram |
| [NPC 專屬記憶檔](./npc-memory-files.md) | **已由 [0.4.0](../0.4.0/INDEX.md) 出貨**（現用記憶）。本檔為構想原文；archive **寫入**仍見 session-compact |

**已出貨、已自本表移除（勿再當構想）：** **0.2.0 世界起始**；**0.3.0 執行期只寫 kb／NPC 人設遷出 source**（原 `immutable-source.md`）。  
**已作廢、不另列：** 無 `world.json` 時用 seed id 指紋補 default（見 [0.3.0](../0.3.0/INDEX.md) 與現行 `AGENTS.md`）。

← [0.4.0](../0.4.0/INDEX.md)（shipped） · [0.3.0](../0.3.0/INDEX.md)（shipped） · [0.2.0](../0.2.0/INDEX.md)（shipped） · [0.1.0](../0.1.0/INDEX.md)（shipped） · [GUIDELINES](../GUIDELINES.md) · [changelog](../../../changelog.md)
