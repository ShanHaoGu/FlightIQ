/**
 * Build route score data from 12 monthly CSVs (new data model).
 * Input: Unnamed folder 2/1.csv..12.csv (OP_UNIQUE_CARRIER, ORIGIN, DEST, delay/cancel)
 *        Annual Airline / Table 4 Airport xlsx (airline and airport rankings).
 * Output: public/data/airlines.json, airports.json, routes.json, carriers.json, periodOptions.json
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const XLSX = require('xlsx')
const { parse } = require('csv-parse/sync')

const DEFAULT_YEAR = 2024
const OUT_DIR = path.join(__dirname, '../public/data')

// 12 monthly files: 1.csv=Jan, 2.csv=Feb, ..., 12.csv=Dec
const ROUTES_CSV_DIR = process.env.ROUTES_CSV_DIR || path.join(os.homedir(), 'Desktop', 'Unnamed Folder 2')
function getMonthCsvPath(month) {
  return path.join(ROUTES_CSV_DIR, `${month}.csv`)
}

const AIRLINE_XLSX = process.env.AIRLINE_XLSX || path.join(os.homedir(), 'Downloads', 'Annual Airline On-Time Rankings 2003-2024.xlsx')
const AIRPORT_XLSX = process.env.AIRPORT_XLSX || path.join(os.homedir(), 'Downloads', 'Table 4 Ranking of Major Airport On-Time Arrival Performance Year-to-date through December 2003-Dec 2024.xlsx')

// BTS carrier code -> display name (common carriers)
const CARRIER_NAMES = {
  '9E': 'Endeavor Air',
  'AA': 'American Airlines',
  'AS': 'Alaska Airlines',
  'B6': 'JetBlue Airways',
  'DL': 'Delta Air Lines',
  'F9': 'Frontier Airlines',
  'G4': 'Allegiant Air',
  'HA': 'Hawaiian Airlines',
  'NK': 'Spirit Airlines',
  'OO': 'SkyWest Airlines',
  'UA': 'United Airlines',
  'WN': 'Southwest Airlines',
  'YX': 'Republic Airways',
  'MQ': 'Envoy Air',
  'OH': 'PSA Airlines',
  'QX': 'Horizon Air',
  'YV': 'Mesa Airlines'
}

function parseAirlineRanking() {
  if (!fs.existsSync(AIRLINE_XLSX)) return []
  const wb = XLSX.readFile(AIRLINE_XLSX)
  const sheetName = wb.SheetNames.find(n => n.includes('Marketing') && n.includes('2024')) || 'Marketing 2024'
  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
  const result = []
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i]
    const name = r[1] && String(r[1]).trim()
    const pct = typeof r[2] === 'number' ? r[2] : parseFloat(r[2])
    if (!name || name.includes('All Carriers') || name.includes('Source:')) break
    if (name && !isNaN(pct)) result.push({ rank: result.length + 1, name, onTimePct: pct })
  }
  return result
}

function parseAirportRanking() {
  if (!fs.existsSync(AIRPORT_XLSX)) return []
  const wb = XLSX.readFile(AIRPORT_XLSX)
  const ws = wb.Sheets['2024']
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
  const result = []
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i]
    const nameCell = r[4] || r[1]
    const pctCell = r[5] !== undefined ? r[5] : r[2]
    if (!nameCell) continue
    const name = String(nameCell).trim()
    const match = name.match(/\s*\(([A-Z]{3})\)\s*$/)
    const code = match ? match[1] : null
    const pct = typeof pctCell === 'number' ? pctCell : parseFloat(pctCell)
    if (code && !isNaN(pct)) result.push({ rank: result.length + 1, name, code, onTimePct: pct })
  }
  return result
}

/** Parse single-month CSV: header must include OP_UNIQUE_CARRIER, ORIGIN, DEST, ARR_DEL15, CANCELLED */
function aggregateOneMonthCsv(filePath, month, year) {
  const text = fs.readFileSync(filePath, 'utf8')
  let rows
  try {
    rows = parse(text, { columns: true, skip_empty_lines: true, relax_column_count: true })
  } catch (e) {
    console.error('Parse error', filePath, e.message)
    return null
  }
  const count = {}
  const cityNames = {}
  for (const r of rows) {
    const carrier = (r.OP_UNIQUE_CARRIER || '').trim()
    const origin = (r.ORIGIN || '').trim().toUpperCase()
    const dest = (r.DEST || '').trim().toUpperCase()
    if (!carrier || !origin || !dest || origin.length !== 3 || dest.length !== 3) continue
    const key = `${origin}|${dest}|${carrier}`
    if (!count[key]) {
      count[key] = { flights: 0, arrDel15: 0, cancelled: 0 }
      cityNames[origin] = (r.ORIGIN_CITY_NAME || '').trim().replace(/^"|"$/g, '')
      cityNames[dest] = (r.DEST_CITY_NAME || '').trim().replace(/^"|"$/g, '')
    }
    count[key].flights += 1
    const d15 = parseFloat(r.ARR_DEL15)
    const canc = parseFloat(r.CANCELLED)
    if (!isNaN(d15)) count[key].arrDel15 += d15
    if (!isNaN(canc)) count[key].cancelled += canc
  }
  return { count, cityNames, month, year }
}

