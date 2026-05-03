'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { SidebarNav } from './SidebarNav'
import { UserMenu } from './UserMenu'
import type { AttentionItem } from '@/lib/db/dashboard'

const PUBLIC_PATH_PREFIXES = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/auth/',
  '/invite/',
]

const STORAGE_KEY = 'vrm.sidebar.collapsed'

interface SidebarShellProps {
  children: React.ReactNode
  user: { email: string | null; name: string | null; orgName: string | null } | null
  attentionItems?: AttentionItem[]
}

export function SidebarShell({ children, user }: SidebarShellProps) {
  const pathname = usePathname()
  const isPublicPage = PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix),
  )

  // Collapsed state: hydrate from localStorage on mount.
  // Server / first paint defaults to expanded to avoid hydration mismatch.
  const [collapsed, setCollapsed] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw === '1') setCollapsed(true)
    } catch {}
    setHydrated(true)
  }, [])

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }

  if (isPublicPage || !user) {
    // Auth/public pages render bare — no sidebar.
    return <>{children}</>
  }

  const sidebarWidth = collapsed ? 64 : 224

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className="shrink-0 flex flex-col relative overflow-hidden"
        style={{
          width: sidebarWidth,
          background: 'linear-gradient(180deg, #17172a 0%, #111120 35%, #0d0d18 100%)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          transition: hydrated ? 'width 220ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
        }}
      >
        {/* Subtle ambient glow */}
        <div
          className="pointer-events-none absolute top-0 left-0 right-0"
          style={{
            height: '180px',
            background: 'radial-gradient(ellipse 100% 50% at 50% 0%, rgba(99,102,241,0.1) 0%, transparent 70%)',
          }}
        />

        {/* Logo + collapse toggle */}
        <div
          className="relative h-14 flex items-center justify-between px-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <Link href="/" className="flex items-center gap-2.5 min-w-0" aria-label="Home">
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold tracking-tight shrink-0"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                boxShadow: '0 0 16px rgba(99,102,241,0.5), 0 0 0 1px rgba(99,102,241,0.3)',
              }}
            >
              VRM
            </span>
            {!collapsed && (
              <span className="font-semibold text-white text-sm tracking-tight truncate">Vendor Risk</span>
            )}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={toggle}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/8"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="12" height="10" rx="1.5" />
                <line x1="6" y1="3" x2="6" y2="13" />
                <path d="M11 6l-2 2 2 2" />
              </svg>
            </button>
          )}
        </div>

        {/* When collapsed, the toggle moves into the nav area to keep the icon centered */}
        {collapsed && (
          <div className="relative px-2 pt-2">
            <button
              type="button"
              onClick={toggle}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="w-full h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-white/8"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="12" height="10" rx="1.5" />
                <line x1="6" y1="3" x2="6" y2="13" />
                <path d="M9 6l2 2-2 2" />
              </svg>
            </button>
          </div>
        )}

        {/* Nav */}
        <SidebarNav collapsed={collapsed} />

        {/* Footer: user menu */}
        <div className="relative p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <UserMenu email={user.email} name={user.name} orgName={user.orgName} collapsed={collapsed} />
        </div>
      </aside>

      {/* Main content — aurora + dot grid */}
      <main
        ref={mainRef}
        onMouseMove={(e) => {
          if (!mainRef.current) return
          const rect = mainRef.current.getBoundingClientRect()
          mainRef.current.style.setProperty('--mx', `${e.clientX - rect.left}px`)
          mainRef.current.style.setProperty('--my', `${e.clientY - rect.top}px`)
        }}
        onMouseLeave={() => {
          if (!mainRef.current) return
          mainRef.current.style.setProperty('--mx', `-9999px`)
          mainRef.current.style.setProperty('--my', `-9999px`)
        }}
        className="flex-1 flex flex-col overflow-hidden relative dot-drift"
        style={{
          backgroundColor: '#ecedf2',
          backgroundImage: [
            'radial-gradient(ellipse 60% 45% at 80% 0%, rgba(99,102,241,0.055) 0%, transparent 65%)',
            'radial-gradient(rgba(108,93,211,0.09) 1.5px, transparent 1.5px)',
          ].join(', '),
          backgroundSize: 'auto, 20px 20px',
        }}
      >
        {/* Cursor spotlight — brighter dots near the pointer */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(rgba(108,93,211,0.42) 3px, transparent 3px)',
            backgroundSize: '20px 20px',
            WebkitMaskImage:
              'radial-gradient(circle 120px at var(--mx, -9999px) var(--my, -9999px), black 0%, rgba(0,0,0,0.5) 45%, transparent 85%)',
            maskImage:
              'radial-gradient(circle 120px at var(--mx, -9999px) var(--my, -9999px), black 0%, rgba(0,0,0,0.5) 45%, transparent 85%)',
            transition: 'opacity 200ms ease',
          }}
        />

        {/* Scrollable content area */}
        <div className="flex-1 overflow-auto relative">
          {children}
        </div>
      </main>
    </div>
  )
}
