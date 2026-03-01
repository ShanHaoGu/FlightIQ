# Route Score Site

Generates **airline on-time rank**, **airport on-time rank**, and **route on-time score** from **BTS on-time data**.

Data sources:
- `T_ONTIME_MARKETING.csv`: routes and flight volume
- `Annual Airline On-Time Rankings 2003-2024.xlsx`: airline on-time rate (2024 Marketing)
- `Table 4 Ranking of Major Airport On-Time Arrival Performance...xlsx`: airport on-time rate (2024)

Route on-time rate is the average of origin and destination airport on-time rates. **Composite score** = on-time score × 80% + flight volume score × 20% (flight volume is converted to 0–100 by percentile within current filters). Grades: **Excellent** (≥85), **Good** (≥70), **Fair** (≥55), **Poor** (<55).

- **Filters**: Time (year-month), origin airport, and destination airport are dropdown options; combine them for more precise scores (after selecting a month, flight count reflects that month).
- **Score breakdown**: Click a route to see “Score breakdown” on the right, including formula, component scores, weights, and contributions.

## Generate data and run

1. Place the three data files in your **Downloads** folder:
   - `T_ONTIME_MARKETING.csv`
   - `Annual Airline On-Time Rankings 2003-2024.xlsx`
   - `Table 4 Ranking of Major Airport On-Time Arrival Performance Year-to-date through December 2003-Dec 2024.xlsx`

2. The project includes `public/L_AIRPORT_ID.csv` (BTS airport ID mapping). Re-download to `public/` if missing.

3. Generate JSON and start:

```bash
npm install
npm run build-data
npm run dev
```

Open http://localhost:5173 in your browser. The page loads data from `public/data/airlines.json`, `airports.json`, and `routes.json`.

## Tech stack

- React 18 + Vite 5
- Plain CSS (no UI library)
