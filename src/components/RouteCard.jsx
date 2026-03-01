import { useState, useRef, memo } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import CountUpScore from './CountUpScore'
import './RouteCard.css'

function RouteCard({ route, isSelected, onClick, index = 0 }) {
  const { fromCode, toCode, from, to, score, grade, delayRate, onTimePct, flightCount } = route
  const [isHovered, setIsHovered] = useState(false)
  const cardRef = useRef(null)

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotateX = useSpring(y, { damping: 25, stiffness: 200 })
  const rotateY = useSpring(x, { damping: 25, stiffness: 200 })

  const handleMouseMove = (e) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const mx = (e.clientX - cx) / rect.width
    const my = (e.clientY - cy) / rect.height
    x.set(mx * 12)
    y.set(-my * 12)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
    setIsHovered(false)
  }

  const glow = score != null ? (score >= 80 ? 'cyan' : score < 60 ? 'amber' : null) : null

  return (
    <motion.article
      ref={cardRef}
      className={`route-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 1000
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        damping: 20,
        stiffness: 200,
        delay: Math.min(index * 0.04, 0.8)
      }}
    >
      <div className="route-card-glare" data-hover={isHovered} />
      <div className="route-card-head">
        <span className="route-name">{fromCode || from} → {toCode || to}</span>
        {score != null && (
          <CountUpScore
            value={score}
            color={grade?.color}
            glow={glow}
            isHovered={isHovered}
            className="route-score"
          />
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
    </motion.article>
  )
}

export default memo(RouteCard)
