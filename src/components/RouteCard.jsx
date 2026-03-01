import './RouteCard.css'

export default function RouteCard({ route, isSelected, onClick }) {
  const { fromCode, toCode, from, to, score, grade, delayRate, onTimePct, flightCount } = route

  return (
    <article
      className={`route-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      <div className="route-card-head">
        <span className="route-name">{fromCode || from} → {toCode || to}</span>
        {score != null && (
          <span className="route-score" style={{ color: grade?.color }}>{score}</span>
        )}
      </div>
      {(from || to) && (from !== fromCode || to !== toCode) && (
        <div className="route-card-meta">{from} → {to}</div>
      )}
      {route.carrierName && (
        <div className="route-card-meta route-carrier">{route.carrierName}</div>
      )}
      <div className="route-card-metrics">
        {onTimePct != null && <span>On-time {onTimePct}%</span>}
        {delayRate != null && <span>Delay {delayRate}%</span>}
        {flightCount != null && <span>Flights {flightCount}</span>}
      </div>
    </article>
  )
}
