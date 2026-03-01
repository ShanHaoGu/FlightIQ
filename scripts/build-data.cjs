/**
 * 从用户提供的三个数据源生成航线评分数据
 * 输入: T_ONTIME_MARKETING.csv, Annual Airline On-Time Rankings xlsx, Table 4 Airport xlsx, L_AIRPORT_ID.csv
 * 输出: public/data/airlines.json, airports.json, routes.json
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const XLSX = require('xlsx')

const DOWNLOADS = process.env.DOWNLOADS || path.join(os.homedir(), 'Downloads')
const AIRLINE_XLSX = path.join(DOWNLOADS, 'Annual Airline On-Time Rankings 2003-2024.xlsx')
const AIRPORT_XLSX = path.join(DOWNLOADS, 'Table 4 Ranking of Major Airport On-Time Arrival Performance Year-to-date through December 2003-Dec 2024.xlsx')
const ROUTES_CSV = path.join(DOWNLOADS, 'T_ONTIME_MARKETING.csv')
// 1月=尾缀2, 2月=尾缀3, ..., 12月=尾缀13
const ROUTES_CSV_BY_MONTH = []
for (let month = 1; month <= 12; month++) {
  ROUTES_CSV_BY_MONTH.push(path.join(DOWNLOADS, `T_ONTIME_MARKETING ${month + 1}.csv`))
}
const DEFAULT_YEAR = 2024
const AIRPORT_ID_CSV = path.join(__dirname, '../public/L_AIRPORT_ID.csv')
const OUT_DIR = path.join(__dirname, '../public/data')

// Table 4 中同一城市多机场时，代码 -> 机场名称关键词，用于匹配 L_AIRPORT Description
const CODE_TO_NAME_HINT = {
  DCA: 'Reagan',
  IAD: 'Dulles',
  LGA: 'LaGuardia',
  JFK: 'Kennedy',
  EWR: 'Newark',
  ORD: "O'Hare",
  MDW: 'Midway',
  BOS: 'Logan',
  MIA: 'International',
  FLL: 'Fort Lauderdale',
  SFO: 'International',
  LAX: 'International',
  SEA: 'Seattle/Tacoma',
  DEN: 'International',
  PHX: 'Sky Harbor',
  DFW: 'Dallas/Fort Worth',
  IAH: 'Houston',
  ATL: 'Hartsfield',
  MSP: 'Minneapolis-St Paul',
  DTW: 'Detroit Metro',
  CLT: 'Charlotte',
  BWI: 'Baltimore',
  DCA: 'Reagan',
  IAD: 'Dulles'
}

function parseAirlineRanking() {
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

function loadAirportIdToDescription() {
  const text = fs.readFileSync(AIRPORT_ID_CSV, 'utf8')
  const lines = text.split(/\r?\n/).filter(Boolean)
  const map = {}
  for (let i = 1; i < lines.length; i++) {
    const m = lines[i].match(/"(\d+)","(.+)"/)
    if (m) map[m[1]] = m[2]
  }
  return map
}

function buildCodeToId(airportRows, idToDesc) {
  const codeToId = {}
  const cityToCodes = {}
  for (const a of airportRows) {
    const citySt = a.name.replace(/\s*\([A-Z]{3}\)\s*$/, '').trim()
    if (!cityToCodes[citySt]) cityToCodes[citySt] = []
    cityToCodes[citySt].push({ code: a.code, onTimePct: a.onTimePct })
  }
  for (const [id, desc] of Object.entries(idToDesc)) {
    const idx = desc.indexOf(':')
    const citySt = idx >= 0 ? desc.slice(0, idx).trim() : desc
    const namePart = idx >= 0 ? desc.slice(idx + 1).trim() : ''
    const codes = cityToCodes[citySt]
    if (!codes) continue
    if (codes.length === 1) {
      codeToId[codes[0].code] = { id, onTimePct: codes[0].onTimePct }
    } else {
      const hint = CODE_TO_NAME_HINT
      for (const c of codes) {
        const key = c.code
        const hintStr = hint[key]
        if (hintStr && namePart.includes(hintStr)) {
          codeToId[key] = { id, onTimePct: c.onTimePct }
          break
        }
      }
      if (!codeToId[codes[0].code]) codeToId[codes[0].code] = { id, onTimePct: codes[0].onTimePct }
    }
  }
  return codeToId
}

/** 从单个 CSV 按 (origin, dest) 聚合航班量 */
function aggregateOneCsv(filePath, month, year) {
  const text = fs.readFileSync(filePath, 'utf8')
  const lines = text.split(/\r?\n/).filter(Boolean)
  const header = lines[0].split(',')
  const originIdx = header.indexOf('ORIGIN_AIRPORT_ID')
  const destIdx = header.indexOf('DEST_AIRPORT_ID')
  if (originIdx < 0 || destIdx < 0) return null
  const count = {}
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const o = cols[originIdx].trim()
    const d = cols[destIdx].trim()
    if (!o || !d) continue
    const key = o + '|' + d
    count[key] = (count[key] || 0) + 1
  }
  return { count, month, year }
}

