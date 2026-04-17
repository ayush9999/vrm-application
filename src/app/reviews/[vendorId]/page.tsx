import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendorById } from '@/lib/db/vendors'
import { getVendorReviewPacks, getVendorListMetrics } from '@/lib/db/review-packs'
import { RISK_BAND_STYLE } from '@/lib/risk-score'
import type { VendorReviewPack, VendorReviewPackStatus } from '@/types/review-pack'
import { JourneyCardActions } from './_components/JourneyCardActions'
import { submitReviewForApprovalAction, approveReviewAction } from '../../vendors/[id]/reviews/actions'

const STATUS_ORDER: Record<VendorReviewPackStatus, number> = {
  in_progress: 0,
  awaiting_approval: 1,
  sent_back: 2,
  not_started: 3,
  upcoming: 4,
  submitted: 5,
  approved: 6,
  approved_with_exception: 7,
  locked: 8,
  blocked: 9,
}

const STATUS_STYLE: Record<VendorReviewPackStatus, { label: string; bg: string; color: string; icon?: string }> = {
  not_started:              { label: 'Not Started',       bg: 'rgba(148,163,184,0.15)', color: '#64748b' },
  in_progress:              { label: 'In Progress',       bg: 'rgba(14,165,233,0.1)',   color: '#0284c7' },
  awaiting_approval:        { label: 'Awaiting Approval', bg: 'rgba(124,58,237,0.1)',   color: '#7c3aed' },
  sent_back:                { label: 'Sent Back',         bg: 'rgba(245,158,11,0.1)',   color: '#d97706' },
  submitted:                { label: 'Submitted',         bg: 'rgba(99,102,241,0.1)',   color: '#6366f1' },
  approved:                 { label: 'Approved',          bg: 'rgba(5,150,105,0.1)',    color: '#059669', icon: '✓' },
  approved_with_exception:  { label: 'Approved (Exc)',    bg: 'rgba(245,158,11,0.1)',   color: '#d97706', icon: '✓' },
  locked:                   { label: 'Locked',            bg: 'rgba(5,150,105,0.1)',    color: '#059669', icon: '🔒' },
  upcoming:                 { label: 'Upcoming',          bg: 'rgba(14,165,233,0.06)',  color: '#0ea5e9' },
  blocked:                  { label: 'Blocked',           bg: 'rgba(225,29,72,0.1)',    color: '#e11d48' },
}

interface PageProps {
  params: Promise<{ vendorId: string }>
}

export default async function VendorReviewJourneyPage({ params }: PageProps) {
  const { vendorId } = await params
  const user = await requireCurrentUser()

  const vendor = await getVendorById(user.orgId, vendorId)
  if (!vendor) notFound()

  const packs = await getVendorReviewPacks(vendorId)
  const metricsMap = await getVendorListMetrics([{ id: vendorId, approval_status: vendor.approval_status }])
  const m = metricsMap.get(vendorId)
  const riskStyle = m ? RISK_BAND_STYLE[m.risk.band] : null

  // Group packs
  const active = packs.filter((p) =>
    p.status === 'in_progress' || p.status === 'awaiting_approval' ||
    p.status === 'sent_back' || p.status === 'not_started' || p.status === 'submitted',
  )
  const upcoming = packs.filter((p) => p.status === 'upcoming')
  const completed = packs.filter((p) =>
    p.status === 'approved' || p.status === 'approved_with_exception' || p.status === 'locked',
  )
  const blocked = packs.filter((p) => p.status === 'blocked')

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs" style={{ color: '#a99fd8' }}>
        <Link href="/reviews" className="hover:text-[#6c5dd3]">Reviews</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: '#1e1550' }}>{vendor.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>{vendor.name}</h1>
          <p className="text-sm mt-1" style={{ color: '#8b7fd4' }}>
            Review journey — {packs.length} total reviews ({active.length} active, {upcoming.length} upcoming, {completed.length} completed)
          </p>
        </div>
        {m && riskStyle && (
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8b7fd4' }}>Readiness</div>
              <div className="text-lg font-bold tabular-nums" style={{ color: m.readinessPct === 100 ? '#059669' : '#6c5dd3' }}>{m.readinessPct}%</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8b7fd4' }}>Risk</div>
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: riskStyle.bg, color: riskStyle.color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: riskStyle.dot }} />
                {riskStyle.label}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Active / In Progress */}
      {active.length > 0 && (
        <Section title={`Active (${active.length})`} variant="active">
          {active.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]).map((p) => (
            <PackCard key={p.id} pack={p} vendorId={vendorId} todayStr={todayStr} />
          ))}
        </Section>
      )}

      {/* Blocked */}
      {blocked.length > 0 && (
        <Section title={`Blocked (${blocked.length})`} variant="blocked">
          {blocked.map((p) => (
            <PackCard key={p.id} pack={p} vendorId={vendorId} todayStr={todayStr} />
          ))}
        </Section>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <Section title={`Upcoming (${upcoming.length})`} variant="upcoming">
          {upcoming.sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999')).map((p) => (
            <PackCard key={p.id} pack={p} vendorId={vendorId} todayStr={todayStr} />
          ))}
        </Section>
      )}

      {/* Completed / Historical */}
      {completed.length > 0 && (
        <Section title={`Completed (${completed.length})`} variant="completed">
          {completed.sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')).map((p) => (
            <PackCard key={p.id} pack={p} vendorId={vendorId} todayStr={todayStr} />
          ))}
        </Section>
      )}

      {packs.length === 0 && (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'white', border: '1.5px dashed rgba(109,93,211,0.2)' }}>
          <p className="text-sm font-medium" style={{ color: '#1e1550' }}>No review packs assigned to this vendor yet.</p>
          <p className="text-xs mt-1" style={{ color: '#8b7fd4' }}>
            Go to the <Link href={`/vendors/${vendorId}?tab=reviews`} className="underline" style={{ color: '#6c5dd3' }}>vendor profile</Link> to apply review packs.
          </p>
        </div>
      )}

      {/* Compare link */}
      {completed.length >= 2 && (
        <div className="text-center pt-2">
          <Link
            href={`/vendors/${vendorId}/reviews/compare`}
            className="text-sm font-medium px-4 py-2 rounded-full inline-flex items-center gap-1.5"
            style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.15)' }}
          >
            Compare completed reviews →
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Section group ──────────────────────────────────────────────────────────

function Section({ title, variant, children }: { title: string; variant: 'active' | 'upcoming' | 'completed' | 'blocked'; children: React.ReactNode }) {
  const accents = {
    active:    { border: '#0284c7', dot: '#0ea5e9' },
    upcoming:  { border: '#0ea5e9', dot: '#38bdf8' },
    completed: { border: '#059669', dot: '#10b981' },
    blocked:   { border: '#e11d48', dot: '#f43f5e' },
  }
  const a = accents[variant]
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full" style={{ background: a.dot }} />
        <h2 className="text-sm font-semibold" style={{ color: '#1e1550' }}>{title}</h2>
      </div>
      <div className="space-y-2 pl-4" style={{ borderLeft: `2px solid ${a.border}20` }}>
        {children}
      </div>
    </section>
  )
}

