import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCurrentUser } from '@/lib/current-user'
import { getReviewPackWithRequirements } from '@/lib/db/review-packs'
import { PackLifecycleControls } from './_components/PackLifecycleControls'
import { EditableRequirements } from './_components/EditableRequirements'

interface PageProps {
  params: Promise<{ packId: string }>
}

export default async function ReviewPackDetailPage({ params }: PageProps) {
  const { packId } = await params
  const user = await requireCurrentUser()

  let data
  try {
    data = await getReviewPackWithRequirements(packId)
  } catch {
    notFound()
  }

  const { pack, evidenceRequirements, reviewRequirements } = data

  // Check this pack is visible to the user (RLS would have filtered, but defensive)
  if (pack.org_id !== null && pack.org_id !== user.orgId) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5 text-xs" style={{ color: '#a99fd8' }}>
        <Link href="/settings/review-packs" className="hover:text-[#6c5dd3]" style={{ color: '#a99fd8' }}>
          Review Packs
        </Link>
        <span>/</span>
        <span className="font-medium" style={{ color: '#1e1550' }}>{pack.name}</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>{pack.name}</h2>
            {pack.code && (
              <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(109,93,211,0.08)', color: '#6b5fa8' }}>
                {pack.code}
              </span>
            )}
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
              style={{
                background: pack.source_type === 'standard' ? 'rgba(108,93,211,0.08)' : 'rgba(5,150,105,0.08)',
                color: pack.source_type === 'standard' ? '#6c5dd3' : '#059669',
              }}
            >
              {pack.source_type}
            </span>
            {!pack.is_active && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: 'rgba(148,163,184,0.2)', color: '#64748b' }}>
                Archived
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(245,158,11,0.06)', color: '#d97706' }}>
              {pack.review_cadence}
            </span>
          </div>
          {pack.description && (
            <p className="text-sm mt-2 leading-relaxed" style={{ color: '#4a4270' }}>
              {pack.description}
            </p>
          )}
        </div>
        <PackLifecycleControls
          packId={pack.id}
          isActive={pack.is_active}
          isStandard={pack.source_type === 'standard'}
          isSiteAdmin={user.role === 'site_admin'}
        />
      </div>

      {/* Applicability */}
      <Section title="Applicability Rules">
        <pre
          className="text-xs p-3 rounded-lg font-mono overflow-x-auto"
          style={{ background: 'rgba(109,93,211,0.04)', color: '#4a4270', border: '1px solid rgba(109,93,211,0.08)' }}
        >
          {JSON.stringify(pack.applicability_rules, null, 2)}
        </pre>
        <p className="text-xs mt-2" style={{ color: '#a99fd8' }}>
          These rules drive auto-assignment of this pack to vendors based on their profile.
        </p>
      </Section>

      <EditableRequirements
        packId={pack.id}
        evidence={evidenceRequirements}
        reviews={reviewRequirements}
        isCustom={pack.source_type === 'custom'}
        canEdit={user.role === 'site_admin'}
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#a99fd8' }}>
        {title}
      </h3>
      {children}
    </section>
  )
}
