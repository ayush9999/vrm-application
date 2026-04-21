'use client'

import { useState } from 'react'

interface Props {
  title: string
  children: React.ReactNode
}

export function InfoPopover({ title, children }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-4 h-4 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
        style={{ background: 'rgba(109,93,211,0.1)', color: '#6c5dd3' }}
        title="What is this?"
        aria-label="Information"
      >
        <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1 }}>?</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            className="absolute z-50 rounded-xl p-4 text-left"
            style={{
              top: 'calc(100% + 6px)',
              right: 0,
              width: 280,
              background: 'white',
              border: '1px solid rgba(109,93,211,0.15)',
              boxShadow: '0 8px 24px rgba(30,21,80,0.12)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div style={{ fontSize: 11, fontWeight: 600, color: '#1e1550', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {title}
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs hover:opacity-70"
                style={{ color: '#a99fd8' }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: 11.5, lineHeight: 1.5, color: '#4a4270' }}>
              {children}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
