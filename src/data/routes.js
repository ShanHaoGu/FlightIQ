/**
 * Route scoring (multi-factor + breakdown).
 * Factors: on-time %, flight volume tier, monthly stability, baggage mishandled rate, fleet age (carrier-level).
 */

export const WEIGHTS = {
  onTimePct: 0.45,
  flightVolume: 0.18,
  monthlyStability: 0.12,
  baggageRate: 0.15,
  fleetAge: 0.1
}

/** When a specific month is selected, increase that month’s flight volume weight */
export const WEIGHTS_BY_MONTH = {
  onTimePct: 0.4,
  flightVolume: 0.28,
  monthlyStability: 0.08,
  baggageRate: 0.14,
  fleetAge: 0.1
}

/** Stability score 0–100 from monthly flight count variance (lower variance = higher score) */
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

/** Flight volume score 0–100 by percentile (more flights = higher score) */
function flightVolumeScore(flightCount, allCounts) {
  if (flightCount == null || !Array.isArray(allCounts) || allCounts.length === 0) return null
  const sorted = [...allCounts].filter(n => n != null).sort((a, b) => b - a)
  if (sorted.length === 0) return null
  const rank = sorted.indexOf(flightCount)
  const percentile = rank < 0 ? 0.5 : 1 - rank / sorted.length
  return Math.round(20 + percentile * 80)
}

/** On-time rate as 0–100 score */
function onTimeScore(onTimePct) {
  if (onTimePct == null) return null
  return Math.round(Math.min(100, Math.max(0, onTimePct)))
}

/** Baggage mishandled per 100: lower is better, scaled to 0–100 (gentler curve so scores are less harsh) */
function baggageScore(mishandledPer100) {
  if (mishandledPer100 == null || typeof mishandledPer100 !== 'number') return null
  const score = Math.round(100 - Math.min(100, mishandledPer100 * 60))
  return Math.max(0, score)
}

/** Fleet average age (years): lower is better; gentler curve so older fleets get higher scores */
function fleetAgeScore(avgAgeYears) {
  if (avgAgeYears == null || typeof avgAgeYears !== 'number' || avgAgeYears < 0) return null
  const score = Math.round(100 - Math.min(100, avgAgeYears * 3))
  return Math.max(0, score)
}

/**
 * Compute composite score and breakdown.
 * @param {Object} route - has onTimePct, flightCount or totalFlightCount
 * @param {number[]} [allFlightCounts] - all route flight counts for percentile
 * @param {boolean} [byMonth] - use month-weighted weights when a month is selected
 */
