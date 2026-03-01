/**
 * Build carrier average fleet age from T_F41SCHEDULE_B43 (BTS Form 41 fleet) + AIRLINE_ID mapping.
 * Input: T_F41SCHEDULE_B43.csv (Desktop), scripts/airline_id_to_carrier.json
 * Output: public/data/carrierFleetAge.json (average age by carrier code; lower age can yield higher score)
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const { parse } = require('csv-parse/sync')

const F41_CSV = process.env.T_F41_CSV || path.join(os.homedir(), 'Desktop', 'T_F41SCHEDULE_B43.csv')
const MAPPING_PATH = path.join(__dirname, 'airline_id_to_carrier.json')
const OUT_PATH = path.join(__dirname, '../public/data/carrierFleetAge.json')
const REFERENCE_YEAR = 2025

function main() {
  if (!fs.existsSync(F41_CSV)) {
    console.error('Missing:', F41_CSV, '- set T_F41_CSV if needed.')
    process.exit(1)
  }
  if (!fs.existsSync(MAPPING_PATH)) {
    console.error('Missing:', MAPPING_PATH)
    process.exit(1)
  }

  const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8')).mapping || {}
  const text = fs.readFileSync(F41_CSV, 'utf8')
  const rows = parse(text, { columns: true, skip_empty_lines: true, relax_column_count: true })

  const agesByCarrier = {} // carrier -> [age1, age2, ...]

  for (const r of rows) {
    const airlineId = String(r.AIRLINE_ID || '').trim()
    if (!airlineId || airlineId === 'AIRLINE_ID') continue
    const carrier = mapping[airlineId]
    if (!carrier) continue

    let year = parseInt(r.MANUFACTURE_YEAR, 10)
    if (isNaN(year) || year <= 0 || year > REFERENCE_YEAR) continue
    const age = REFERENCE_YEAR - year
    if (age < 0) continue

    if (!agesByCarrier[carrier]) agesByCarrier[carrier] = []
    agesByCarrier[carrier].push(age)
  }

  const averageAgeByCarrier = {}
  for (const [carrier, ages] of Object.entries(agesByCarrier)) {
    const sum = ages.reduce((a, b) => a + b, 0)
    averageAgeByCarrier[carrier] = Math.round((sum / ages.length) * 10) / 10
  }

  const out = {
    source: 'BTS Form 41 Schedule B-43 (Inventory of Airframes), MANUFACTURE_YEAR',
    unit: 'years',
    referenceYear: REFERENCE_YEAR,
    averageAgeByCarrier
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2))
  console.log('Wrote:', OUT_PATH, Object.keys(averageAgeByCarrier).length, 'carriers')
}

main()
