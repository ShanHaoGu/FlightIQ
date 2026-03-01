import { useState, useEffect, useMemo } from 'react'
import { processRoutes, getGrade } from './data/routes'
import RouteCard from './components/RouteCard'
import RouteDetail from './components/RouteDetail'
import Header from './components/Header'
import FilterWithBorderBeam from './components/FilterWithBorderBeam'
import './App.css'

const DATA_BASE = '/data'

function App() {
  const [airlines, setAirlines] = useState([])
  const [airports, setAirports] = useState([])
  const [carriers, setCarriers] = useState([])
  const [rawRoutes, setRawRoutes] = useState([])
  const [carrierBaggageRates, setCarrierBaggageRates] = useState(null)
  const [carrierFleetAge, setCarrierFleetAge] = useState(null)
  const [periodOptions, setPeriodOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('routes')
  const [selectedId, setSelectedId] = useState(null)
  const [sortBy, setSortBy] = useState('score')
  const [order, setOrder] = useState('desc')
  const [filterPeriod, setFilterPeriod] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterAirline, setFilterAirline] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    Promise.all([
      fetch(`${DATA_BASE}/airlines.json`).then(r => r.ok ? r.json() : []),
      fetch(`${DATA_BASE}/airports.json`).then(r => r.ok ? r.json() : []),
      fetch(`${DATA_BASE}/carriers.json`).then(r => r.ok ? r.json() : []),
      fetch(`${DATA_BASE}/routes.json`).then(r => r.ok ? r.json() : []),
      fetch(`${DATA_BASE}/periodOptions.json`).then(r => r.ok ? r.json() : []),
      fetch(`${DATA_BASE}/carrierBaggageRates.json`).then(r => r.ok ? r.json() : null),
      fetch(`${DATA_BASE}/carrierFleetAge.json`).then(r => r.ok ? r.json() : null)
    ])
      .then(([a, b, carr, c, p, baggage, fleetAge]) => {
        setAirlines(Array.isArray(a) ? a : [])
        setAirports(Array.isArray(b) ? b : [])
        setCarriers(Array.isArray(carr) ? carr : [])
        setRawRoutes(Array.isArray(c) ? c : [])
        setPeriodOptions(Array.isArray(p) ? p : [])
        setCarrierBaggageRates(baggage && baggage.rates ? baggage : null)
        setCarrierFleetAge(fleetAge && fleetAge.averageAgeByCarrier ? fleetAge : null)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const period = useMemo(() => {
    if (!filterPeriod) return null
    const opt = periodOptions.find(o => o.label === filterPeriod || `${o.year}-${o.month}` === filterPeriod)
    if (opt) return { year: opt.year, month: opt.month }
    const [y, m] = filterPeriod.split('-').map(Number)
    if (y && m) return { year: y, month: m }
    return null
  }, [filterPeriod, periodOptions])

  const filteredRaw = useMemo(() => {
    const withBaggage = rawRoutes.map(r => ({
      ...r,
      baggageMishandledPer100: carrierBaggageRates?.rates?.[r.carrier] ?? null,
      fleetAgeYears: carrierFleetAge?.averageAgeByCarrier?.[r.carrier] ?? null
    }))
    let list = withBaggage
    if (filterFrom) list = list.filter(r => r.fromCode === filterFrom)
    if (filterTo) list = list.filter(r => r.toCode === filterTo)
    if (filterAirline) list = list.filter(r => r.carrier === filterAirline)
    if (period && period.year && period.month) {
      list = list.filter(r =>
        r.periods && r.periods.some(p => p.year === period.year && p.month === period.month)
      )
    }
    return list
  }, [rawRoutes, carrierBaggageRates, carrierFleetAge, filterFrom, filterTo, filterAirline, period])

  const routes = useMemo(
    () => processRoutes(filteredRaw, period),
    [filteredRaw, period]
  )

  const filteredAndSorted = useMemo(() => {
    const key = sortBy === 'score' ? 'score' : sortBy
    return [...routes].sort((a, b) => {
      const va = a[key]
      const vb = b[key]
      if (va == null && vb == null) return 0
      if (va == null) return order === 'desc' ? 1 : -1
      if (vb == null) return order === 'desc' ? -1 : 1
      if (typeof va === 'number' && typeof vb === 'number') {
        return order === 'desc' ? vb - va : va - vb
      }
      return 0
    })
  }, [routes, sortBy, order])

  const selected = selectedId ? filteredAndSorted.find(r => r.id === selectedId) : null

  const PAGE_SIZE = 80
  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE))
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const displayedRoutes = filteredAndSorted.slice(startIndex, startIndex + PAGE_SIZE)

  useEffect(() => {
    setCurrentPage(1)
  }, [filterPeriod, filterFrom, filterTo, filterAirline, sortBy, order])

  if (loading) {
    return (
      <div className="app">
        <div className="app-bg" aria-hidden />
        <Header />
        <main className="main">
          <div className="loading-wrap" role="status" aria-label="Loading">
            <div className="loading-spinner" />
            <p className="loading-text">Loading data…</p>
          </div>
        </main>
      </div>
    )
  }
  if (error) {
    return (
      <div className="app">
        <div className="app-bg" aria-hidden />
        <Header />
        <main className="main"><p className="empty">Failed to load: {error}. Run <code>node scripts/build-data.cjs</code> to generate data files.</p></main>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="app-bg" aria-hidden />
      <Header />
      <main className="main">
        <nav className="tabs">
          <button type="button" className={tab === 'routes' ? 'active' : ''} onClick={() => setTab('routes')}>Route on-time score</button>
          <button type="button" className={tab === 'airlines' ? 'active' : ''} onClick={() => setTab('airlines')}>Airline on-time rank</button>
          <button type="button" className={tab === 'airports' ? 'active' : ''} onClick={() => setTab('airports')}>Airport on-time rank</button>
        </nav>

        {tab === 'routes' && (
          <>
            <section className="controls">
              <div className="filters">
                <label className="filter-group">
                  <span className="filter-label">Time</span>
                  <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
                    <option value="">All</option>
                    {periodOptions.map(opt => (
                      <option key={opt.year + '-' + opt.month} value={opt.year + '-' + opt.month}>{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][opt.month - 1]}</option>
                    ))}
                  </select>
                  {periodOptions.length <= 1 && (
                    <span className="filter-hint">Options from data year-month; current CSV has these months only.</span>
                  )}
                </label>
                <label className="filter-group">
                  <span className="filter-label">Airline</span>
                  <select value={filterAirline} onChange={e => setFilterAirline(e.target.value)}>
                    <option value="">All</option>
                    {carriers.map(c => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                  {carriers.length === 0 && rawRoutes.length > 0 && (
                    <span className="filter-hint">(Airline filter unavailable without carriers.json)</span>
                  )}
                </label>
                <FilterWithBorderBeam>
                  <span className="filter-label">Origin</span>
                  <select value={filterFrom} onChange={e => setFilterFrom(e.target.value)}>
                    <option value="">All</option>
                    {airports.map(a => (
                      <option key={a.code} value={a.code}>{a.code} {a.name.replace(/\s*\([A-Z]{3}\)\s*$/, '')}</option>
                    ))}
                  </select>
                </FilterWithBorderBeam>
                <FilterWithBorderBeam>
                  <span className="filter-label">Destination</span>
                  <select value={filterTo} onChange={e => setFilterTo(e.target.value)}>
                    <option value="">All</option>
                    {airports.map(a => (
                      <option key={a.code} value={a.code}>{a.code} {a.name.replace(/\s*\([A-Z]{3}\)\s*$/, '')}</option>
                    ))}
                  </select>
                </FilterWithBorderBeam>
              </div>
              {periodOptions.length > 1 && (
                <p className="controls-note">
                  On-time rate is annual; selecting a month shows that month’s flight count and recalculates score with higher weight for that month.
                </p>
              )}
              <div className="sort-row">
                <span className="sort-label">Sort by:</span>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="score">Score</option>
                  <option value="onTimePct">On-time %</option>
                  <option value="delayRate">Delay rate</option>
                  <option value="flightCount">Flights</option>
                </select>
                <button type="button" className="order-btn" onClick={() => setOrder(o => (o === 'desc' ? 'asc' : 'desc'))}>
                  {order === 'desc' ? 'High to low' : 'Low to high'}
                </button>
              </div>
            </section>
            <div className="content">
              <div className="route-list">
                {displayedRoutes.map((route, i) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    isSelected={selectedId === route.id}
                    onClick={() => setSelectedId(route.id)}
                    index={i}
                  />
                ))}
                {filteredAndSorted.length === 0 ? (
                  <div className="empty-state-route">
                    <p className="empty-title">No routes match</p>
                    <p className="empty-desc">Try changing Time, Airline, Origin, or Destination to see more results.</p>
                  </div>
                ) : totalPages > 1 && (
                  <nav className="pagination" aria-label="Page navigation">
                    <button
                      type="button"
                      className="pagination-btn"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      ← Prev
                    </button>
                    <label className="pagination-page-select">
                      <span className="pagination-label">Page</span>
                      <select
                        value={currentPage}
                        onChange={e => setCurrentPage(Number(e.target.value))}
                        className="pagination-select"
                      >
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <span className="pagination-of">/ {totalPages}</span>
                    </label>
                    <span className="pagination-range">
                      {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, filteredAndSorted.length)} of {filteredAndSorted.length}
                    </span>
                    <button
                      type="button"
                      className="pagination-btn"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next →
                    </button>
                  </nav>
                )}
              </div>
              {selected && (
                <RouteDetail route={selected} onClose={() => setSelectedId(null)} />
              )}
            </div>
          </>
        )}

        {tab === 'airlines' && (
          <div className="table-wrap">
            <table className="rank-table">
              <thead>
                <tr><th>Rank</th><th>Airline</th><th>On-time %</th></tr>
              </thead>
              <tbody>
                {airlines.map(a => {
                  const score = a.onTimePct != null ? Math.round(a.onTimePct) : null
                  return (
                    <tr key={a.rank}>
                      <td>{a.rank}</td>
                      <td>{a.name}</td>
                      <td>{a.onTimePct != null ? `${a.onTimePct}%` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'airports' && (
          <div className="table-wrap">
            <table className="rank-table">
              <thead>
                <tr><th>Rank</th><th>Airport</th><th>Code</th><th>On-time %</th></tr>
              </thead>
              <tbody>
                {airports.map(a => {
                  const score = a.onTimePct != null ? Math.round(a.onTimePct) : null
                  return (
                    <tr key={a.rank}>
                      <td>{a.rank}</td>
                      <td>{a.name}</td>
                      <td><code>{a.code}</code></td>
                      <td>{a.onTimePct != null ? `${a.onTimePct}%` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
