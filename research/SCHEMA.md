# 候選人研究資料格式

每個研究檔寫成 `research/raw/<slug>.json`，UTF-8，結構如下。另附 `research/raw/<slug>-notes.md`
記錄：查過哪些來源、哪些欄位查無、來源互相矛盾之處。

```json
{
  "office_id": "magistrate",
  "office_name": "新竹縣長",
  "seats": 1,
  "district": null,
  "district_note": "選區範圍說明，例如：第一選區＝竹北市全區",
  "who_votes": "哪些竹北市民可以投這個職務（例如：原住民身分者改投原住民選區）",
  "official_list_source": "選委會候選人名單公告的 URL；查無寫 null",
  "researched_at": "2026-11-14",
  "candidates": [
    {
      "id": "magistrate-01",
      "ballot_number": 1,
      "name": "姓名",
      "party": "推薦政黨；無黨籍寫「無黨籍」",
      "gender": "男|女",
      "birth_year": 1970,
      "incumbent": false,
      "education": ["學歷"],
      "experience": ["經歷，新的在前"],
      "background": "2–4 句中性背景介紹",
      "achievements": [
        {"text": "可查證的過往施政／問政成果（政績）", "source": 0}
      ],
      "platform": [
        {"topic": "交通", "text": "本次選舉提出的政見，具體到做什麼", "source": 1}
      ],
      "controversies": [
        {
          "title": "爭議標題",
          "date": "2024-05",
          "summary": "發生了什麼，只寫可查證的事實",
          "status": "判決確定／起訴／偵查中／不起訴／媒體報導，未進司法程序／已澄清",
          "candidate_response": "本人或陣營回應；查無寫 null",
          "source": 2
        }
      ],
      "livelihood": [
        {"text": "對竹北民生議題的表態、提案或實際作為", "source": 3}
      ],
      "sources": [
        {"title": "來源標題（媒體／機關）", "url": "https://...", "accessed": "2026-11-14"}
      ]
    }
  ]
}
```

## 欄位規則

- `source` 是 `sources` 陣列的索引（從 0 起算），每一條事實都要有。
- `topic` 只能用這份清單：交通、教育、托育與社福、長照與醫療、居住與都市計畫、
  產業與就業、環境與防災、治安、財政與行政、文化觀光、青年、農業、其他。
- 查不到的欄位：陣列留空 `[]`、純量寫 `null`，並在 notes 記下查過哪裡。
- 號次（`ballot_number`）以選委會公告為準；尚未抽籤或查無寫 `null`。

## 中立原則

- 不以政黨評價人；每位候選人用同樣的查找深度，同樣的欄位。
- 爭議只收可信來源（法院判決、檢調公告、主流媒體報導、監察院、議會紀錄），
  寫明目前司法狀態與本人回應；網路傳言、匿名爆料、未經查證的指控不收。
- 用語中性：用「報導指出」「判決認定」，不用「涉嫌貪腐的某某」這類帶評價的句子。