/** Build routes from 12 monthly CSVs (with carrier) */
function buildRoutesFromNewTwelveFiles() {
  const routeMap = {}
  const allCityNames = {}
  for (let month = 1; month <= 12; month++) {
    const filePath = getMonthCsvPath(month)
    if (!fs.existsSync(filePath)) continue
    const result = aggregateOneMonthCsv(filePath, month, DEFAULT_YEAR)
    if (!result) continue
    for (const [key, v] of Object.entries(result.count)) {
      if (!routeMap[key]) {
        routeMap[key] = { periods: [], totalFlights: 0, totalDel15: 0, totalCanc: 0 }
      }
      const r = routeMap[key]
      r.totalFlights += v.flights
      r.totalDel15 += v.arrDel15
      r.totalCanc += v.cancelled
      r.periods.push({
        year: result.year,
        month: result.month,
        quarter: Math.ceil(result.month / 3),
        flightCount: v.flights,
        delayed15: v.arrDel15,
        cancelled: v.cancelled,
        onTimePct: v.flights > 0 ? Math.round((1 - (v.arrDel15 + v.cancelled) / v.flights) * 10000) / 100 : null
      })
      Object.assign(allCityNames, result.cityNames)
    }
  }
  for (const r of Object.values(routeMap)) {
    r.periods.sort((a, b) => a.month - b.month)
  }
  const routes = []
  const carrierSet = new Set()
  for (const [key, r] of Object.entries(routeMap)) {
    const [fromCode, toCode, carrier] = key.split('|')
    carrierSet.add(carrier)
    const total = r.totalFlights
    const onTimePct = total > 0 ? Math.round((1 - (r.totalDel15 + r.totalCanc) / total) * 10000) / 100 : null
    const delayRate = total > 0 ? Math.round((r.totalDel15 / total) * 10000) / 100 : null
    const cancelRate = total > 0 ? Math.round((r.totalCanc / total) * 10000) / 100 : null
    routes.push({
      fromCode,
      toCode,
      from: allCityNames[fromCode] || fromCode,
      to: allCityNames[toCode] || toCode,
      carrier,
      carrierName: CARRIER_NAMES[carrier] || carrier,
      totalFlightCount: total,
      periods: r.periods.map(p => {
        const fc = p.flightCount
        const delayRate = fc > 0 ? Math.round((p.delayed15 / fc) * 10000) / 100 : null
        const cancelRate = fc > 0 ? Math.round((p.cancelled / fc) * 10000) / 100 : null
        return {
          year: p.year,
          month: p.month,
          quarter: p.quarter,
          flightCount: p.flightCount,
          onTimePct: p.onTimePct,
          delayRate,
          cancelRate
        }
      }),
      onTimePct,
      delayRate,
      cancelRate
    })
  }
  routes.sort((a, b) => b.totalFlightCount - a.totalFlightCount)
  const carriers = Array.from(carrierSet).sort().map(code => ({
    code,
    name: CARRIER_NAMES[code] || code
  }))
  return { routes, carriers }
}

function main() {
  const useNew = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].every(m => fs.existsSync(getMonthCsvPath(m)))
  if (!useNew) {
    console.error('Missing: need all 12 files in', ROUTES_CSV_DIR, '(1.csv .. 12.csv). Set ROUTES_CSV_DIR if needed.')
    process.exit(1)
  }

  const airlines = parseAirlineRanking()
  const airports = parseAirportRanking()
  const { routes, carriers } = buildRoutesFromNewTwelveFiles()

  const periodOptions = []
  for (let m = 1; m <= 12; m++) {
    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    periodOptions.push({ year: DEFAULT_YEAR, month: m, label: monthNames[m] + ' ' + DEFAULT_YEAR })
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(path.join(OUT_DIR, 'airlines.json'), JSON.stringify(airlines, null, 2))
  fs.writeFileSync(path.join(OUT_DIR, 'airports.json'), JSON.stringify(airports, null, 2))
  fs.writeFileSync(path.join(OUT_DIR, 'carriers.json'), JSON.stringify(carriers, null, 2))
  fs.writeFileSync(path.join(OUT_DIR, 'routes.json'), JSON.stringify(routes.slice(0, 2000), null, 2))
  fs.writeFileSync(path.join(OUT_DIR, 'periodOptions.json'), JSON.stringify(periodOptions, null, 2))

  console.log('Wrote:', path.join(OUT_DIR, 'airlines.json'), airlines.length, 'airlines')
  console.log('Wrote:', path.join(OUT_DIR, 'airports.json'), airports.length, 'airports')
  console.log('Wrote:', path.join(OUT_DIR, 'carriers.json'), carriers.length, 'carriers')
  console.log('Wrote:', path.join(OUT_DIR, 'routes.json'), Math.min(2000, routes.length), 'routes')
  console.log('Wrote:', path.join(OUT_DIR, 'periodOptions.json'), periodOptions.length, 'period options')
}

main()
