'use client'

import { useEffect, useState, useTransition, startTransition } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Thin branded loading bar that appears at the very top of the viewport
 * during Next.js route transitions. Shows immediately on click, hides
 * after navigation completes.
 *
 * Uses pathname change detection — no external libraries needed.
 */
export function NavigationProgress() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const [width, setWidth] = useState(0)

  // Detect navigation start by intercepting clicks on <a> elements.
  // When the user clicks a link that points to a different path,
  // show the bar immediately.
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) return
      // Don't trigger for same-page links
      if (href === pathname || href === pathname + '/') return
      setLoading(true)
      setWidth(20)
    }
    document.addEventListener('click', handleClick, { capture: true })
    return () => document.removeEventListener('click', handleClick, { capture: true })
  }, [pathname])

  // When pathname changes, animate to 100% then hide
  useEffect(() => {
    if (loading) {
      setWidth(100)
      const t = setTimeout(() => {
        setLoading(false)
        setWidth(0)
      }, 300)
      return () => clearTimeout(t)
    }
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Trickle animation: slowly widen while loading
  useEffect(() => {
    if (!loading || width >= 90) return
    const t = setInterval(() => {
      setWidth((w) => Math.min(w + Math.random() * 8, 90))
    }, 400)
    return () => clearInterval(t)
  }, [loading, width])

  if (!loading && width === 0) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 h-[2.5px] pointer-events-none"
      style={{ background: 'transparent' }}
    >
      <div
        className="h-full rounded-r-full"
        style={{
          width: `${width}%`,
          background: 'linear-gradient(90deg, #6c5dd3, #7c6be0, #a78bfa)',
          transition: width === 0 ? 'none' : 'width 0.3s ease-out',
          boxShadow: '0 0 8px rgba(108,93,211,0.5)',
        }}
      />
    </div>
  )
}