// ─── Pack card in the journey ───────────────────────────────────────────────

function PackCard({ pack, vendorId, todayStr }: { pack: VendorReviewPack; vendorId: string; todayStr: string }) {
  const sty = STATUS_STYLE[pack.status]
  const counts = pack.item_counts ?? { total: 0, passed: 0, failed: 0, not_started: 0, na: 0 }
  const applicable = counts.total - counts.na
  const pct = applicable > 0 ? Math.round((counts.passed / applicable) * 100) : 0
  const isOverdue = pack.due_at && pack.due_at.split('T')[0] < todayStr && !['approved', 'approved_with_exception', 'locked'].includes(pack.status)

  return (
    <Link
      href={`/vendors/${vendorId}/reviews/${pack.id}`}
      className="block rounded-xl p-4 transition-all hover:-translate-y-0.5"
      style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.05)' }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: '#1e1550' }}>
              {pack.review_pack_name ?? 'Review Pack'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: sty.bg, color: sty.color }}>
              {sty.icon ? `${sty.icon} ` : ''}{sty.label}
            </span>
          </div>
          {pack.review_pack_code && (
            <span className="text-[10px] font-mono" style={{ color: '#a99fd8' }}>{pack.review_pack_code}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 text-xs">
          {pack.due_at && (
            <span style={{ color: isOverdue ? '#e11d48' : '#4a4270', fontWeight: isOverdue ? 600 : 400 }}>
              {isOverdue ? 'Overdue · ' : 'Due '}
              {new Date(pack.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}
          {pack.completed_at && (
            <span style={{ color: '#059669' }}>
              Completed {new Date(pack.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
          <JourneyCardActions
            vendorId={vendorId}
            packId={pack.id}
            status={pack.status}
            submitAction={submitReviewForApprovalAction}
            approveAction={approveReviewAction}
          />
        </div>
      </div>

      {/* Progress */}
      {applicable > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(109,93,211,0.06)' }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? '#059669' : 'linear-gradient(90deg, #6c5dd3, #7c6be0)' }} />
            </div>
          </div>
          <span className="text-[11px] font-bold tabular-nums shrink-0" style={{ color: pct === 100 ? '#059669' : '#6c5dd3' }}>
            {pct}%
          </span>
          <span className="text-[10px] shrink-0" style={{ color: '#a99fd8' }}>
            {counts.passed} / {applicable}
          </span>
        </div>
      )}

      {/* Mini stats */}
      <div className="flex items-center gap-3 mt-2 text-[10px]" style={{ color: '#a99fd8' }}>
        {counts.failed > 0 && <span style={{ color: '#e11d48' }}>{counts.failed} failed</span>}
        {counts.not_started > 0 && <span>{counts.not_started} pending</span>}
        {pack.matched_rule && <span className="italic ml-auto">{pack.matched_rule}</span>}
      </div>
    </Link>
  )
}
