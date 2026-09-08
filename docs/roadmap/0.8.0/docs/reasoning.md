# 0.8.0 reasoning — 情景記憶

契約以 [INDEX](../INDEX.md) 為準。

## 為何廢 salient_quotes 與 jsonl 剪句

Quotes 在 compact 時預先猜測「以後哪句有用」，給 GM 時又去掉 speaker／回合，變成沒頭沒尾的句子。資訊量通常小於同一檔 `summary`，卻讓短呼叫因 speaker 失敗（實局瑪拉）。Session jsonl 剪行同樣是斷章，且每回打開成本高。

對局 GM **沒有**讀檔 tool：所謂「hints」是給 **program** 組 context 用的定位，以及讓模型不要瞎編 id。GM 實際讀到的必須是 **已解析的情景摘要**；定位伴隨摘要，不是讓模型自己去開盤。

## 為何仍保留三層目錄

大改的是內容，不是另造 Engram。池／current／archive／session-archive 已對齊 compact scope。搬樹留給 kb-runtime-upgrade。

## 為何不 hop

產品無上線包袱。舊 quotes 忽略即可。

## 為何離場仍可召（閘門 iii）

否則殺光 NPC 後問「灰怎麼了」只能靠近 8 則 episode；archive 等於白寫。0.5.0 的（ii）要求名不在近 8 則，剛離場／剛死時常失敗；詞表也不含「怎麼了」。故本版新增（iii）：點名 L2 + 有 archive 即掃，不看 `present`、不看近 8 則。0.5.0 偏好在場 L2 是為了省打開次數，但與「過去情景」衝突。上限 2 份仍防塞爆。

## 否決

- GM `task`／自訂 tool 讀 jsonl：偏離 POC 熱路徑。
- 每回合把所有 archive summary 塞進 context：長局爆炸。
- 把 `current` 改成結構化心理欄：與 npc-l2-psyche 重複。
