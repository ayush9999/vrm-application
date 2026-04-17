'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReviewListRow } from '@/lib/db/reviews-list'
import type { OrgUser } from '@/lib/db/organizations'
import type { VendorReviewPackStatus } from '@/types/review-pack'

const STATUS_STYLE: Record<VendorReviewPackStatus, { label: string; bg: string; color: string }> = {
  not_started:              { label: 'Not Started',       bg: 'rgba(148,163,184,0.15)', color: '#64748b' },
  in_progress:              { label: 'In Progress',       bg: 'rgba(14,165,233,0.1)',   color: '#0284c7' },
  submitted:                { label: 'Submitted',         bg: 'rgba(99,102,241,0.1)',   color: '#6366f1' },
  awaiting_approval:        { label: 'Awaiting Approval', bg: 'rgba(124,58,237,0.1)',   color: '#7c3aed' },
  sent_back:                { label: 'Sent Back',         bg: 'rgba(245,158,11,0.1)',   color: '#d97706' },
  approved:                 { label: 'Approved',          bg: 'rgba(5,150,105,0.1)',    color: '#059669' },
  approved_with_exception:  { label: 'Approved (Exc)',    bg: 'rgba(245,158,11,0.1)',   color: '#d97706' },
  blocked:                  { label: 'Blocked',           bg: 'rgba(225,29,72,0.1)',    color: '#e11d48' },
  upcoming:                 { label: 'Upcoming',          bg: 'rgba(14,165,233,0.08)',  color: '#0ea5e9' },
  locked:                   { label: 'Locked',            bg: 'rgba(5,150,105,0.1)',    color: '#059669' },
}

type DueFilter = 'all' | 'this_week' | 'this_month' | 'overdue'
type ViewMode = 'flat' | 'grouped'

interface Props {
  reviews: ReviewListRow[]
  users: OrgUser[]
}

