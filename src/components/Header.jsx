import { motion } from 'framer-motion'
import './Header.css'

const title = 'Route score'
const letters = title.split('')

export default function Header() {
  return (
    <header className="header">
      <h1 className="title">
        {letters.map((letter, i) => (
          <motion.span
            key={i}
            className="title-letter"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              type: 'spring',
              damping: 12,
              stiffness: 100,
              delay: i * 0.04
            }}
          >
            {letter === ' ' ? '\u00A0' : letter}
          </motion.span>
        ))}
      </h1>
      <motion.p
        className="subtitle"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 0.4 }}
      >
        BTS on-time data: airline rank, airport rank, route on-time score (2024)
      </motion.p>
    </header>
  )
}
