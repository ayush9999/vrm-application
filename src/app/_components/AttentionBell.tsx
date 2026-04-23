'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { AttentionItem } from '@/lib/db/dashboard'

interface Props {
  items: AttentionItem[]
}

const BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  red: { bg: '#FCEBEB', color: '#A32D2D' },
  amber: { bg: '#FAEEDA', color: '#854F0B' },
  blue: { bg: '#E6F1FB', color: '#185FA5' },
}

const STORAGE_KEY = 'vrm.attentionBell.pos'
const BELL_SIZE = 38
const EDGE_PAD = 6
const DRAG_THRESHOLD = 3
const POPUP_WIDTH = 380

function defaultPosition(): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 0, y: 16 }
  return { x: window.innerWidth - BELL_SIZE - 20, y: 16 }
}

export function AttentionBell({ items }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const draggingRef = useRef(false)
  const hasMovedRef = useRef(false)
  const dragStartRef = useRef({ mx: 0, my: 0, bx: 0, by: 0 })

  // Real items only — filter out the 'empty' placeholder
  const realItems = items.filter((i) => i.type !== 'empty')
  const count = realItems.length
  const redCount = realItems.filter((i) => i.badgeStyle === 'red').length

  // Hydrate position on mount (after client-side to avoid SSR mismatch)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          setPosition(clampToViewport(parsed))
          return
        }
      }
    } catch {}
    setPosition(defaultPosition())
  }, [])

  // Reclamp on window resize so bell never strands off-screen
  useEffect(() => {
    const onResize = () => {
      setPosition((p) => (p ? clampToViewport(p) : p))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Global mouse handlers for drag lifecycle
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      const dx = e.clientX - dragStartRef.current.mx
      const dy = e.clientY - dragStartRef.current.my
      if (!hasMovedRef.current && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        hasMovedRef.current = true
        setIsOpen(false) // close popup on drag start
      }
      if (!hasMovedRef.current) return
      setPosition(
        clampToViewport({
          x: dragStartRef.current.bx + dx,
          y: dragStartRef.current.by + dy,
        }),
      )
    }
    const onUp = () => {
      if (!draggingRef.current) return
      draggingRef.current = false
      if (hasMovedRef.current) {
        // Persist latest position
        setPosition((p) => {
          if (p) {
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)) } catch {}
          }
          return p
        })
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!position) return
    draggingRef.current = true
    hasMovedRef.current = false
    dragStartRef.current = {
      mx: e.clientX,
      my: e.clientY,
      bx: position.x,
      by: position.y,
    }
    e.preventDefault()
  }

  const handleClick = () => {
    if (hasMovedRef.current) {
      // Was a drag, not a click — swallow
      hasMovedRef.current = false
      return
    }
    setIsOpen((v) => !v)
  }

  // SSR and first client paint: render nothing (position unknown).
  // useEffect fills position on mount and the bell flashes in.
  if (!position) return null

  // Popup anchor: extend rightward if bell is on the left half, leftward otherwise
  const isBellOnLeftHalf = position.x + BELL_SIZE / 2 < window.innerWidth / 2

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 60,
      }}
    >
      <button
        type="button"
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        className="relative flex items-center justify-center rounded-full transition-all hover:shadow-md"
        style={{
          width: BELL_SIZE,
          height: BELL_SIZE,
          background: 'white',
          border: '1px solid rgba(109,93,211,0.12)',
          boxShadow: '0 2px 8px rgba(30,21,80,0.06)',
          cursor: draggingRef.current && hasMovedRef.current ? 'grabbing' : 'grab',
        }}
        aria-label="Attention center (drag to move)"
        title="Drag to move · click to open"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#4a4270" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 2a6 6 0 016 6v4l2 2H2l2-2V8a6 6 0 016-6z" />
          <path d="M8 17a2 2 0 004 0" />
        </svg>

        {count > 0 && (
          <span
            className="absolute flex items-center justify-center text-[9px] font-bold text-white rounded-full"
            style={{
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              background: redCount > 0 ? '#e11d48' : '#6c5dd3',
              boxShadow: '0 0 0 2px white',
            }}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen(false)
            }}
          />
          <div
            className="absolute rounded-2xl overflow-hidden z-50"
            style={{
              top: BELL_SIZE + 8,
              ...(isBellOnLeftHalf ? { left: 0 } : { right: 0 }),
              width: POPUP_WIDTH,
              maxHeight: 'calc(100vh - 80px)',
              background: 'white',
              border: '1px solid rgba(109,93,211,0.15)',
              boxShadow: '0 12px 32px rgba(30,21,80,0.15)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid rgba(109,93,211,0.08)', background: 'rgba(109,93,211,0.02)' }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e1550' }}>Attention Center</div>
                <div style={{ fontSize: 10.5, color: '#8b7fd4', marginTop: 1 }}>
                  {count === 0 ? 'All caught up' : `${count} item${count === 1 ? '' : 's'} need${count === 1 ? 's' : ''} your attention`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-sm hover:opacity-70"
                style={{ color: '#a99fd8' }}
              >
                ✕
              </button>
            </div>

            {/* List */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {realItems.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div
                    className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                    style={{ background: 'rgba(5,150,105,0.08)' }}
                  >
                    <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 8.5l3.5 3.5 6.5-8" />
                    </svg>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1e1550' }}>All caught up</div>
                  <div style={{ fontSize: 11, color: '#8b7fd4', marginTop: 4 }}>
                    No items need your attention right now
                  </div>
                </div>
              ) : (
                realItems.map((item, i) => {
                  const badge = BADGE_STYLES[item.badgeStyle] ?? BADGE_STYLES.blue
                  const inner = (
                    <div
                      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[rgba(109,93,211,0.02)]"
                      style={{
                        borderBottom: i < realItems.length - 1 ? '1px solid rgba(109,93,211,0.06)' : 'none',
                        cursor: item.href ? 'pointer' : 'default',
                      }}
                    >
                      <div style={{ width: 2, height: 34, borderRadius: 1, background: item.lineColor, flexShrink: 0, marginTop: 2 }} />
                      <div className="flex-1 min-w-0">
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: '#1e1550', lineHeight: 1.35 }}>
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div
                            style={{
                              fontSize: 11,
                              color: '#8b7fd4',
                              marginTop: 3,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                      {item.badgeLabel && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 600,
                            padding: '3px 7px',
                            borderRadius: 20,
                            background: badge.bg,
                            color: badge.color,
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                          }}
                        >
                          {item.badgeLabel}
                        </span>
                      )}
                    </div>
                  )

                  if (item.href) {
                    return (
                      <Link
                        key={`${item.type}-${i}`}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className="block"
                      >
                        {inner}
                      </Link>
                    )
                  }
                  return <div key={`${item.type}-${i}`}>{inner}</div>
                })
              )}
            </div>

            {/* Footer */}
            {realItems.length > 0 && (
              <div
                className="px-4 py-2.5"
                style={{ borderTop: '1px solid rgba(109,93,211,0.08)', background: 'rgba(109,93,211,0.02)' }}
              >
                <Link
                  href="/attention"
                  onClick={() => setIsOpen(false)}
                  className="text-xs font-medium"
                  style={{ color: '#6c5dd3' }}
                >
                  Open Attention Center →
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function clampToViewport(p: { x: number; y: number }): { x: number; y: number } {
  if (typeof window === 'undefined') return p
  const maxX = window.innerWidth - BELL_SIZE - EDGE_PAD
  const maxY = window.innerHeight - BELL_SIZE - EDGE_PAD
  return {
    x: Math.max(EDGE_PAD, Math.min(maxX, p.x)),
    y: Math.max(EDGE_PAD, Math.min(maxY, p.y)),
  }
}
