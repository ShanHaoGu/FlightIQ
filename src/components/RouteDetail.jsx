import './RouteDetail.css'

export default function RouteDetail({ route, onClose }) {
  const { from, to, fromCode, toCode, carrierName, onTimePct, delayRate, cancelRate, flightCount, totalFlightCount, score, grade, scoreBreakdown } = route
  const count = flightCount ?? totalFlightCount
  const formulaText = scoreBreakdown?.length
    ? scoreBreakdown.map(b => `${b.name}×${(b.weight * 100).toFixed(0)}%`).join(' + ')
    : ''

  return (
    <aside className="detail">
      <div className="detail-header">
        <h2 className="detail-title">{fromCode || from} → {toCode || to}</h2>
        <button type="button" className="detail-close" onClick={onClose} aria-label="Close">×</button>
      </div>
      {(from || to) && (
        <p className="detail-airline">{from} → {to}</p>
      )}
      {carrierName && <p className="detail-carrier">Airline: {carrierName}</p>}
      {score != null && (
        <div className="detail-score-box">
          <span className="detail-score-num" style={{ color: grade?.color }}>{score}</span>
          <span className="detail-grade" style={{ color: grade?.color }}>{grade?.label}</span>
        </div>
      )}

      {scoreBreakdown && scoreBreakdown.length > 0 && (
        <div className="detail-section">
          <h3>Score breakdown</h3>
          {formulaText && (
            <p className="detail-formula">
              Score = {formulaText}
            </p>
          )}
          <ul className="breakdown-list">
            {scoreBreakdown.map((b, i) => (
              <li key={i} className="breakdown-item">
                <div className="breakdown-row">
                  <span className="breakdown-name">{b.name}</span>
                  <span className="breakdown-value">{b.value}{b.unit}</span>
                </div>
                <div className="breakdown-bar" role="presentation" aria-hidden>
                  <div className="breakdown-bar-fill" style={{ width: `${b.score != null ? b.score : 0}%` }} />
                </div>
                <div className="breakdown-desc">{b.desc}</div>
                <div className="breakdown-math">
                  Score {b.score} × weight {b.weight * 100}% = <strong>{b.contribution}</strong> pts
                </div>
              </li>
            ))}
          </ul>
          <div className="breakdown-total">
            Score = {scoreBreakdown.map(b => b.contribution).join(' + ')} ≈ <strong>{score}</strong> pts
          </div>
        </div>
      )}

      <div className="detail-section">
        <h3>Data</h3>
        <ul className="detail-facts">
          {onTimePct != null && <li>On-time: <strong>{onTimePct}%</strong></li>}
          {delayRate != null && <li>Delay rate (≥15 min): <strong>{delayRate}%</strong></li>}
          {cancelRate != null && <li>Cancellation rate: <strong>{cancelRate}%</strong></li>}
          {count != null && <li>Flights: <strong>{count}</strong> (selected month)</li>}
        </ul>
        <p className="detail-note">
          {route.carrier ? 'On-time, delay, and cancellation rates are from this airline on this route.' : 'On-time is from annual airport data.'} Flight count varies by selected month; score is recalculated with that month’s weight.
        </p>
      </div>
    </aside>
  )
}
