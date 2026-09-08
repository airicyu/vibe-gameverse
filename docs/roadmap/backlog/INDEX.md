# Backlog

尚未排進版本、但已記下的構想。不是承諾範圍。  
已出貨項目只留在對應 `docs/roadmap/X.Y.Z/`，**不**再佔本表（出貨後刪獨立 `.md`）。排進某版後：本表備註該版，獨立檔與版本 INDEX **雙向連結**。

現行產品：[0.6.0](../0.6.0/INDEX.md)（**shipped**）。下一版：[0.7.0](../0.7.0/INDEX.md)（**planned**）。上游：[0.5.0](../0.5.0/INDEX.md)、[0.4.0](../0.4.0/INDEX.md)、[0.3.0](../0.3.0/INDEX.md)、[0.2.0](../0.2.0/INDEX.md)、[0.1.0](../0.1.0/INDEX.md)（**shipped**）。

| 項目 | 備註 |
|------|------|
| [多世界存檔](./multi-world-saves.md) | **已排入 [0.7.0](../0.7.0/INDEX.md)**（`planned`）。契約以該版 INDEX 為準；仍有待拍板 |
| [KB runtime 結構版本與升級](./kb-runtime-upgrade.md) | **未排程**。結構代標記 + boot 偵測；hop／skill 或啟動時 migrate。參考 Engram `store_version`，不 clone Engram。與 0.7.0 是否同版 hop 見該版待拍板 |
| [多套 Default 模板](./default-world-templates.md) | **未排程**。酒館之外加賽博龐克、劍與魔法地下城、超能力魔法都市、寒蟬**結構**向封閉祭典（原創卡司、全員成年） |
| [L2 NPC 心理深度](./npc-l2-psyche.md) | **未排程**。僅 `memory_tier === 2`：性格、人生／中期／短期目標、喜好／厭惡寫在 npc-memory，不進 L0／L1 |
| [玩家過強輸入與 GM 控場](./player-overreach-adjudication.md) | **未排程**。先談合理範圍；候選：整段拒／切分失敗／裁決預覽後接受或重輸。未過線維持自由文字一拍 |
| [NPC 角色圖與場景疊層](./npc-scene-visuals.md) | **未排程**。真的生角色圖；進行中場景圖可快取；傾向背景＋立繪（PNG 差分／可選 Live2D），場景未轉不重產背景；表情 on demand |

**已出貨、已自本表移除（勿再當構想）：** **0.2.0 世界起始**；**0.3.0 執行期只寫 kb／NPC 人設遷出 source**（原 `immutable-source.md`）；**0.4.0 NPC 分層記憶**；**0.5.0 Session compact**；**0.6.0 Compact 分 scope 與同回合平行**。  
**已作廢、不另列：** 無 `world.json` 時用 seed id 指紋補 default（見 [0.3.0](../0.3.0/INDEX.md) 與現行 `AGENTS.md`）。

← [0.7.0](../0.7.0/INDEX.md)（planned） · [0.6.0](../0.6.0/INDEX.md)（shipped） · [0.5.0](../0.5.0/INDEX.md)（shipped） · [0.4.0](../0.4.0/INDEX.md)（shipped） · [0.3.0](../0.3.0/INDEX.md)（shipped） · [0.2.0](../0.2.0/INDEX.md)（shipped） · [0.1.0](../0.1.0/INDEX.md)（shipped） · [GUIDELINES](../GUIDELINES.md) · [changelog](../../../changelog.md)
