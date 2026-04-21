'use client'

import { useState } from 'react'
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

export function AttentionBell({ items }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  // Real items only — filter out the 'empty' placeholder
  const realItems = items.filter((i) => i.type !== 'empty')
  const count = realItems.length

  const redCount = realItems.filter((i) => i.badgeStyle === 'red').length

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="relative flex items-center justify-center rounded-full transition-all hover:shadow-md"
        style={{
          width: 38,
          height: 38,
          background: 'white',
          border: '1px solid rgba(109,93,211,0.12)',
          boxShadow: '0 2px 8px rgba(30,21,80,0.06)',
        }}
        aria-label="Attention center"
        title="Attention center"
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
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            className="absolute rounded-2xl overflow-hidden z-50"
            style={{
              top: 46,
              right: 0,
              width: 380,
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
