import Link from 'next/link'

const SETTINGS_SECTIONS = [
  { href: '/settings/frameworks', label: 'Compliance Frameworks' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>
          Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: '#a99fd8' }}>
          Configure your organisation&apos;s compliance preferences
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <nav className="w-48 shrink-0 space-y-0.5">
          {SETTINGS_SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="block px-3 py-2 text-sm rounded-lg transition-colors hover:bg-[rgba(109,93,211,0.05)]"
              style={{ color: '#5b4fa8' }}
            >
              {s.label}
            </Link>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}
