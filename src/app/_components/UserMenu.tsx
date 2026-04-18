'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { signOutAction } from '@/app/auth/actions'

interface UserMenuProps {
  email: string | null
  name: string | null
  orgName: string | null
}

export function UserMenu({ email, name, orgName }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', onClickOutside)
      return () => document.removeEventListener('mousedown', onClickOutside)
    }
  }, [open])

  const displayName = name?.trim() || email?.split('@')[0] || 'User'
  const initials =
    (name?.trim()?.[0] || email?.[0] || 'U').toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-all"
        style={{
          background: open ? 'rgba(108,93,211,0.18)' : 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
        >
          {initials}
        </span>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-semibold text-white truncate">{displayName}</p>
          {orgName && <p className="text-[10px] text-white/50 truncate">{orgName}</p>}
        </div>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/50 shrink-0">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 bottom-full mb-2 rounded-xl overflow-hidden shadow-xl"
          style={{ background: '#1c1c2e', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-xs font-semibold text-white truncate">{displayName}</p>
            {email && <p className="text-[10px] text-white/50 truncate mt-0.5">{email}</p>}
          </div>

          <div className="py-1">
            <Link
              href="/settings/members"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs text-white/80 hover:bg-white/5 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="5" r="2.5" />
                <path d="M2 13c0-2.2 1.8-4 4-4s4 1.8 4 4" />
                <circle cx="11.5" cy="5.5" r="2" />
                <path d="M14 13c0-1.7-1.1-3-2.5-3" />
              </svg>
              Members
            </Link>
            <Link
              href="/settings/members"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs text-white/80 hover:bg-white/5 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="2.5" />
                <path d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5" />
              </svg>
              Administration
            </Link>
          </div>

          <form action={signOutAction} style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <button
              type="submit"
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-rose-300 hover:bg-rose-500/10 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3" />
                <path d="M11 11l3-3-3-3M14 8H6" />
              </svg>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
