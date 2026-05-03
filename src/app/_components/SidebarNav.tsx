'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="1.5" y="9.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
    </svg>
  )
}

function IconVendors({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" />
      <path d="M1.5 5.5h13M5.5 5.5v9" />
    </svg>
  )
}

function IconReviews({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 1.5h7l3 3v10a1 1 0 01-1 1H3a1 1 0 01-1-1v-12a1 1 0 011-1z" />
      <path d="M9.5 1.5V4.5h3" />
      <path d="M5 8h6M5 10.5h6M5 13h4" />
    </svg>
  )
}

function IconIssues({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 5v3.5" />
      <circle cx="8" cy="11" r="0.5" fill="currentColor" />
    </svg>
  )
}

function IconAttention({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5a5 5 0 015 5v3l1.5 1.5h-13L3 9.5v-3a5 5 0 015-5z" />
      <path d="M6.5 13a1.5 1.5 0 003 0" />
    </svg>
  )
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 1.5h3l.5 1.5a4.5 4.5 0 011.2.7l1.5-.5 1.5 2.6-1.1 1.1a4.6 4.6 0 010 1.4l1.1 1.1-1.5 2.6-1.5-.5a4.5 4.5 0 01-1.2.7l-.5 1.5h-3l-.5-1.5a4.5 4.5 0 01-1.2-.7l-1.5.5L1.8 9.4l1.1-1.1a4.6 4.6 0 010-1.4L1.8 5.8l1.5-2.6 1.5.5A4.5 4.5 0 016 3l.5-1.5z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  )
}

const ADMIN_SUBITEMS = [
  { href: '/settings/company',            label: 'Company Profile' },
  { href: '/settings/members',            label: 'Members & Invites' },
  { href: '/settings/review-packs',       label: 'Review Packs' },
  { href: '/settings/approval-workflows', label: 'Approval Workflows' },
  { href: '/settings/reminders',          label: 'Reminder Rules' },
  { href: '/settings/custom-fields',      label: 'Custom Fields' },
]

const NAV_ITEMS = [
  { href: '/',             match: '/',             label: 'Dashboard',         Icon: IconDashboard,   exact: true  },
  { href: '/vendors',      match: '/vendors',      label: 'Vendors',           Icon: IconVendors,     exact: false },
  { href: '/reviews',      match: '/reviews',      label: 'Reviews',           Icon: IconReviews,     exact: false },
  { href: '/issues',       match: '/issues',       label: 'Remediation',       Icon: IconIssues,      exact: false },
  { href: '/attention',    match: '/attention',    label: 'Attention Center',  Icon: IconAttention,   exact: false },
]