export function ReviewsListClient({ reviews, users }: Props) {
  const [packFilter, setPackFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [criticalityFilter, setCriticalityFilter] = useState<string>('all')
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [dueFilter, setDueFilter] = useState<DueFilter>('all')
  const [view, setView] = useState<ViewMode>('flat')

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const endOfWeek = new Date(today.getTime() + (6 - today.getDay()) * 86_400_000).toISOString().split('T')[0]
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]

  // Distinct packs for the dropdown
  const distinctPacks = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of reviews) map.set(r.pack_id, r.pack_name)
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [reviews])

  // Filtering
  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      if (packFilter !== 'all' && r.pack_id !== packFilter) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (criticalityFilter !== 'all') {
        const tier = parseInt(criticalityFilter, 10)
        if (r.vendor_criticality_tier !== tier) return false
      }
      if (ownerFilter !== 'all' && r.reviewer_user_id !== ownerFilter) return false
      if (dueFilter !== 'all') {
        if (!r.due_at) return false
        const due = r.due_at.split('T')[0]
        if (dueFilter === 'overdue' && !(due < todayStr && r.status !== 'approved' && r.status !== 'approved_with_exception')) return false
        if (dueFilter === 'this_week' && !(due >= todayStr && due <= endOfWeek)) return false
        if (dueFilter === 'this_month' && !(due >= todayStr && due <= endOfMonth)) return false
      }
      return true
    })
  }, [reviews, packFilter, statusFilter, criticalityFilter, ownerFilter, dueFilter, todayStr, endOfWeek, endOfMonth])

  // Sort: overdue first, then by due_at ascending, then by vendor name
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aOverdue = a.due_at ? a.due_at.split('T')[0] < todayStr && a.status !== 'approved' && a.status !== 'approved_with_exception' : false
      const bOverdue = b.due_at ? b.due_at.split('T')[0] < todayStr && b.status !== 'approved' && b.status !== 'approved_with_exception' : false
      if (aOverdue && !bOverdue) return -1
      if (!aOverdue && bOverdue) return 1
      const ad = a.due_at ?? '9999-12-31'
      const bd = b.due_at ?? '9999-12-31'
      if (ad !== bd) return ad < bd ? -1 : 1
      return a.vendor_name.localeCompare(b.vendor_name)
    })
  }, [filtered, todayStr])

  // Summary stats — derived from ALL reviews (not just filtered)
  const stats = useMemo(() => {
    const active = reviews.filter((r) => r.status !== 'approved' && r.status !== 'approved_with_exception').length
    const overdue = reviews.filter((r) => r.due_at && r.due_at.split('T')[0] < todayStr && r.status !== 'approved' && r.status !== 'approved_with_exception').length
    const dueThisMonth = reviews.filter((r) => {
      if (!r.due_at) return false
      const d = r.due_at.split('T')[0]
      return d >= todayStr && d <= endOfMonth
    }).length
    const awaitingApproval = reviews.filter((r) => r.status === 'submitted').length
    return { active, overdue, dueThisMonth, awaitingApproval }
  }, [reviews, todayStr, endOfMonth])

  const clearFilters = () => {
    setPackFilter('all'); setStatusFilter('all'); setCriticalityFilter('all'); setOwnerFilter('all'); setDueFilter('all')
  }

  const hasActiveFilter = packFilter !== 'all' || statusFilter !== 'all' || criticalityFilter !== 'all' || ownerFilter !== 'all' || dueFilter !== 'all'

  if (reviews.length === 0) {
    return (
      <EmptyState message="No reviews yet" sub="Add a vendor to get started.">
        <Link href="/vendors/new" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}>
          + Add Vendor
        </Link>
      </EmptyState>
    )
  }

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Active Reviews" value={stats.active} color="#6c5dd3" />
        <Stat label="Overdue" value={stats.overdue} color={stats.overdue > 0 ? '#e11d48' : '#a99fd8'} />
        <Stat label="Due This Month" value={stats.dueThisMonth} color="#d97706" />
        <Stat label="Awaiting Approval" value={stats.awaitingApproval} color="#6366f1" />
      </div>

      {/* Filters + view toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select label="Pack" value={packFilter} onChange={setPackFilter} options={[{ value: 'all', label: 'All packs' }, ...distinctPacks.map((p) => ({ value: p.id, label: p.name }))]} />
        <Select label="Status" value={statusFilter} onChange={setStatusFilter} options={[
          { value: 'all', label: 'All statuses' },
          ...(Object.entries(STATUS_STYLE).map(([k, v]) => ({ value: k, label: v.label }))),
        ]} />
        <Select label="Criticality" value={criticalityFilter} onChange={setCriticalityFilter} options={[
          { value: 'all', label: 'All tiers' },
          { value: '1', label: 'Tier 1' },
          { value: '2', label: 'Tier 2' },
          { value: '3', label: 'Tier 3' },
          { value: '4', label: 'Tier 4' },
          { value: '5', label: 'Tier 5' },
        ]} />
        <Select label="Owner" value={ownerFilter} onChange={setOwnerFilter} options={[
          { value: 'all', label: 'All owners' },
          ...users.map((u) => ({ value: u.id, label: u.name ?? u.email ?? u.id })),
        ]} />
        <Select label="Due" value={dueFilter} onChange={(v) => setDueFilter(v as DueFilter)} options={[
          { value: 'all', label: 'Any time' },
          { value: 'this_week', label: 'This week' },
          { value: 'this_month', label: 'This month' },
          { value: 'overdue', label: 'Overdue' },
        ]} />
        {hasActiveFilter && (
          <button type="button" onClick={clearFilters} className="text-xs font-medium px-3 py-1.5 rounded-full" style={{ color: '#e11d48' }}>
            × Clear filters
          </button>
        )}
        <div className="ml-auto flex items-center gap-1 rounded-full p-0.5" style={{ background: 'rgba(108,93,211,0.06)', border: '1px solid rgba(108,93,211,0.12)' }}>
          <button type="button" onClick={() => setView('flat')} className="text-xs font-medium px-3 py-1 rounded-full" style={view === 'flat' ? { background: '#6c5dd3', color: 'white' } : { color: '#6c5dd3' }}>
            Flat
          </button>
          <button type="button" onClick={() => setView('grouped')} className="text-xs font-medium px-3 py-1 rounded-full" style={view === 'grouped' ? { background: '#6c5dd3', color: 'white' } : { color: '#6c5dd3' }}>
            By Pack
          </button>
        </div>
      </div>

      {/* Results */}
      {sorted.length === 0 ? (
        <EmptyState message="No reviews match your filters" sub="Try clearing filters to see more.">
          <button type="button" onClick={clearFilters} className="text-xs font-medium" style={{ color: '#6c5dd3' }}>
            Clear filters →
          </button>
        </EmptyState>
      ) : view === 'flat' ? (
        <ReviewTable rows={sorted} todayStr={todayStr} />
      ) : (
        <GroupedView rows={sorted} todayStr={todayStr} />
      )}
    </div>
  )
}

