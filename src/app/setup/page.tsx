import { redirect } from 'next/navigation'
import { getCurrentOrgId } from '@/lib/current-org'
import Link from 'next/link'

export default async function SetupPage() {
  const orgId = await getCurrentOrgId()
  if (orgId) redirect('/vendors')

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#ecedf2' }}>
      <div className="w-full max-w-md text-center">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
          style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 8px 24px rgba(108,93,211,0.3)' }}
        >
          <span className="text-white text-2xl font-bold">V</span>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight mb-2" style={{ color: '#1e1550' }}>
          Vendor Management
        </h1>
        <p className="text-sm leading-relaxed mb-8" style={{ color: '#a99fd8' }}>
          Track vendors, documents, compliance, and disputes — all in one place.
        </p>

        <Link
          href="/setup/organization"
          className="inline-flex items-center justify-center text-white px-6 py-3 rounded-full text-sm font-semibold transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 4px 12px rgba(108,93,211,0.3)' }}
        >
          Get Started →
        </Link>

        <p className="text-xs mt-6" style={{ color: '#c4bae8' }}>
          You&apos;ll create your organisation, then start adding vendors.
        </p>
      </div>
    </div>
  )
}
