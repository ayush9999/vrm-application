'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SETTINGS_SECTIONS = [
  { href: '/settings/company',            label: 'Company Profile' },
  { href: '/settings/members',            label: 'Members & Invites' },
  { href: '/settings/review-packs',       label: 'Review Packs' },
  { href: '/settings/approval-workflows', label: 'Approval Workflows' },
  { href: '/settings/reminders',          label: 'Reminder Rules' },
  { href: '/settings/custom-fields',      label: 'Custom Fields' },
]

export function SettingsNav() {
  const pathname = usePathname()
  return (
    <nav className="w-full md:w-52 shrink-0 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
      {SETTINGS_SECTIONS.map((s) => {
        const isActive = pathname === s.href || pathname.startsWith(s.href + '/')
        return (
          <Link
            key={s.href}
            href={s.href}
            className="block px-3 py-2 text-sm rounded-lg transition-colors whitespace-nowrap"
            style={
              isActive
                ? { background: 'rgba(108,93,211,0.1)', color: '#6c5dd3', fontWeight: 600, border: '1px solid rgba(108,93,211,0.2)' }
                : { color: '#4a4270', border: '1px solid transparent' }
            }
          >
            {s.label}
          </Link>
        )
      })}
    </nav>
  )
}
