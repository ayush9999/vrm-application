'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function DateButton() {
  const [open, setOpen] = useState(false)
  const [today, setToday] = useState<Date | null>(null)
  const [viewMonth, setViewMonth] = useState<{ year: number; month: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // Hydrate today on mount (avoid SSR mismatch on date strings)
  useEffect(() => {
    const t = startOfDay(new Date())
    setToday(t)
    setViewMonth({ year: t.getFullYear(), month: t.getMonth() })
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const cells = useMemo(() => {
    if (!viewMonth) return [] as { date: Date; inMonth: boolean }[]
    const { year, month } = viewMonth
    const firstOfMonth = new Date(year, month, 1)
    // Monday = 0 in our grid
    const jsWeekday = firstOfMonth.getDay() // 0=Sun..6=Sat
    const monStart = (jsWeekday + 6) % 7
    const gridStart = new Date(year, month, 1 - monStart)
    const out: { date: Date; inMonth: boolean }[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      out.push({ date: d, inMonth: d.getMonth() === month })
    }
    return out
  }, [viewMonth])

  if (!today || !viewMonth) {
    // SSR / pre-mount placeholder — keeps layout stable
    return <div style={{ fontSize: 12, color: '#6e6a5e', marginTop: 2, height: 18 }} />
  }

  const labelText = today.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const goPrev = () => setViewMonth(({ year, month }) => {
    const m = month - 1
    return m < 0 ? { year: year - 1, month: 11 } : { year, month: m }
  })
  const goNext = () => setViewMonth(({ year, month }) => {
    const m = month + 1
    return m > 11 ? { year: year + 1, month: 0 } : { year, month: m }
  })
  const goToday = () => setViewMonth({ year: today.getFullYear(), month: today.getMonth() })

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 transition-colors hover:text-[#6c5dd3]"
        style={{ fontSize: 12, color: '#6e6a5e', marginTop: 2, padding: 0, background: 'transparent', border: 0, cursor: 'pointer' }}
        aria-label="Open calendar"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="12" height="11" rx="1.5" />
          <path d="M2 6h12M5 1.5v3M11 1.5v3" />
        </svg>
        <span>{labelText}</span>
      </button>

      {open && (
        <div
          className="absolute z-50 mt-2 rounded-2xl"
          style={{
            top: '100%',
            left: 0,
            width: 280,
            background: 'white',
            border: '1px solid rgba(108,93,211,0.18)',
            boxShadow: '0 12px 32px rgba(30,21,80,0.15)',
            padding: 12,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={goPrev}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[rgba(108,93,211,0.06)]"
              style={{ color: '#6c5dd3' }}
              aria-label="Previous month"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 4l-4 4 4 4" />
              </svg>
            </button>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold" style={{ color: '#1e1550' }}>
                {MONTH_NAMES[viewMonth.month]}
              </span>
              <span className="text-sm" style={{ color: '#5d5285' }}>
                {viewMonth.year}
              </span>
            </div>
            <button
              type="button"
              onClick={goNext}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[rgba(108,93,211,0.06)]"
              style={{ color: '#6c5dd3' }}
              aria-label="Next month"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 4l4 4-4 4" />
              </svg>
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center" style={{ fontSize: 12, color: '#6b5fa8', fontWeight: 600, paddingTop: 4, paddingBottom: 4 }}>
                {w[0]}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map(({ date, inMonth }) => {
              const isToday = isSameDay(date, today)
              return (
                <div
                  key={date.toISOString()}
                  className="flex items-center justify-center rounded-lg"
                  style={{
                    height: 32,
                    fontSize: 13,
                    fontWeight: isToday ? 600 : 400,
                    color: isToday ? 'white' : inMonth ? '#1e1550' : '#d4cdef',
                    background: isToday ? '#6c5dd3' : 'transparent',
                  }}
                >
                  {date.getDate()}
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-2.5" style={{ borderTop: '1px solid rgba(108,93,211,0.08)' }}>
            <span style={{ fontSize: 12, color: '#6b5fa8' }}>
              Today · {today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
            <button
              type="button"
              onClick={goToday}
              className="text-xs font-medium px-2.5 py-1 rounded-full hover:opacity-80"
              style={{ background: 'rgba(108,93,211,0.08)', color: '#6c5dd3' }}
            >
              Jump to today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
