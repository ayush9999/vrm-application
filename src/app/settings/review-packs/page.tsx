import Link from 'next/link'
import { requireCurrentUser } from '@/lib/current-user'
import { getReviewPacks } from '@/lib/db/review-packs'
import { createServerClient } from '@/lib/supabase/server'

export default async function ReviewPacksSettingsPage() {
  const user = await requireCurrentUser()
  const packs = await getReviewPacks(user.orgId)

  // For each pack, count requirements
  const supabase = await createServerClient()
  const packsWithCounts = await Promise.all(
    packs.map(async (p) => {
      const [evidenceRes, reviewRes] = await Promise.all([
        supabase.from('evidence_requirements').select('id', { count: 'exact', head: true }).eq('review_pack_id', p.id).is('deleted_at', null),
        supabase.from('review_requirements').select('id', { count: 'exact', head: true }).eq('review_pack_id', p.id).is('deleted_at', null),
      ])
      return {
        ...p,
        evidence_count: evidenceRes.count ?? 0,
        review_count: reviewRes.count ?? 0,
      }
    }),
  )

  const standardPacks = packsWithCounts.filter((p) => p.source_type === 'standard')
  const customPacks = packsWithCounts.filter((p) => p.source_type === 'custom')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight" style={{ color: '#1e1550' }}>Review Packs</h2>
        <p className="text-sm mt-1" style={{ color: '#a99fd8' }}>
          Review Packs define the evidence + review questions used to onboard a vendor.
          Standard packs ship with the system. Custom packs are specific to your organisation.
        </p>
      </div>

      {/* Standard packs */}
      <section>
        <h3 className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#a99fd8' }}>
          Standard Packs ({standardPacks.length})
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {standardPacks.map((p) => (
            <PackCard key={p.id} pack={p} />
          ))}
        </div>
      </section>

      {/* Custom packs */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
            Custom Packs ({customPacks.length})
          </h3>
        </div>
        {customPacks.length === 0 ? (
          <p className="text-sm py-4" style={{ color: '#a99fd8' }}>
            No custom packs yet. Custom pack creation will be added in a future release.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {customPacks.map((p) => (
              <PackCard key={p.id} pack={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function PackCard({
  pack,
}: {
  pack: {
    id: string
    name: string
    code: string | null
    description: string | null
    review_cadence: string
    evidence_count: number
    review_count: number
  }
}) {
  return (
    <Link
      href={`/settings/review-packs/${pack.id}`}
      className="block rounded-2xl p-4 transition-all hover:-translate-y-0.5"
      style={{
        background: 'white',
        border: '1px solid rgba(109,93,211,0.1)',
        boxShadow: '0 2px 12px rgba(109,93,211,0.06)',
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-semibold" style={{ color: '#1e1550' }}>{pack.name}</h4>
        {pack.code && (
          <span className="text-[10px] font-mono shrink-0 ml-2" style={{ color: '#a99fd8' }}>
            {pack.code}
          </span>
        )}
      </div>
      {pack.description && (
        <p className="text-xs mb-3 leading-relaxed" style={{ color: '#4a4270' }}>
          {pack.description}
        </p>
      )}
      <div className="flex items-center gap-3 pt-3" style={{ borderTop: '1px solid rgba(109,93,211,0.06)' }}>
        <Stat label="Evidence" count={pack.evidence_count} />
        <Stat label="Review Items" count={pack.review_count} />
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium ml-auto"
          style={{ background: 'rgba(109,93,211,0.05)', color: '#6c5dd3' }}
        >
          {pack.review_cadence}
        </span>
      </div>
    </Link>
  )
}

function Stat({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm font-bold tabular-nums" style={{ color: '#6c5dd3' }}>{count}</span>
      <span className="text-[10px] uppercase tracking-wider" style={{ color: '#a99fd8' }}>{label}</span>
    </div>
  )
}
