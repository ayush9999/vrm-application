import { SettingsNav } from './_components/SettingsNav'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>
          Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: '#8b7fd4' }}>
          Configure your organisation&apos;s preferences
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <SettingsNav />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}
