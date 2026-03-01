# FlightIQ — Route Score & On-Time Analytics

A web app that generates **airline on-time rankings**, **airport on-time rankings**, and **route-level composite scores** from U.S. BTS (Bureau of Transportation Statistics) data. Scores combine historical on-time performance, flight volume, monthly stability, baggage mishandling rates, and fleet age into a single 0–100 FlightIQ Score.

---

## Features

- **Route on-time score** — Filter by time (month), airline, origin, and destination; sort by score, on-time %, delay rate, or flight count. Pagination (80 routes per page).
- **Airline on-time rank** — Table of carriers with annual on-time % (from BTS Marketing rankings).
- **Airport on-time rank** — Table of airports with codes and on-time %.
- **Score breakdown** — Click any route to see a detailed panel: formula, five factor scores, weights, and contributions (on-time %, flight volume, monthly stability, baggage, fleet age).
- **Resn-style UI** — Mesh gradient background, glassmorphism cards, 3D tilt and glare on route cards, count-up score animation, staggered list entrance, border-beam focus on Origin/Destination selects.

---

## Data Sources

| Source | Purpose |
|--------|---------|
| **Monthly CSVs** (e.g. `1.csv` … `12.csv`) | Route-level flight counts, delays (ARR_DEL15), cancellations. Columns: `OP_UNIQUE_CARRIER`, `ORIGIN`, `DEST`, `ARR_DEL15`, `CANCELLED`, `ORIGIN_CITY_NAME`, `DEST_CITY_NAME`. |
| **Annual Airline On-Time Rankings 2003–2024.xlsx** | Airline-level on-time % (we use 2024 Marketing sheet). |
| **Table 4 Ranking of Major Airport On-Time Arrival Performance...xlsx** | Airport-level on-time % (we use 2024 sheet). |
| **carrierBaggageRates.json** (optional) | Carrier-level mishandled bags per 100 enplaned (e.g. from DOT ATCR). |
| **carrierFleetAge.json** (optional) | Carrier-level average fleet age in years (from `build-fleet-age` script). |

Route on-time data can come from (a) the airline’s on-time rate on that route (when built from monthly CSVs), or (b) the average of origin and destination airport on-time rates when only airport rankings are available.

---

## Scoring Model

The **FlightIQ Score** is a weighted composite of five factors, each normalized to 0–100:

| Factor | Default weight | When month selected | Description |
|--------|----------------|---------------------|-------------|
| **On-time %** | 45% | 40% | Historical on-time rate (route or airport average). Higher is better. |
| **Flight volume** | 18% | 28% | Percentile of flight count within current filter; more flights → higher score (20–100). |
| **Monthly stability** | 12% | 8% | Lower month-to-month variation in flight count → higher score. |
| **Baggage mishandled** | 15% | 14% | Carrier-level mishandled bags per 100; lower → higher score. |
| **Fleet age** | 10% | 10% | Carrier-level average fleet age (years); newer fleet → higher score. |

- **Formula**: `Score = Σ (factor_score × weight) / Σ weight`, then clamped to 0–100.
- **Grades**: Excellent (≥85), Great (≥80), Good (≥70), Fair (≥60), Poor (&lt;60).
- Logic lives in `src/data/routes.js` (`calcScore`, `processRoutes`, `getGrade`).

---

## Generate Data & Run

### 1. Prerequisites

- Node.js (e.g. 18+)
- Place the following in your **Downloads** folder (or set env vars; see below):
  - `Annual Airline On-Time Rankings 2003-2024.xlsx`
  - `Table 4 Ranking of Major Airport On-Time Arrival Performance Year-to-date through December 2003-Dec 2024.xlsx`
- Place **12 monthly route CSVs** (`1.csv` … `12.csv`) in a folder (default: `~/Desktop/Unnamed Folder 2`). Set `ROUTES_CSV_DIR` if you use another path.

### 2. Optional: Baggage & fleet age

- **Baggage**: Add `public/data/carrierBaggageRates.json` with shape `{ "rates": { "AA": 0.45, ... } }` (mishandled per 100 bags).
- **Fleet age**: Run `npm run build-fleet-age` after placing `T_F41SCHEDULE_B43.csv` (e.g. on Desktop) and ensuring `scripts/airline_id_to_carrier.json` exists (BTS AIRLINE_ID → IATA 2-letter code). Override path with `T_F41_CSV` if needed.

### 3. Build route data and start app

```bash
npm install
npm run build-data
npm run dev
```

Then open **http://localhost:5173** (or the port Vite prints). The app loads:

- `public/data/airlines.json`
- `public/data/airports.json`
- `public/data/carriers.json`
- `public/data/routes.json`
- `public/data/periodOptions.json`
- `public/data/carrierBaggageRates.json` (optional)
- `public/data/carrierFleetAge.json` (optional)

### Environment variables (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `ROUTES_CSV_DIR` | `~/Desktop/Unnamed Folder 2` | Folder containing `1.csv` … `12.csv`. |
| `AIRLINE_XLSX` | `~/Downloads/Annual Airline On-Time Rankings 2003-2024.xlsx` | Airline ranking file. |
| `AIRPORT_XLSX` | `~/Downloads/Table 4 Ranking of Major Airport...xlsx` | Airport ranking file. |
| `T_F41_CSV` | `~/Desktop/T_F41SCHEDULE_B43.csv` | BTS Form 41 fleet file for `build-fleet-age`. |

---

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Build route data | `npm run build-data` | Reads 12 monthly CSVs + airline/airport xlsx; writes `airlines.json`, `airports.json`, `carriers.json`, `routes.json`, `periodOptions.json` to `public/data/`. |
| Build fleet age | `npm run build-fleet-age` | Reads `T_F41SCHEDULE_B43.csv` + `scripts/airline_id_to_carrier.json`; writes `public/data/carrierFleetAge.json`. |
| Dev server | `npm run dev` | Starts Vite dev server. |
| Production build | `npm run build` | Outputs to `dist/`. |
| Preview build | `npm run preview` | Serves `dist/` locally. |

---

## Tech Stack

- **React 18** + **Vite 5**
- **Framer Motion** — Score count-up, card stagger, 3D tilt, spring transitions
- **Plain CSS** — No UI library; custom glassmorphism, mesh gradient, and animations

---

## Project Structure (main pieces)

```
├── public/
│   ├── data/          # Generated JSON (airlines, airports, routes, carriers, periodOptions, etc.)
│   └── L_AIRPORT_ID.csv   # BTS airport ID mapping (if needed)
├── scripts/
│   ├── build-data.cjs     # Build route + airline + airport data from CSVs and xlsx
│   ├── build-fleet-age.cjs
│   └── airline_id_to_carrier.json   # BTS AIRLINE_ID → IATA 2-letter code
├── src/
│   ├── App.jsx            # Tabs, filters, pagination, route list + detail
│   ├── data/
│   │   └── routes.js      # Scoring: WEIGHTS, calcScore, getGrade, processRoutes
│   └── components/
│       ├── Header.jsx     # Title + letter animation
│       ├── RouteCard.jsx  # 3D tilt, glare, count-up score
│       ├── RouteDetail.jsx
│       ├── CountUpScore.jsx
│       └── FilterWithBorderBeam.jsx
└── README.md
```

---

## License

Private / project use. Data from U.S. BTS is subject to BTS terms of use.
