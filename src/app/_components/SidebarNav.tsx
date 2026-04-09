'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

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

function IconAssessments({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 1.5h10a1 1 0 011 1v11a1 1 0 01-1 1H3a1 1 0 01-1-1v-11a1 1 0 011-1z" />
      <path d="M4.5 5h7M4.5 7.5h7M4.5 10h4.5" />
      <path d="M10.5 10l1 1 2-2" />
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

const NAV_ITEMS = [
  { href: '/',             match: '/',             label: 'Dashboard',       Icon: IconDashboard,   exact: true  },
  { href: '/vendors',      match: '/vendors',      label: 'Vendors',         Icon: IconVendors,     exact: false },
  { href: '/assessments',  match: '/assessments',  label: 'Risk Assessment', Icon: IconAssessments, exact: false },
  { href: '/issues',       match: '/issues',       label: 'Issues',          Icon: IconIssues,      exact: false },
  { href: '/settings',     match: '/settings',     label: 'Settings',        Icon: IconSettings,    exact: false },
]

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="flex-1 px-2 py-3 space-y-0.5">
      {NAV_ITEMS.map(({ href, match, label, Icon, exact }) => {
        const isActive = exact ? pathname === match : pathname.startsWith(match)
        return (
          <Link
            key={href}
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
      })}
    </nav>
  )
}
