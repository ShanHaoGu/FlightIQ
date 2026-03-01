import './RouteDetail.css'

export default function RouteDetail({ route, onClose }) {
  const { from, to, fromCode, toCode, onTimePct, delayRate, flightCount, totalFlightCount, score, grade, scoreBreakdown } = route
  const count = flightCount ?? totalFlightCount
  const formulaText = scoreBreakdown?.length
    ? scoreBreakdown.map(b => `${b.name}×${(b.weight * 100).toFixed(0)}%`).join(' + ')
    : ''

  return (
    <aside className="detail">
      <div className="detail-header">
        <h2 className="detail-title">{fromCode || from} → {toCode || to}</h2>
        <button type="button" className="detail-close" onClick={onClose} aria-label="关闭">×</button>
      </div>
      {(from || to) && (
        <p className="detail-airline">{from} → {to}</p>
      )}
      {score != null && (
        <div className="detail-score-box">
          <span className="detail-score-num" style={{ color: grade?.color }}>{score}</span>
          <span className="detail-grade" style={{ color: grade?.color }}>{grade?.label}</span>
        </div>
      )}

      {scoreBreakdown && scoreBreakdown.length > 0 && (
        <div className="detail-section">
          <h3>评分构成</h3>
          {formulaText && (
            <p className="detail-formula">
              综合分 = {formulaText}
            </p>
          )}
          <ul className="breakdown-list">
            {scoreBreakdown.map((b, i) => (
              <li key={i} className="breakdown-item">
                <div className="breakdown-row">
                  <span className="breakdown-name">{b.name}</span>
                  <span className="breakdown-value">{b.value}{b.unit}</span>
                </div>
                <div className="breakdown-desc">{b.desc}</div>
                <div className="breakdown-math">
                  得分 {b.score} × 权重 {b.weight * 100}% = <strong>{b.contribution}</strong> 分
                </div>
              </li>
            ))}
          </ul>
          <div className="breakdown-total">
            综合分 = {scoreBreakdown.map(b => b.contribution).join(' + ')} ≈ <strong>{score}</strong> 分
          </div>
        </div>
      )}

      <div className="detail-section">
        <h3>数据说明</h3>
        <ul className="detail-facts">
          {onTimePct != null && <li>准点率：<strong>{onTimePct}%</strong>（年度机场数据，不随所选月份变化）</li>}
          {delayRate != null && <li>延误率：<strong>{delayRate}%</strong></li>}
          {count != null && <li>航班量：<strong>{count}</strong> 班（当前所选月份）</li>}
        </ul>
        <p className="detail-note">
          准点率来自 Table 4 年度机场数据，不随月份变化。航班量随所选月份变化；选择某月后评分会按当月航班量重新计算（当月航班量权重更高）。
        </p>
      </div>
    </aside>
  )
}
