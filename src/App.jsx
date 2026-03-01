import { useState, useEffect, useMemo } from 'react'
import { processRoutes, getGrade } from './data/routes'
import RouteCard from './components/RouteCard'
import RouteDetail from './components/RouteDetail'
import Header from './components/Header'
import './App.css'

const DATA_BASE = '/data'

function App() {
  const [airlines, setAirlines] = useState([])
  const [airports, setAirports] = useState([])
  const [rawRoutes, setRawRoutes] = useState([])
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

  useEffect(() => {
    Promise.all([
      fetch(`${DATA_BASE}/airlines.json`).then(r => r.ok ? r.json() : []),
      fetch(`${DATA_BASE}/airports.json`).then(r => r.ok ? r.json() : []),
      fetch(`${DATA_BASE}/routes.json`).then(r => r.ok ? r.json() : []),
      fetch(`${DATA_BASE}/periodOptions.json`).then(r => r.ok ? r.json() : [])
    ])
      .then(([a, b, c, p]) => {
        setAirlines(Array.isArray(a) ? a : [])
        setAirports(Array.isArray(b) ? b : [])
        setRawRoutes(Array.isArray(c) ? c : [])
        setPeriodOptions(Array.isArray(p) ? p : [])
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
    let list = rawRoutes
    if (filterFrom) list = list.filter(r => r.fromCode === filterFrom)
    if (filterTo) list = list.filter(r => r.toCode === filterTo)
    if (filterAirline && list.length > 0 && list[0].carrier != null) {
      list = list.filter(r => r.carrier === filterAirline)
    }
    if (period && period.year && period.month) {
      list = list.filter(r =>
        r.periods && r.periods.some(p => p.year === period.year && p.month === period.month)
      )
    }
    return list
  }, [rawRoutes, filterFrom, filterTo, filterAirline, period])

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

  if (loading) {
    return (
      <div className="app">
        <Header />
        <main className="main"><p className="empty">加载数据中…</p></main>
      </div>
    )
  }
  if (error) {
    return (
      <div className="app">
        <Header />
        <main className="main"><p className="empty">加载失败：{error}。请先运行 <code>node scripts/build-data.cjs</code> 生成 data 文件。</p></main>
      </div>
    )
  }

  return (
    <div className="app">
      <Header />
      <main className="main">
        <nav className="tabs">
          <button type="button" className={tab === 'routes' ? 'active' : ''} onClick={() => setTab('routes')}>航线准点评分</button>
          <button type="button" className={tab === 'airlines' ? 'active' : ''} onClick={() => setTab('airlines')}>航司准点排名</button>
          <button type="button" className={tab === 'airports' ? 'active' : ''} onClick={() => setTab('airports')}>机场准点排名</button>
        </nav>

        {tab === 'routes' && (
          <>
            <section className="controls">
              <div className="filters">
                <label className="filter-group">
                  <span className="filter-label">时间</span>
                  <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
                    <option value="">全部</option>
                    {periodOptions.map(opt => (
                      <option key={opt.year + '-' + opt.month} value={opt.year + '-' + opt.month}>{opt.label}</option>
                    ))}
                  </select>
                  {periodOptions.length <= 1 && (
                    <span className="filter-hint">选项来自数据中的年-月，当前 CSV 仅含上述月份</span>
                  )}
                </label>
                <label className="filter-group">
                  <span className="filter-label">航司</span>
                  <select value={filterAirline} onChange={e => setFilterAirline(e.target.value)}>
                    <option value="">全部</option>
                    {airlines.map(a => (
                      <option key={a.name} value={a.name}>{a.name}</option>
                    ))}
                  </select>
                  {rawRoutes.length > 0 && rawRoutes[0].carrier == null && (
                    <span className="filter-hint">（航线数据暂无航司字段，接入后生效）</span>
                  )}
                </label>
                <label className="filter-group">
                  <span className="filter-label">出发机场</span>
                  <select value={filterFrom} onChange={e => setFilterFrom(e.target.value)}>
                    <option value="">全部</option>
                    {airports.map(a => (
                      <option key={a.code} value={a.code}>{a.code} {a.name.replace(/\s*\([A-Z]{3}\)\s*$/, '')}</option>
                    ))}
                  </select>
                </label>
                <label className="filter-group">
                  <span className="filter-label">到达机场</span>
                  <select value={filterTo} onChange={e => setFilterTo(e.target.value)}>
                    <option value="">全部</option>
                    {airports.map(a => (
                      <option key={a.code} value={a.code}>{a.code} {a.name.replace(/\s*\([A-Z]{3}\)\s*$/, '')}</option>
                    ))}
                  </select>
                </label>
              </div>
              {periodOptions.length > 1 && (
                <p className="controls-note">
                  准点率为年度机场数据，不随月份变化；选择具体月份后，航班量显示当月数据，评分按当月航班量重新计算（当月权重更高）。
                </p>
              )}
              <div className="sort-row">
                <span className="sort-label">排序：</span>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="score">综合评分</option>
                  <option value="onTimePct">准点率</option>
                  <option value="delayRate">延误率</option>
                  <option value="flightCount">航班量</option>
                </select>
                <button type="button" className="order-btn" onClick={() => setOrder(o => (o === 'desc' ? 'asc' : 'desc'))}>
                  {order === 'desc' ? '从高到低' : '从低到高'}
                </button>
              </div>
            </section>
            <div className="content">
              <div className="route-list">
                {filteredAndSorted.map(route => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    isSelected={selectedId === route.id}
                    onClick={() => setSelectedId(route.id)}
                  />
                ))}
                {filteredAndSorted.length === 0 && <p className="empty">当前筛选下没有航线</p>}
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
                <tr><th>排名</th><th>航司</th><th>准点率</th><th>等级</th></tr>
              </thead>
              <tbody>
                {airlines.map(a => {
                  const score = a.onTimePct != null ? Math.round(a.onTimePct) : null
                  const grade = getGrade(score)
                  return (
                    <tr key={a.rank}>
                      <td>{a.rank}</td>
                      <td>{a.name}</td>
                      <td>{a.onTimePct != null ? `${a.onTimePct}%` : '—'}</td>
                      <td><span style={{ color: grade.color }}>{grade.label}</span></td>
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
                <tr><th>排名</th><th>机场</th><th>代码</th><th>准点率</th><th>等级</th></tr>
              </thead>
              <tbody>
                {airports.map(a => {
                  const score = a.onTimePct != null ? Math.round(a.onTimePct) : null
                  const grade = getGrade(score)
                  return (
                    <tr key={a.rank}>
                      <td>{a.rank}</td>
                      <td>{a.name}</td>
                      <td><code>{a.code}</code></td>
                      <td>{a.onTimePct != null ? `${a.onTimePct}%` : '—'}</td>
                      <td><span style={{ color: grade.color }}>{grade.label}</span></td>
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
