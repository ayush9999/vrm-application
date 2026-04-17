/**
 * Branded loading skeleton shown by Next.js loading.tsx files
 * while server components fetch data.
 */
export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Shimmer header */}
      <div className="mb-6 space-y-2">
        <div className="h-7 w-48 rounded-lg animate-pulse" style={{ background: 'rgba(108,93,211,0.08)' }} />
        <div className="h-4 w-72 rounded-md animate-pulse" style={{ background: 'rgba(108,93,211,0.05)' }} />
      </div>

      {/* Shimmer cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'rgba(108,93,211,0.05)', animationDelay: `${i * 100}ms` }} />
        ))}
      </div>

      {/* Shimmer table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)' }}>
        <div className="h-10 animate-pulse" style={{ background: 'rgba(108,93,211,0.03)' }} />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3" style={{ borderBottom: '1px solid rgba(109,93,211,0.04)' }}>
            <div className="h-4 w-32 rounded animate-pulse" style={{ background: 'rgba(108,93,211,0.06)', animationDelay: `${i * 80}ms` }} />
            <div className="h-4 w-20 rounded animate-pulse" style={{ background: 'rgba(108,93,211,0.04)', animationDelay: `${i * 80 + 40}ms` }} />
            <div className="h-4 w-16 rounded-full animate-pulse ml-auto" style={{ background: 'rgba(108,93,211,0.06)', animationDelay: `${i * 80 + 80}ms` }} />
          </div>
        ))}
      </div>

      {/* Loading label */}
      {label && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(108,93,211,0.3)', borderTopColor: 'transparent' }} />
          <span className="text-xs font-medium" style={{ color: '#8b7fd4' }}>{label}</span>
        </div>
      )}
    </div>
  )
}

/** Minimal spinner for inline use. */
export function InlineLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(108,93,211,0.25)', borderTopColor: '#6c5dd3' }} />
    </div>
  )
}