/** 从 12 个月份 CSV 合并（尾缀 2=1月, 3=2月, ..., 13=12月） */
function aggregateRoutesFromTwelveFiles() {
  const totalCount = {}
  const periodMap = {}
  const year = DEFAULT_YEAR
  for (let month = 1; month <= 12; month++) {
    const filePath = ROUTES_CSV_BY_MONTH[month - 1]
    if (!fs.existsSync(filePath)) continue
    const result = aggregateOneCsv(filePath, month, year)
    if (!result) continue
    for (const [routeKey, n] of Object.entries(result.count)) {
      totalCount[routeKey] = (totalCount[routeKey] || 0) + n
      if (!periodMap[routeKey]) periodMap[routeKey] = []
      periodMap[routeKey].push({
        year: result.year,
        month: result.month,
        quarter: Math.ceil(result.month / 3),
        flightCount: n
      })
    }
  }
  for (const k of Object.keys(periodMap)) {
    periodMap[k].sort((a, b) => a.month - b.month)
  }
  return Object.entries(totalCount)
    .map(([k, n]) => {
      const [originId, destId] = k.split('|')
      return {
        originId,
        destId,
        flightCount: n,
        periods: periodMap[k] || []
      }
    })
    .sort((a, b) => b.flightCount - a.flightCount)
}

function aggregateRoutes() {
  const useTwelve = ROUTES_CSV_BY_MONTH.every(p => fs.existsSync(p))
  if (useTwelve) {
    return aggregateRoutesFromTwelveFiles()
  }
  if (!fs.existsSync(ROUTES_CSV)) throw new Error('No route CSV found (need either 12 files T_ONTIME_MARKETING 2..13.csv or T_ONTIME_MARKETING.csv)')
  const text = fs.readFileSync(ROUTES_CSV, 'utf8')
  const lines = text.split(/\r?\n/).filter(Boolean)
  const header = lines[0].split(',')
  const originIdx = header.indexOf('ORIGIN_AIRPORT_ID')
  const destIdx = header.indexOf('DEST_AIRPORT_ID')
  const yearIdx = header.indexOf('YEAR')
  const monthIdx = header.indexOf('MONTH')
  const quarterIdx = header.indexOf('QUARTER')
  if (originIdx < 0 || destIdx < 0) throw new Error('CSV missing ORIGIN_AIRPORT_ID or DEST_AIRPORT_ID')
  const totalCount = {}
  const periodCount = {}
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const o = cols[originIdx].trim()
    const d = cols[destIdx].trim()
    if (!o || !d) continue
    const routeKey = o + '|' + d
    totalCount[routeKey] = (totalCount[routeKey] || 0) + 1
    const year = yearIdx >= 0 ? cols[yearIdx].trim() : ''
    const month = monthIdx >= 0 ? cols[monthIdx].trim() : ''
    const quarter = quarterIdx >= 0 ? cols[quarterIdx].trim() : ''
    if (year && month) {
      const periodKey = routeKey + '|' + year + '|' + month + '|' + quarter
      periodCount[periodKey] = (periodCount[periodKey] || 0) + 1
    }
  }
  const periodMap = {}
  for (const [periodKey, n] of Object.entries(periodCount)) {
    const parts = periodKey.split('|')
    if (parts.length < 5) continue
    const routeKey = parts[0] + '|' + parts[1]
    const y = parseInt(parts[2], 10)
    const m = parseInt(parts[3], 10)
    if (!y || !m) continue
    if (!periodMap[routeKey]) periodMap[routeKey] = []
    periodMap[routeKey].push({
      year: y,
      month: m,
      quarter: parseInt(parts[4], 10) || null,
      flightCount: n
    })
  }
  return Object.entries(totalCount)
    .map(([k, n]) => {
      const [originId, destId] = k.split('|')
      const periods = (periodMap[k] || []).sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
      return { originId, destId, flightCount: n, periods }
    })
    .sort((a, b) => b.flightCount - a.flightCount)
}

function buildIdToCodeAndPct(airportRows, idToDesc) {
  const codeToInfo = {}
  for (const a of airportRows) codeToInfo[a.code] = a.onTimePct
  const cityStToCodes = {}
  const normalizeCity = (s) => s.replace(/\s*\/\s*St\.?\s*Paul\s*,/, ',').trim()
  for (const a of airportRows) {
    const citySt2 = a.name.replace(/\s*\([A-Z]{3}\)\s*$/, '').trim()
    if (!citySt2) continue
    const entry = { code: a.code, onTimePct: a.onTimePct }
    for (const key of [citySt2, normalizeCity(citySt2)]) {
      if (!key) continue
      if (!cityStToCodes[key]) cityStToCodes[key] = []
      if (!cityStToCodes[key].some(x => x.code === a.code)) cityStToCodes[key].push(entry)
    }
  }
  const idToCode = {}
  const idToPct = {}
  for (const [id, desc] of Object.entries(idToDesc)) {
    const idx = desc.indexOf(':')
    let citySt = idx >= 0 ? desc.slice(0, idx).trim() : desc
    if (!cityStToCodes[citySt]) citySt = normalizeCity(citySt)
    const namePart = idx >= 0 ? desc.slice(idx + 1).trim() : ''
    const codes = cityStToCodes[citySt]
    if (!codes) continue
    let code = codes.length === 1 ? codes[0].code : null
    let pct = codes.length === 1 ? codes[0].onTimePct : null
    if (codes.length > 1) {
      for (const c of codes) {
        const hintStr = CODE_TO_NAME_HINT[c.code]
        if (hintStr && namePart.includes(hintStr)) {
          code = c.code
          pct = c.onTimePct
          break
        }
      }
      if (!code) {
        code = codes[0].code
        pct = codes[0].onTimePct
      }
    }
    if (code) {
      idToCode[id] = code
      idToPct[id] = pct
    }
  }
  return { idToCode, idToPct }
}

