import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export default function CountUpScore({ value, color, glow, isHovered, className }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (value == null) return
    const end = Math.round(value)
    const duration = 800
    const startTime = performance.now()

    const tick = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(end * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value])

  const glowStyle = glow === 'cyan'
    ? { filter: 'drop-shadow(0 0 12px rgba(34, 211, 238, 0.7)) drop-shadow(0 0 24px rgba(34, 211, 238, 0.4))' }
    : glow === 'amber'
      ? { filter: 'drop-shadow(0 0 12px rgba(245, 158, 11, 0.7)) drop-shadow(0 0 24px rgba(245, 158, 11, 0.4))' }
      : {}

  return (
    <motion.span
      className={className}
      style={{ color, ...glowStyle }}
      animate={{ scale: isHovered ? 1.2 : 1 }}
      transition={{ type: 'spring', damping: 10, stiffness: 100 }}
    >
      {display}
    </motion.span>
  )
}