export function calcScore(route, allFlightCounts = [], byMonth = false) {
  const onTime = onTimeScore(route.onTimePct)
  const flightCount = route.flightCount != null ? route.flightCount : route.totalFlightCount
  const flight = flightVolumeScore(flightCount, allFlightCounts)
  const stability = monthlyStabilityScore(route.periods || [])
  const baggage = baggageScore(route.baggageMishandledPer100)
  const fleetAge = fleetAgeScore(route.fleetAgeYears)
  const hasOnTime = onTime != null
  const hasFlight = flight != null
  const hasStability = stability != null
  const hasBaggage = baggage != null
  const hasFleetAge = fleetAge != null
  if (!hasOnTime && !hasFlight && !hasStability && !hasBaggage && !hasFleetAge) return { score: null, grade: getGrade(null), breakdown: null }
  const w = byMonth ? WEIGHTS_BY_MONTH : WEIGHTS
  let total = 0
  let totalWeight = 0
  const breakdown = []
  if (hasOnTime) {
    total += onTime * w.onTimePct
    totalWeight += w.onTimePct
    breakdown.push({
      name: 'On-time %',
      value: route.onTimePct,
      unit: '%',
      score: onTime,
      weight: w.onTimePct,
      contribution: Math.round(onTime * w.onTimePct * 10) / 10,
      desc: route.carrier ? 'On-time rate for this airline on this route.' : 'Average on-time at origin/destination airports; higher is better.'
    })
  }
  if (hasFlight) {
    total += flight * w.flightVolume
    totalWeight += w.flightVolume
    const tier = flight >= 80 ? 'High' : flight >= 50 ? 'Medium' : 'Low'
    breakdown.push({
      name: 'Flight volume',
      value: flightCount,
      unit: ' flights',
      score: flight,
      weight: w.flightVolume,
      contribution: Math.round(flight * w.flightVolume * 10) / 10,
      desc: `Flight volume tier: ${tier} (current filter period).`
    })
  }
  if (hasStability) {
    total += stability * w.monthlyStability
    totalWeight += w.monthlyStability
    const tier = stability >= 80 ? 'High' : stability >= 50 ? 'Medium' : 'Low'
    breakdown.push({
      name: 'Monthly stability',
      value: (route.periods || []).length,
      unit: ' months',
      score: stability,
      weight: w.monthlyStability,
      contribution: Math.round(stability * w.monthlyStability * 10) / 10,
      desc: `Month-to-month flight volume variation: ${tier} (based on 1–12 month history; less variation = more predictable).`
    })
  }
  if (hasBaggage) {
    total += baggage * w.baggageRate
    totalWeight += w.baggageRate
    breakdown.push({
      name: 'Baggage mishandled',
      value: route.baggageMishandledPer100,
      unit: '/100 bags',
      score: baggage,
      weight: w.baggageRate,
      contribution: Math.round(baggage * w.baggageRate * 10) / 10,
      desc: 'Carrier-level: mishandled bags per 100 enplaned (DOT ATCR); lower is better.'
    })
  }
  if (hasFleetAge) {
    total += fleetAge * w.fleetAge
    totalWeight += w.fleetAge
    breakdown.push({
      name: 'Fleet age',
      value: route.fleetAgeYears,
      unit: ' yr',
      score: fleetAge,
      weight: w.fleetAge,
      contribution: Math.round(fleetAge * w.fleetAge * 10) / 10,
      desc: 'Carrier-level: average fleet age (BTS Form 41); lower age = higher score.'
    })
  }
  const score = totalWeight > 0 ? Math.round(total / totalWeight) : null
  return {
    score: score != null ? Math.min(100, Math.max(0, score)) : null,
    grade: getGrade(score),
    breakdown
  }
}

/** Grade: 85+ = Excellent; 80–84, 70–79, 60–69, <60 with distinct colors */
export function getGrade(score) {
  if (score == null) return { label: '—', color: 'var(--text-muted)' }
  if (score >= 85) return { label: 'Excellent', color: 'var(--score-excellent)' }
  if (score >= 80) return { label: 'Great', color: 'var(--score-great)' }
  if (score >= 70) return { label: 'Good', color: 'var(--score-good)' }
  if (score >= 60) return { label: 'Fair', color: 'var(--score-fair)' }
  return { label: 'Poor', color: 'var(--score-poor)' }
}

/**
 * Attach score, grade, scoreBreakdown to route list.
 * @param {Object[]} rawList
 * @param {Object} [period] - { year, month } for flight count; when set, scoring uses month-weighted weights.
 */
export function processRoutes(rawList, period = null) {
  if (!Array.isArray(rawList) || rawList.length === 0) return []
  const byMonth = !!(period && period.year && period.month)
  const withFlightCount = rawList.map(r => {
    let flightCount = r.totalFlightCount ?? r.flightCount
    let onTimePct = r.onTimePct
    let delayRate = r.delayRate
    let cancelRate = r.cancelRate
    if (period && r.periods && r.periods.length) {
      const p = r.periods.find(x => x.year === period.year && x.month === period.month)
      if (p) {
        flightCount = p.flightCount
        if (p.onTimePct != null) onTimePct = p.onTimePct
        if (p.delayRate != null) delayRate = p.delayRate
        if (p.cancelRate != null) cancelRate = p.cancelRate
      }
    }
    return { ...r, flightCount, onTimePct, delayRate, cancelRate }
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