function main() {
  if (!fs.existsSync(AIRLINE_XLSX)) {
    console.error('Missing:', AIRLINE_XLSX)
    process.exit(1)
  }
  if (!fs.existsSync(AIRPORT_XLSX)) {
    console.error('Missing:', AIRPORT_XLSX)
    process.exit(1)
  }
  const hasTwelve = ROUTES_CSV_BY_MONTH.every(p => fs.existsSync(p))
  if (!hasTwelve && !fs.existsSync(ROUTES_CSV)) {
    console.error('Missing: need either all 12 files (T_ONTIME_MARKETING 2.csv .. 13.csv) or', ROUTES_CSV)
    process.exit(1)
  }
  if (!fs.existsSync(AIRPORT_ID_CSV)) {
    console.error('Missing:', AIRPORT_ID_CSV, '(run from project root or ensure public/L_AIRPORT_ID.csv exists)')
    process.exit(1)
  }

  const airlines = parseAirlineRanking()
  const airports = parseAirportRanking()
  const idToDesc = loadAirportIdToDescription()
  const { idToCode, idToPct } = buildIdToCodeAndPct(airports, idToDesc)

  const usedTwelveFiles = ROUTES_CSV_BY_MONTH.every(p => fs.existsSync(p))
  const routeAgg = aggregateRoutes()
  const codeToName = {}
  airports.forEach(a => { codeToName[a.code] = a.name.replace(/\s*\([A-Z]{3}\)\s*$/, '').trim() })

  const routes = []
  const yearMonthSet = new Set()
  if (usedTwelveFiles) {
    for (let m = 1; m <= 12; m++) yearMonthSet.add(DEFAULT_YEAR + '-' + m)
  }
  for (const r of routeAgg.slice(0, 500)) {
    const fromCode = idToCode[r.originId]
    const toCode = idToCode[r.destId]
    const fromPct = idToPct[r.originId]
    const toPct = idToPct[r.destId]
    if (!fromCode || !toCode) continue
    const onTimePct = (fromPct != null && toPct != null)
      ? (fromPct + toPct) / 2
      : fromPct ?? toPct ?? null
    for (const p of r.periods || []) {
      yearMonthSet.add(p.year + '-' + p.month)
    }
    routes.push({
      from: codeToName[fromCode] || fromCode,
      to: codeToName[toCode] || toCode,
      fromCode,
      toCode,
      totalFlightCount: r.flightCount,
      periods: (r.periods || []).map(p => ({ year: p.year, month: p.month, quarter: p.quarter, flightCount: p.flightCount })),
      onTimePct: onTimePct != null ? Math.round(onTimePct * 100) / 100 : null,
      delayRate: onTimePct != null ? Math.round((100 - onTimePct) * 100) / 100 : null
    })
  }

  const periodOptions = Array.from(yearMonthSet)
    .sort((a, b) => {
      const [ya, ma] = a.split('-').map(Number)
      const [yb, mb] = b.split('-').map(Number)
      return ya !== yb ? ya - yb : ma - mb
    })
    .map(s => {
      const [y, m] = s.split('-').map(Number)
      return { year: y, month: m, label: y + '年' + m + '月' }
    })
    .filter(p => p.year && p.month)

  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(path.join(OUT_DIR, 'airlines.json'), JSON.stringify(airlines, null, 2))
  fs.writeFileSync(path.join(OUT_DIR, 'airports.json'), JSON.stringify(airports, null, 2))
  fs.writeFileSync(path.join(OUT_DIR, 'routes.json'), JSON.stringify(routes, null, 2))
  fs.writeFileSync(path.join(OUT_DIR, 'periodOptions.json'), JSON.stringify(periodOptions, null, 2))

  console.log('Wrote:', path.join(OUT_DIR, 'airlines.json'), airlines.length, 'airlines')
  console.log('Wrote:', path.join(OUT_DIR, 'airports.json'), airports.length, 'airports')
  console.log('Wrote:', path.join(OUT_DIR, 'routes.json'), routes.length, 'routes')
  console.log('Wrote:', path.join(OUT_DIR, 'periodOptions.json'), periodOptions.length, 'period options')
}

main()
