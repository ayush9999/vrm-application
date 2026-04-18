'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { VendorReviewPack, VendorReviewPackStatus } from '@/types/review-pack'
import type { VendorPackAssignment } from '@/lib/db/vendor-pack-assignments'

const STATUS_STYLE: Record<VendorReviewPackStatus, { bg: string; color: string; label: string }> = {
  not_started:              { bg: 'rgba(148,163,184,0.15)', color: '#64748b', label: 'Not Started' },
  in_progress:              { bg: 'rgba(14,165,233,0.1)',   color: '#0284c7', label: 'In Progress' },
  submitted:                { bg: 'rgba(99,102,241,0.1)',   color: '#6366f1', label: 'Submitted' },
  awaiting_approval:        { bg: 'rgba(124,58,237,0.1)',   color: '#7c3aed', label: 'Awaiting Approval' },
  sent_back:                { bg: 'rgba(245,158,11,0.1)',   color: '#d97706', label: 'Sent Back' },
  approved:                 { bg: 'rgba(5,150,105,0.1)',    color: '#059669', label: 'Approved' },
  approved_with_exception:  { bg: 'rgba(245,158,11,0.1)',   color: '#d97706', label: 'Approved (Exception)' },
  blocked:                  { bg: 'rgba(225,29,72,0.1)',    color: '#e11d48', label: 'Blocked' },
  upcoming:                 { bg: 'rgba(14,165,233,0.08)',  color: '#0ea5e9', label: 'Upcoming' },
  locked:                   { bg: 'rgba(5,150,105,0.1)',    color: '#059669', label: 'Locked' },
}

interface ReviewsTabProps {
  vendorId: string
  assignments: VendorPackAssignment[]
  reviewPacks: VendorReviewPack[]
  availablePacks: { id: string; name: string; code: string | null }[]
  assignPackAction: (vendorId: string, reviewPackId: string) => Promise<{ success?: boolean; message?: string }>
  removePackAction: (vendorId: string, reviewPackId: string) => Promise<{ success?: boolean; message?: string }>
}

export function ReviewsTab({ vendorId, assignments, reviewPacks, availablePacks, assignPackAction, removePackAction }: ReviewsTabProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showAssign, setShowAssign] = useState(false)

  const assignedPackIds = new Set(assignments.map((a) => a.review_pack_id))
  const unassignedPacks = availablePacks.filter((p) => !assignedPackIds.has(p.id))

  const handleAssign = (packId: string) => {
    startTransition(async () => {
      await assignPackAction(vendorId, packId)
      setShowAssign(false)
      router.refresh()
    })
  }

  const handleRemove = (packId: string) => {
    if (!confirm('Remove this pack? Future scheduled reviews won\'t include it. Existing reviews are not affected.')) return
    startTransition(async () => {
      await removePackAction(vendorId, packId)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* ── Section 1: Assigned Packs (Configuration) ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: '#1e1550' }}>Assigned Packs</h2>
            <p className="text-xs mt-0.5" style={{ color: '#8b7fd4' }}>
              Packs assigned to this vendor. Scheduled reviews pull from this list.
            </p>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAssign((v) => !v)}
              disabled={unassignedPacks.length === 0 || isPending}
              className="text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-40"
              style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.12)' }}
            >
              + Add Pack
            </button>
            {showAssign && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAssign(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-xl overflow-hidden" style={{ background: 'white', border: '1px solid rgba(109,93,211,0.15)', boxShadow: '0 4px 16px rgba(109,93,211,0.15)' }}>
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8b7fd4', borderBottom: '1px solid rgba(109,93,211,0.06)' }}>
                    Assign a pack
                  </div>
                  {unassignedPacks.map((p) => (
                    <button key={p.id} type="button" onClick={() => handleAssign(p.id)} disabled={isPending} className="w-full text-left px-3 py-2 text-xs hover:bg-[rgba(109,93,211,0.04)] disabled:opacity-50" style={{ color: '#1e1550' }}>
                      <span className="font-medium">{p.name}</span>
                      {p.code && <span className="ml-1.5 font-mono text-[10px]" style={{ color: '#a99fd8' }}>{p.code}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {assignments.length === 0 ? (
          <p className="text-xs py-3 px-4 rounded-lg" style={{ background: 'rgba(109,93,211,0.03)', color: '#8b7fd4' }}>
            No packs assigned. Click "+ Add Pack" to start.
          </p>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {assignments.map((a) => (
              <div
                key={a.id}
                className="inline-flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-lg text-xs"
                style={{ background: 'rgba(109,93,211,0.06)', border: '1px solid rgba(109,93,211,0.12)' }}
              >
                <span className="font-medium" style={{ color: '#1e1550' }}>{a.pack_name}</span>
                {a.pack_code && <span className="font-mono text-[10px]" style={{ color: '#a99fd8' }}>{a.pack_code}</span>}
                <button
                  type="button"
                  onClick={() => handleRemove(a.review_pack_id)}
                  disabled={isPending}
                  className="w-5 h-5 rounded flex items-center justify-center hover:bg-rose-100 disabled:opacity-50 transition-colors"
                  style={{ color: '#a99fd8' }}
                  title="Remove pack"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 2: Review History (Instances) ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: '#1e1550' }}>
            Review History ({reviewPacks.length})
          </h2>
          <Link
            href={`/reviews/${vendorId}`}
            className="text-xs font-semibold px-4 py-1.5 rounded-full text-white"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
          >
            Full Timeline →
          </Link>
        </div>

        {reviewPacks.length === 0 ? (
          <p className="text-xs py-3 px-4 rounded-lg" style={{ background: 'rgba(109,93,211,0.03)', color: '#8b7fd4' }}>
            No reviews yet. Create one from the{' '}
            <Link href="/reviews" className="underline" style={{ color: '#6c5dd3' }}>Reviews module</Link>.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {reviewPacks.map((pack) => {
              const counts = pack.item_counts ?? { total: 0, passed: 0, failed: 0, not_started: 0, na: 0 }
              const applicable = counts.total - counts.na
              const pct = applicable > 0 ? Math.round((counts.passed / applicable) * 100) : 0
              const sty = STATUS_STYLE[pack.status]
              return (
                <Link
                  key={pack.id}
                  href={`/vendors/${vendorId}/reviews/${pack.id}`}
                  className="block rounded-xl p-4 transition-all hover:-translate-y-0.5"
                  style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.05)' }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                      <span className="text-sm font-semibold" style={{ color: '#1e1550' }}>{pack.review_pack_name ?? 'Review'}</span>
                      {pack.review_type && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{
                          background: pack.review_type === 'onboarding' ? 'rgba(14,165,233,0.08)' : pack.review_type === 'scheduled' ? 'rgba(124,58,237,0.08)' : 'rgba(245,158,11,0.08)',
                          color: pack.review_type === 'onboarding' ? '#0284c7' : pack.review_type === 'scheduled' ? '#7c3aed' : '#d97706',
                        }}>{pack.review_type.replace('_', '-')}</span>
                      )}
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ml-2" style={{ background: sty.bg, color: sty.color }}>{sty.label}</span>
                  </div>
                  {applicable > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span style={{ color: '#8b7fd4' }}>{counts.passed} / {applicable}</span>
                        <span className="font-bold" style={{ color: pct === 100 ? '#059669' : '#6c5dd3' }}>{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(109,93,211,0.06)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? '#059669' : 'linear-gradient(90deg, #6c5dd3, #7c6be0)' }} />
                      </div>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
