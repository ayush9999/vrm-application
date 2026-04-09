import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#ecedf2' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
            style={{
              background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)',
              boxShadow: '0 8px 24px rgba(108,93,211,0.3)',
            }}
          >
            <span className="text-white text-2xl font-bold">V</span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>
            Vendor Management
          </h1>
        </div>

        <div
          className="bg-white rounded-2xl p-7"
          style={{
            border: '1px solid rgba(109,93,211,0.1)',
            boxShadow: '0 2px 12px rgba(109,93,211,0.08)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
