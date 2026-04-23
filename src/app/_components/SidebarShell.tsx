'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { SidebarNav } from './SidebarNav'
import { UserMenu } from './UserMenu'
import { AttentionBell } from './AttentionBell'
import type { AttentionItem } from '@/lib/db/dashboard'

const PUBLIC_PATH_PREFIXES = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/auth/',
  '/invite/',
]

interface SidebarShellProps {
  children: React.ReactNode
  user: { email: string | null; name: string | null; orgName: string | null } | null
  attentionItems?: AttentionItem[]
}

export function SidebarShell({ children, user, attentionItems = [] }: SidebarShellProps) {
  const pathname = usePathname()
  const isPublicPage = PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix),
  )

  if (isPublicPage || !user) {
    // Auth/public pages render bare — no sidebar.
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className="w-56 shrink-0 flex flex-col relative overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #17172a 0%, #111120 35%, #0d0d18 100%)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
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

        {/* Logo */}
        <div className="relative h-14 flex items-center px-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <Link href="/" className="flex items-center gap-2.5">
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                boxShadow: '0 0 16px rgba(99,102,241,0.5), 0 0 0 1px rgba(99,102,241,0.3)',
              }}
            >
              VRM
            </span>
            <span className="font-semibold text-white text-sm tracking-tight">Vendor Risk</span>
          </Link>
        </div>

        {/* Nav */}
        <SidebarNav />

        {/* Footer: user menu */}
        <div className="relative p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <UserMenu email={user.email} name={user.name} orgName={user.orgName} />
        </div>
      </aside>

      {/* Main content — aurora + dot grid */}
      <main
        className="flex-1 flex flex-col overflow-hidden"
        style={{
          backgroundColor: '#ecedf2',
          backgroundImage: [
            'radial-gradient(ellipse 60% 45% at 80% 0%, rgba(99,102,241,0.055) 0%, transparent 65%)',
            'radial-gradient(rgba(0,0,0,0.028) 1.5px, transparent 1.5px)',
          ].join(', '),
          backgroundSize: 'auto, 20px 20px',
        }}
      >
        {/* Scrollable content area */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>

      {/* Draggable attention bell — fixed to viewport, defaults to top-right */}
      <AttentionBell items={attentionItems} />
    </div>
  )
}
