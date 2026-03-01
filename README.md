# 航线评分网站

基于你提供的 **BTS 准点数据** 生成：**航司准点排名**、**机场准点排名**、**航线准点评分**。

数据来源：
- `T_ONTIME_MARKETING.csv`：航线与航班量
- `Annual Airline On-Time Rankings 2003-2024.xlsx`：航司准点率（使用 2024 Marketing）
- `Table 4 Ranking of Major Airport On-Time Arrival Performance...xlsx`：机场准点率（2024）

航线准点率由起降机场的准点率取平均得到。**综合分** = 准点率得分 × 80% + 航班量得分 × 20%（航班量按当前筛选下的分位换算为 0–100 分）。等级：**优秀**（≥85）、**良好**（≥70）、**一般**（≥55）、**较差**（<55）。

- **筛选**：时间（年-月）、出发机场、到达机场均为下拉选项，可组合使用以得到更精确的评分（选择某月后，航班量为该月数据）。
- **评分构成**：点击某条航线可在右侧查看「评分构成」，包含公式与各项得分、权重及贡献。

## 生成数据并运行

1. 将三个数据文件放在 **Downloads** 目录：
   - `T_ONTIME_MARKETING.csv`
   - `Annual Airline On-Time Rankings 2003-2024.xlsx`
   - `Table 4 Ranking of Major Airport On-Time Arrival Performance Year-to-date through December 2003-Dec 2024.xlsx`

2. 项目内已包含 `public/L_AIRPORT_ID.csv`（BTS 机场 ID 映射）。若缺失可重新下载到 `public/`。

3. 生成 JSON 并启动：

```bash
npm install
npm run build-data
npm run dev
```

浏览器打开 http://localhost:5173。页面会从 `public/data/airlines.json`、`airports.json`、`routes.json` 加载数据。

## 技术栈

- React 18 + Vite 5
- 纯 CSS（无 UI 库）