// ─── Stats ──────────────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}>
      <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1" style={{ color }}>{value}</div>
    </div>
  )
}

// ─── Filter dropdown ────────────────────────────────────────────────────────

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs">
      <span className="font-medium" style={{ color: '#6c5dd3' }}>{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg px-2.5 py-1 text-xs focus:outline-none"
        style={{ border: '1px solid rgba(109,93,211,0.2)', background: 'white', color: '#1e1550' }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}

// ─── Flat table ─────────────────────────────────────────────────────────────

function ReviewTable({ rows, todayStr }: { rows: ReviewListRow[]; todayStr: string }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(109,93,211,0.08)', background: 'rgba(109,93,211,0.03)' }}>
              {['Vendor', 'Pack', 'Status', 'Readiness', 'Missing', 'Rem.', 'Owner', 'Due', ''].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#a99fd8' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => <ReviewRow key={r.vendor_review_pack_id} r={r} todayStr={todayStr} />)}
          </tbody>
        </table>
      </div>
      {/* Mobile list */}
      <div className="md:hidden">
        {rows.map((r) => <MobileReviewRow key={r.vendor_review_pack_id} r={r} todayStr={todayStr} />)}
      </div>
    </div>
  )
}

function ReviewRow({ r, todayStr }: { r: ReviewListRow; todayStr: string }) {
  const router = useRouter()
  const sty = STATUS_STYLE[r.status]
  const isOverdue = r.due_at && r.due_at.split('T')[0] < todayStr && r.status !== 'approved' && r.status !== 'approved_with_exception'
  const reviewUrl = `/vendors/${r.vendor_id}/reviews/${r.vendor_review_pack_id}`

  return (
    <tr
      style={{ borderBottom: '1px solid rgba(109,93,211,0.06)', cursor: 'pointer' }}
      className="hover:bg-[rgba(109,93,211,0.02)] transition-colors"
      onClick={() => router.push(reviewUrl)}
    >
      <td className="px-3 py-3">
        <Link
          href={`/vendors/${r.vendor_id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-sm font-medium hover:underline"
          style={{ color: '#1e1550' }}
        >
          {r.vendor_name}
        </Link>
        <div className="flex items-center gap-1.5 mt-0.5">
          {r.vendor_criticality_tier && (
            <span className="text-[9px] px-1 rounded font-bold" style={
              r.vendor_criticality_tier === 1 ? { background: 'rgba(225,29,72,0.1)', color: '#e11d48' } :
              r.vendor_criticality_tier === 2 ? { background: 'rgba(245,158,11,0.1)', color: '#d97706' } :
              { background: 'rgba(109,93,211,0.05)', color: '#6c5dd3' }
            }>T{r.vendor_criticality_tier}</span>
          )}
          {r.vendor_code && <span className="text-[10px] font-mono" style={{ color: '#a99fd8' }}>{r.vendor_code}</span>}
        </div>
      </td>
      <td className="px-3 py-3 text-xs" style={{ color: '#4a4270' }}>{r.pack_name}</td>
      <td className="px-3 py-3">
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase whitespace-nowrap" style={{ background: sty.bg, color: sty.color }}>
          {sty.label}
        </span>
      </td>
      <td className="px-3 py-3 min-w-[110px]">
        {r.applicable === 0 ? (
          <span className="text-xs" style={{ color: '#c4bae8' }}>—</span>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] font-bold tabular-nums" style={{ color: r.readiness_pct === 100 ? '#059669' : r.readiness_pct >= 50 ? '#6c5dd3' : '#d97706' }}>{r.readiness_pct}%</span>
              <span className="text-[10px]" style={{ color: '#a99fd8' }}>{r.completed} / {r.applicable}</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(109,93,211,0.06)' }}>
              <div className="h-full rounded-full" style={{ width: `${r.readiness_pct}%`, background: r.readiness_pct === 100 ? '#059669' : 'linear-gradient(90deg, #6c5dd3, #7c6be0)' }} />
            </div>
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-center">
        {r.missing_evidence > 0 ? <span className="text-xs font-bold" style={{ color: '#d97706' }}>{r.missing_evidence}</span> : <span style={{ color: '#c4bae8' }}>—</span>}
      </td>
      <td className="px-3 py-3 text-center">
        {r.open_remediations > 0 ? <span className="text-xs font-bold" style={{ color: '#e11d48' }}>{r.open_remediations}</span> : <span style={{ color: '#c4bae8' }}>—</span>}
      </td>
      <td className="px-3 py-3 text-xs" style={{ color: '#4a4270' }}>{r.reviewer_name ?? <span style={{ color: '#c4bae8' }}>—</span>}</td>
      <td className="px-3 py-3 text-xs" style={{ color: isOverdue ? '#e11d48' : '#4a4270', fontWeight: isOverdue ? 600 : 400 }}>
        {r.due_at ? new Date(r.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
        {isOverdue && <span className="ml-1 text-[9px] font-bold uppercase">Overdue</span>}
      </td>
      <td className="px-3 py-3 text-right">
        <Link href={reviewUrl} className="text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap" style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.15)' }}>
          Open →
        </Link>
      </td>
    </tr>
  )
}

function MobileReviewRow({ r, todayStr }: { r: ReviewListRow; todayStr: string }) {
  const sty = STATUS_STYLE[r.status]
  const isOverdue = r.due_at && r.due_at.split('T')[0] < todayStr && r.status !== 'approved' && r.status !== 'approved_with_exception'
  return (
    <Link href={`/vendors/${r.vendor_id}/reviews/${r.vendor_review_pack_id}`} className="block px-4 py-3" style={{ borderBottom: '1px solid rgba(109,93,211,0.06)' }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium flex-1" style={{ color: '#1e1550' }}>{r.vendor_name}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0" style={{ background: sty.bg, color: sty.color }}>{sty.label}</span>
      </div>
      <div className="flex items-center justify-between text-xs" style={{ color: '#a99fd8' }}>
        <span>{r.pack_name}</span>
        {r.due_at && (
          <span style={{ color: isOverdue ? '#e11d48' : '#a99fd8', fontWeight: isOverdue ? 600 : 400 }}>
            {isOverdue ? 'Overdue · ' : 'Due '}{new Date(r.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </Link>
  )
}

// ─── Grouped view ───────────────────────────────────────────────────────────

function GroupedView({ rows, todayStr }: { rows: ReviewListRow[]; todayStr: string }) {
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; rows: ReviewListRow[] }>()
    for (const r of rows) {
      const g = map.get(r.pack_id) ?? { name: r.pack_name, rows: [] }
      g.rows.push(r)
      map.set(r.pack_id, g)
    }
    return Array.from(map.entries())
      .map(([id, g]) => ({ id, ...g }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.id}>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: '#1e1550' }}>
            {g.name}
            <span className="text-[10px] font-normal" style={{ color: '#a99fd8' }}>({g.rows.length} vendor{g.rows.length !== 1 ? 's' : ''})</span>
          </h3>
          <ReviewTable rows={g.rows} todayStr={todayStr} />
        </section>
      ))}
    </div>
  )
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ message, sub, children }: { message: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-12 text-center" style={{ background: 'white', border: '1.5px dashed rgba(109,93,211,0.2)' }}>
      <p className="text-sm font-medium" style={{ color: '#6b5fa8' }}>{message}</p>
      <p className="text-xs mt-1" style={{ color: '#a99fd8' }}>{sub}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
