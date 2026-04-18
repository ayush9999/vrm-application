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
  { href: '/',             match: '/',             label: 'Dashboard',       Icon: IconDashboard,   exact: true  },
  { href: '/vendors',      match: '/vendors',      label: 'Vendors',         Icon: IconVendors,     exact: false },
  { href: '/reviews',      match: '/reviews',      label: 'Reviews',         Icon: IconReviews,     exact: false },
  { href: '/issues',       match: '/issues',       label: 'Remediation',     Icon: IconIssues,      exact: false },
]

export function SidebarNav() {
  const pathname = usePathname()
  const isAdminActive = pathname.startsWith('/settings')
  const [adminOpen, setAdminOpen] = useState(isAdminActive)

  return (
    <nav className="flex-1 px-2 py-3 space-y-0.5">
      {NAV_ITEMS.map(({ href, match, label, Icon, exact }) => {
        const isActive = exact ? pathname === match : pathname.startsWith(match)
        return (
          <NavLink key={href} href={href} label={label} Icon={Icon} isActive={isActive} />
        )
      })}

      {/* Administration — expandable with sub-items */}
      <div>
        <button
          type="button"
          onClick={() => setAdminOpen((v) => !v)}
          className={`w-full group flex items-center gap-3 px-3 py-2 text-sm rounded-xl transition-all duration-150 ${
            isAdminActive ? 'text-white font-medium' : 'font-normal'
          }`}
          style={
            isAdminActive
              ? { background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 2px 8px rgba(108,93,211,0.35)' }
              : { color: '#5b4fa8' }
          }
          onMouseEnter={isAdminActive ? undefined : (e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(108,93,211,0.1)'
          }}
          onMouseLeave={isAdminActive ? undefined : (e) => {
            (e.currentTarget as HTMLElement).style.background = ''
          }}
        >
          <span style={isAdminActive ? undefined : { color: '#8b7fd4' }}>
            <IconSettings className={`shrink-0 transition-colors ${isAdminActive ? 'text-white' : ''}`} />
          </span>
          <span className="flex-1 text-left">Administration</span>
          <svg
            width="10" height="10" viewBox="0 0 16 16" fill="none"
            stroke={isAdminActive ? 'white' : '#8b7fd4'}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="shrink-0 transition-transform"
            style={{ transform: adminOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>

        {adminOpen && (
          <div className="mt-0.5 ml-5 pl-3 space-y-0.5" style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
            {ADMIN_SUBITEMS.map((sub) => {
              const subActive = pathname === sub.href || pathname.startsWith(sub.href + '/')
              return (
                <Link
                  key={sub.href}
                  href={sub.href}
                  className="block px-3 py-1.5 text-xs rounded-lg transition-colors"
                  style={
                    subActive
                      ? { background: 'rgba(255,255,255,0.12)', color: 'white', fontWeight: 600 }
                      : { color: 'rgba(255,255,255,0.5)' }
                  }
                  onMouseEnter={subActive ? undefined : (e) => {
                    (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)'
                    ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
                  }}
                  onMouseLeave={subActive ? undefined : (e) => {
                    (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'
                    ;(e.currentTarget as HTMLElement).style.background = ''
                  }}
                >
                  {sub.label}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </nav>
  )
}

function NavLink({ href, label, Icon, isActive }: { href: string; label: string; Icon: ({ className }: { className?: string }) => React.ReactNode; isActive: boolean }) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 px-3 py-2 text-sm rounded-xl transition-all duration-150 ${
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
      <span style={isActive ? undefined : { color: '#8b7fd4' }}>
        <Icon className={`shrink-0 transition-colors ${isActive ? 'text-white' : ''}`} />
      </span>
      {label}
    </Link>
  )
}
