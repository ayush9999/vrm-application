'use client'

import { useEffect, useState } from 'react'

interface Props {
  value: number
  /** Total animation duration for a single digit wheel, in ms. Default 1200. */
  duration?: number
  /** Delay before the roll starts, in ms. Useful for staggering with the panel fade-in. Default 0. */
  delay?: number
  /** Add an extra full spin (0→9 once) before landing on the target digit. Default true. */
  spin?: boolean
}

/**
 * Slot-machine / odometer style number animation.
 *
 * Each digit slot is a vertical wheel of 0-9 (optionally with one extra full
 * spin) that slides up to land on its target digit. Right-most digits settle
 * last, giving the classic cascading roll-up feel.
 *
 * SSR-safe: renders the final value on the server / first paint, then takes
 * over on mount.
 */
export function AnimatedCounter({ value, duration = 1200, delay = 0, spin = true }: Props) {
  const [animated, setAnimated] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setReduced(true)
      return
    }
    const t = window.setTimeout(() => setAnimated(true), delay)
    return () => window.clearTimeout(t)
  }, [delay])

  const text = String(value)
  const digitCount = text.replace(/\D/g, '').length

  if (reduced) return <>{value}</>

  return (
    <span style={{ display: 'inline-flex', fontVariantNumeric: 'tabular-nums' }}>
      {(() => {
        // Right-most digit settles last (largest stagger), left-most first.
        let digitIndexFromRight = digitCount - 1
        return text.split('').map((ch, i) => {
          if (!/\d/.test(ch)) {
            return (
              <span key={i} style={{ display: 'inline-block' }}>
                {ch}
              </span>
            )
          }
          const stagger = digitIndexFromRight * 90
          digitIndexFromRight -= 1
          return (
            <DigitWheel
              key={i}
              target={parseInt(ch, 10)}
              animated={animated}
              duration={duration}
              stagger={stagger}
              spin={spin}
            />
          )
        })
      })()}
    </span>
  )
}

function DigitWheel({
  target,
  animated,
  duration,
  stagger,
  spin,
}: {
  target: number
  animated: boolean
  duration: number
  stagger: number
  spin: boolean
}) {
  // Each cell is exactly `1em` tall — derived from line-height — so translateY
  // values in `em` map cleanly to digit positions.
  const cells = spin ? [...Array(10).keys(), target] : [...Array(target + 1).keys()]
  const finalIndex = cells.length - 1
  const offset = animated ? -finalIndex : 0

  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        verticalAlign: 'baseline',
        lineHeight: '1em',
        height: '1em',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          display: 'block',
          transform: `translateY(${offset}em)`,
          transition: animated
            ? `transform ${duration}ms cubic-bezier(0.21, 1, 0.32, 1) ${stagger}ms`
            : 'none',
          willChange: 'transform',
        }}
      >
        {cells.map((n, i) => (
          <span key={i} style={{ display: 'block', height: '1em' }}>
            {n}
          </span>
        ))}
      </span>
    </span>
  )
}
