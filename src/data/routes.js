/**
 * 航线评分逻辑（多因素 + 评分构成）
 * 因素：准点率、航班量等级、月度稳定性（各月航班量波动，用于预测评分）
 */

export const WEIGHTS = {
  onTimePct: 0.6,
  flightVolume: 0.2,
  monthlyStability: 0.2
}

/** 选择具体月份时提高当月航班量权重，使评分随月份明显变化 */
export const WEIGHTS_BY_MONTH = {
  onTimePct: 0.5,
  flightVolume: 0.35,
  monthlyStability: 0.15
}

/** 根据各月航班量波动计算稳定性得分 0–100（波动越小越稳定，得分越高） */
function monthlyStabilityScore(periods) {
  if (!Array.isArray(periods) || periods.length < 2) return null
  const counts = periods.map(p => p.flightCount).filter(n => n != null)
  if (counts.length < 2) return null
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length
  const variance = counts.reduce((s, n) => s + (n - mean) ** 2, 0) / counts.length
  const std = Math.sqrt(variance)
  const cv = mean === 0 ? 1 : std / mean
  const score = Math.round(100 - Math.min(100, cv * 150))
  return Math.max(0, score)
}

/** 根据航班量在全体中的分位计算 0–100 分（航班越多越稳定，得分越高） */
function flightVolumeScore(flightCount, allCounts) {
  if (flightCount == null || !Array.isArray(allCounts) || allCounts.length === 0) return null
  const sorted = [...allCounts].filter(n => n != null).sort((a, b) => b - a)
  if (sorted.length === 0) return null
  const rank = sorted.indexOf(flightCount)
  const percentile = rank < 0 ? 0.5 : 1 - rank / sorted.length
  return Math.round(20 + percentile * 80)
}

/** 准点率直接作为 0–100 分 */
function onTimeScore(onTimePct) {
  if (onTimePct == null) return null
  return Math.round(Math.min(100, Math.max(0, onTimePct)))
}

/**
 * 计算综合分与评分构成
 * @param {Object} route - 含 onTimePct, flightCount 或 totalFlightCount
 * @param {number[]} [allFlightCounts] - 当前列表下所有航线的航班量，用于航班量得分分位
 * @param {boolean} [byMonth] - 是否按所选月份计分（提高当月航班量权重，评分随月份变化）
 */
export function calcScore(route, allFlightCounts = [], byMonth = false) {
  const onTime = onTimeScore(route.onTimePct)
  const flightCount = route.flightCount != null ? route.flightCount : route.totalFlightCount
  const flight = flightVolumeScore(flightCount, allFlightCounts)
  const stability = monthlyStabilityScore(route.periods || [])
  const hasOnTime = onTime != null
  const hasFlight = flight != null
  const hasStability = stability != null
  if (!hasOnTime && !hasFlight && !hasStability) return { score: null, grade: getGrade(null), breakdown: null }
  const w = byMonth ? WEIGHTS_BY_MONTH : WEIGHTS
  let total = 0
  let totalWeight = 0
  const breakdown = []
  if (hasOnTime) {
    total += onTime * w.onTimePct
    totalWeight += w.onTimePct
    breakdown.push({
      name: '准点率',
      value: route.onTimePct,
      unit: '%',
      score: onTime,
      weight: w.onTimePct,
      contribution: Math.round(onTime * w.onTimePct * 10) / 10,
      desc: '起降机场准点率平均值，越高越好'
    })
  }
  if (hasFlight) {
    total += flight * w.flightVolume
    totalWeight += w.flightVolume
    const tier = flight >= 80 ? '高' : flight >= 50 ? '中' : '低'
    breakdown.push({
      name: '航班量',
      value: flightCount,
      unit: '班',
      score: flight,
      weight: w.flightVolume,
      contribution: Math.round(flight * w.flightVolume * 10) / 10,
      desc: `航班量等级：${tier}（当前筛选周期）`
    })
  }
  if (hasStability) {
    total += stability * w.monthlyStability
    totalWeight += w.monthlyStability
    const tier = stability >= 80 ? '高' : stability >= 50 ? '中' : '低'
    breakdown.push({
      name: '月度稳定性',
      value: (route.periods || []).length,
      unit: '个月',
      score: stability,
      weight: w.monthlyStability,
      contribution: Math.round(stability * w.monthlyStability * 10) / 10,
      desc: `各月航班量波动：${tier}（基于 1–12 月历史，波动小更易预测）`
    })
  }
  const score = totalWeight > 0 ? Math.round(total / totalWeight) : null
  return {
    score: score != null ? Math.min(100, Math.max(0, score)) : null,
    grade: getGrade(score),
    breakdown
  }
}

/** 根据分数返回等级 */
export function getGrade(score) {
  if (score == null) return { label: '—', color: 'var(--text-muted)' }
  if (score >= 85) return { label: '优秀', color: 'var(--good)' }
  if (score >= 70) return { label: '良好', color: 'var(--accent)' }
  if (score >= 55) return { label: '一般', color: 'var(--warn)' }
  return { label: '较差', color: 'var(--bad)' }
}

/**
 * 为航线列表附加 score、grade、scoreBreakdown
 * @param {Object[]} rawList
 * @param {Object} [period] - { year, month } 筛选周期，用于取该周期航班量；有值时评分按「当月」权重计算
 */
export function processRoutes(rawList, period = null) {
  if (!Array.isArray(rawList) || rawList.length === 0) return []
  const byMonth = !!(period && period.year && period.month)
  const withFlightCount = rawList.map(r => {
    let flightCount = r.totalFlightCount ?? r.flightCount
    if (period && r.periods && r.periods.length) {
      const p = r.periods.find(x => x.year === period.year && x.month === period.month)
      if (p) flightCount = p.flightCount
    }
    return { ...r, flightCount }
  })
  const allCounts = withFlightCount.map(r => r.flightCount)
  return withFlightCount.map((r, i) => {
    const item = { ...r, id: r.id || `route-${i + 1}` }
    const result = calcScore(item, allCounts, byMonth)
    item.score = result.score
    item.grade = result.grade
    item.scoreBreakdown = result.breakdown
    return item
  })
}