export function SidebarNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname()
  const isAdminActive = pathname.startsWith('/settings')
  const [adminOpen, setAdminOpen] = useState(isAdminActive)

  // When the sidebar collapses, force the admin dropdown closed so the
  // sub-items don't try to render in the narrow rail.
  const adminEffectivelyOpen = !collapsed && adminOpen

  return (
    <nav className="flex-1 px-2 py-3 space-y-0.5">
      {NAV_ITEMS.map(({ href, match, label, Icon, exact }) => {
        const isActive = exact ? pathname === match : pathname.startsWith(match)
        return (
          <NavLink key={href} href={href} label={label} Icon={Icon} isActive={isActive} collapsed={collapsed} />
        )
      })}

      {/* Administration — collapsed: behaves like a regular nav link to /settings */}
      {collapsed ? (
        <Link
          href="/settings/company"
          aria-label="Administration"
          title="Administration"
          className="group flex items-center justify-center px-3 py-2 rounded-xl transition-all duration-150 mt-1"
          style={
            isAdminActive
              ? { background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 2px 8px rgba(108,93,211,0.35)', color: 'white' }
              : { color: '#5b4fa8' }
          }
          onMouseEnter={isAdminActive ? undefined : (e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(108,93,211,0.1)'
          }}
          onMouseLeave={isAdminActive ? undefined : (e) => {
            (e.currentTarget as HTMLElement).style.background = ''
          }}
        >
          <span style={{ color: isAdminActive ? 'white' : '#5d5285' }}>
            <IconSettings className="shrink-0" />
          </span>
        </Link>
      ) : (
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setAdminOpen((v) => !v)}
          aria-expanded={adminEffectivelyOpen}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-xl transition-all duration-150"
          style={
            isAdminActive && !adminOpen
              ? { background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', color: 'white', fontWeight: 500, boxShadow: '0 2px 8px rgba(108,93,211,0.35)' }
              : adminOpen
              ? { background: 'rgba(108,93,211,0.12)', color: 'white', fontWeight: 500 }
              : { color: '#5b4fa8', fontWeight: 400 }
          }
          onMouseEnter={(e) => {
            if (!isAdminActive && !adminOpen) {
              (e.currentTarget as HTMLElement).style.background = 'rgba(108,93,211,0.1)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isAdminActive && !adminOpen) {
              (e.currentTarget as HTMLElement).style.background = ''
            }
          }}
        >
          <span style={{ color: isAdminActive || adminOpen ? 'white' : '#5d5285' }}>
            <IconSettings className="shrink-0" />
          </span>
          <span className="flex-1 text-left">Administration</span>
          <svg
            width="11" height="11" viewBox="0 0 16 16" fill="none"
            stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="shrink-0 transition-transform duration-200"
            style={{
              transform: adminOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              opacity: isAdminActive || adminOpen ? 0.9 : 0.55,
            }}
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>

        {adminEffectivelyOpen && (
          <div className="mt-1 ml-3 space-y-0.5" style={{ animation: 'fadeSlideIn 140ms ease-out' }}>
            {ADMIN_SUBITEMS.map((sub) => {
              const subActive = pathname === sub.href || pathname.startsWith(sub.href + '/')
              return (
                <Link
                  key={sub.href}
                  href={sub.href}
                  className="relative flex items-center gap-3 pl-5 pr-3 py-2 text-[13px] rounded-lg transition-colors"
                  style={
                    subActive
                      ? { background: 'rgba(108,93,211,0.18)', color: 'white', fontWeight: 500 }
                      : { color: 'rgba(255,255,255,0.62)', fontWeight: 400 }
                  }
                  onMouseEnter={subActive ? undefined : (e) => {
                    (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.92)'
                    ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                  }}
                  onMouseLeave={subActive ? undefined : (e) => {
                    (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.62)'
                    ;(e.currentTarget as HTMLElement).style.background = ''
                  }}
                >
                  {/* Active accent bar */}
                  <span
                    aria-hidden
                    className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full transition-all"
                    style={{
                      width: subActive ? 3 : 2,
                      height: subActive ? 16 : 4,
                      background: subActive ? '#a39bff' : 'rgba(255,255,255,0.18)',
                    }}
                  />
                  <span className="truncate">{sub.label}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
      )}

      <style jsx>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </nav>
  )
}

function NavLink({
  href,
  label,
  Icon,
  isActive,
  collapsed = false,
}: {
  href: string
  label: string
  Icon: ({ className }: { className?: string }) => React.ReactNode
  isActive: boolean
  collapsed?: boolean
}) {
  return (
    <Link
      href={href}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={`group flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2 text-sm rounded-xl transition-all duration-150 ${
        isActive ? 'text-white font-medium' : 'font-normal'
      }`}
      style={
        isActive
          ? { background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 2px 8px rgba(108,93,211,0.35)' }
          : { color: '#5b4fa8' }
      }
      onMouseEnter={isActive ? undefined : (e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(108,93,211,0.1)'
      }}
      onMouseLeave={isActive ? undefined : (e) => {
        (e.currentTarget as HTMLElement).style.background = ''
      }}
    >
      <span style={isActive ? undefined : { color: '#5d5285' }}>
        <Icon className={`shrink-0 transition-colors ${isActive ? 'text-white' : ''}`} />
      </span>
      {!collapsed && label}
    </Link>
  )
}
