'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ReviewType } from '@/types/review-pack'

interface Vendor { id: string; name: string; vendor_code: string | null }
interface Pack { id: string; name: string; code: string | null }
interface User { id: string; name: string | null; email: string | null }

interface Props {
  isOpen: boolean
  onClose: () => void
  vendors: Vendor[]
  packs: Pack[]
  users: User[]
  createAction: (input: {
    vendorId: string
    packIds: string[]
    reviewType?: ReviewType
    reviewerUserId: string | null
    approverUserId: string | null
    dueAt: string | null
  }) => Promise<{ success?: boolean; reviewId?: string; message?: string }>
}

export function CreateReviewModal({ isOpen, onClose, vendors, packs, users, createAction }: Props) {
  const router = useRouter()
  const [vendorId, setVendorId] = useState('')
  const [selectedPacks, setSelectedPacks] = useState<Set<string>>(new Set())
  const [reviewType, setReviewType] = useState<ReviewType>('on_demand')
  const [reviewerId, setReviewerId] = useState('')
  const [approverId, setApproverId] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const togglePack = (packId: string) => {
    setSelectedPacks((prev) => {
      const next = new Set(prev)
      if (next.has(packId)) next.delete(packId)
      else next.add(packId)
      return next
    })
  }

  const selectAll = () => setSelectedPacks(new Set(packs.map((p) => p.id)))
  const selectNone = () => setSelectedPacks(new Set())

  const handleCreate = () => {
    if (!vendorId) { setError('Select a vendor'); return }
    if (selectedPacks.size === 0) { setError('Select at least one review pack'); return }
    setError(null)
    startTransition(async () => {
      const r = await createAction({
        vendorId,
        packIds: Array.from(selectedPacks),
        reviewType,
        reviewerUserId: reviewerId || null,
        approverUserId: approverId || null,
        dueAt: dueAt || null,
      })
      if (r.success) {
        onClose()
        router.push(`/reviews/${vendorId}`)
      } else {
        setError(r.message ?? 'Failed')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div
        className="w-full max-w-lg rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ background: 'white', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-semibold" style={{ color: '#1e1550' }}>Create New Review</h3>
          <p className="text-xs mt-1" style={{ color: '#8b7fd4' }}>
            Start a review for a vendor with one or more review packs.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6c5dd3' }}>
            Vendor <span className="text-rose-500">*</span>
          </label>
          <select
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
          >
            <option value="">Select vendor…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}{v.vendor_code ? ` (${v.vendor_code})` : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6c5dd3' }}>
              Review Packs <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={selectAll} className="text-[10px] font-medium" style={{ color: '#6c5dd3' }}>Select all</button>
              <button type="button" onClick={selectNone} className="text-[10px] font-medium" style={{ color: '#a99fd8' }}>Clear</button>
            </div>
          </div>
          <div
            className="rounded-lg p-2 space-y-0.5 max-h-40 overflow-y-auto"
            style={{ border: '1px solid rgba(109,93,211,0.15)', background: 'rgba(109,93,211,0.02)' }}
          >
            {packs.map((p) => (
              <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-white transition-colors">
                <input
                  type="checkbox"
                  checked={selectedPacks.has(p.id)}
                  onChange={() => togglePack(p.id)}
                  className="w-3.5 h-3.5 rounded"
                  style={{ accentColor: '#6c5dd3' }}
                />
                <span className="text-sm" style={{ color: '#1e1550' }}>{p.name}</span>
                {p.code && <span className="text-[10px] font-mono" style={{ color: '#a99fd8' }}>{p.code}</span>}
              </label>
            ))}
          </div>
          <p className="text-[10px] mt-1" style={{ color: '#a99fd8' }}>
            {selectedPacks.size} pack{selectedPacks.size !== 1 ? 's' : ''} selected
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6c5dd3' }}>Review Type</label>
          <select
            value={reviewType}
            onChange={(e) => setReviewType(e.target.value as ReviewType)}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
          >
            <option value="on_demand">On Demand</option>
            <option value="scheduled">Scheduled</option>
            <option value="onboarding">Onboarding</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6c5dd3' }}>Reviewer</label>
            <select value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}>
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6c5dd3' }}>Approver</label>
            <select value={approverId} onChange={(e) => setApproverId(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}>
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6c5dd3' }}>Due Date</label>
          <input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
          />
        </div>

        {error && <p className="text-xs" style={{ color: '#e11d48' }}>{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2" style={{ borderTop: '1px solid rgba(109,93,211,0.08)' }}>
          <button type="button" onClick={onClose} disabled={isPending} className="text-sm px-4 py-2 rounded-full" style={{ color: '#8b7fd4' }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending || selectedPacks.size === 0}
            className="text-sm font-semibold px-5 py-2 rounded-full text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
          >
            {isPending ? 'Creating…' : `Create Review (${selectedPacks.size} pack${selectedPacks.size !== 1 ? 's' : ''})`}
          </button>
        </div>
      </div>
    </div>
  )
}
