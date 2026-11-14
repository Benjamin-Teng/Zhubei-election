# 竹北選舉功課表

2026 年 11 月 28 日地方選舉（九合一），新竹縣竹北市民可投的職務與全部候選人資料，
以及只看政見與政績的匿名盲測。

網站：<https://benjamin-teng.github.io/Zhubei-election/>

## 網站有什麼

- **你會拿到哪幾張票**：選你住的里和選民身分，列出你投的縣長、縣議員、市長、市民代表、里長選區。
- **候選人頁**：背景、學經歷、政績、政見、爭議、民生觀察，每一條附來源。
- **政見對照**：同選區候選人依議題並排，可以隱藏姓名。
- **盲測**：隱藏姓名與政黨，只用政見和政績出多選題，最後每個職務揭曉一位最接近你的候選人。

本站不以黨廢人，不替任何候選人或政黨背書。資料怎麼查、怎麼驗證，見
[research/README.md](research/README.md)。

## 專案結構

| 路徑 | 內容 |
| --- | --- |
| `index.html` | 網站入口，含首頁對聯與竹葉動畫 |
| `assets/core.js` | 頁面路由、候選人頁、政見對照、盲測出題與計分 |
| `assets/base.css`、`assets/site.css` | 版面骨架與視覺樣式 |
| `assets/data.js` | 由研究資料產生的網站資料，不要手改 |
| `research/` | 原始資料、查證筆記、驗證報告、盲測題庫 |
| `scripts/build-data.mjs` | 把 `research/` 合併成 `assets/data.js` |

## 更新資料

改完 `research/raw/*.json` 或 `research/quiz.json` 後執行：

```sh
node scripts/build-data.mjs
```

網站是純靜態頁面，不需要建置工具；直接用瀏覽器開 `index.html` 也能看。

## 回報錯誤

請開 [issue](https://github.com/Benjamin-Teng/Zhubei-election/issues)，附上正確來源。
