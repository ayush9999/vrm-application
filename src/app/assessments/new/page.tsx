import Link from 'next/link'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendors } from '@/lib/db/vendors'
import { getFrameworks } from '@/lib/db/assessments'
import { NewAssessmentForm } from './_components/NewAssessmentForm'
import { createAssessmentAction } from '../actions'

export default async function NewAssessmentPage() {
  const user = await requireCurrentUser()
  const [vendors, frameworks] = await Promise.all([
    getVendors(user.orgId),
    getFrameworks(user.orgId, 'vendor_risk_framework'),
  ])

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/assessments"
          className="inline-flex items-center gap-1 text-sm transition-colors hover:opacity-70"
          style={{ color: '#a99fd8' }}
        >
          ← Back to Assessments
        </Link>
        <h1 className="text-2xl font-semibold mt-3 tracking-tight" style={{ color: '#1e1550' }}>
          New Risk Assessment
        </h1>
        <p className="text-sm mt-1" style={{ color: '#a99fd8' }}>
          Select a vendor and a Vendor Risk Framework to begin a structured review.
        </p>
      </div>

      {/* Journey steps preview */}
      {(() => {
        const steps = ['Setup', 'Review Items', 'Findings', 'AI Review', 'Human Review', 'Finalise']
        return (
          <div
            className="rounded-2xl mb-6 overflow-hidden"
            style={{ border: '1px solid rgba(109,93,211,0.12)' }}
          >
            <div className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
              {steps.map((label, i) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-1.5 px-2 py-3 text-center"
                  style={{
                    background: i === 0 ? 'rgba(109,93,211,0.1)' : 'rgba(109,93,211,0.03)',
                    borderRight: i < steps.length - 1 ? '1px solid rgba(109,93,211,0.1)' : 'none',
                  }}
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{
                      background: i === 0 ? '#6c5dd3' : 'rgba(109,93,211,0.15)',
                      color: i === 0 ? '#fff' : '#a99fd8',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    className="text-[11px] font-medium leading-tight"
                    style={{ color: i === 0 ? '#1e1550' : '#a99fd8' }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      <div
        className="bg-white rounded-2xl p-6"
        style={{ boxShadow: '0 2px 12px rgba(109,93,211,0.08)', border: '1px solid rgba(109,93,211,0.1)' }}
      >
        <NewAssessmentForm
          action={createAssessmentAction}
          vendors={vendors}
          frameworks={frameworks}
          primaryFrameworkId={null}
        />
      </div>
    </div>
  )
}
