export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>
          Administration
        </h1>
        <p className="text-sm mt-1" style={{ color: '#8b7fd4' }}>
          Manage your organisation&apos;s configuration, members, and compliance settings
        </p>
      </div>
      {children}
    </div>
  )
}
