'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

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
    reviewPackId: string
    reviewerUserId: string | null
    approverUserId: string | null
    dueAt: string | null
  }) => Promise<{ success?: boolean; vrpId?: string; message?: string }>
}

export function CreateReviewModal({ isOpen, onClose, vendors, packs, users, createAction }: Props) {
  const router = useRouter()
  const [vendorId, setVendorId] = useState('')
  const [packId, setPackId] = useState('')
  const [reviewerId, setReviewerId] = useState('')
  const [approverId, setApproverId] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleCreate = () => {
    if (!vendorId) { setError('Select a vendor'); return }
    if (!packId) { setError('Select a review pack'); return }
    setError(null)
    startTransition(async () => {
      const r = await createAction({
        vendorId,
        reviewPackId: packId,
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
        className="w-full max-w-lg rounded-2xl p-6 space-y-4"
        style={{ background: 'white', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-semibold" style={{ color: '#1e1550' }}>Create New Review</h3>
          <p className="text-xs mt-1" style={{ color: '#8b7fd4' }}>
            Start a manual review for a vendor against a specific review pack.
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
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6c5dd3' }}>
            Review Pack <span className="text-rose-500">*</span>
          </label>
          <select
            value={packId}
            onChange={(e) => setPackId(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
          >
            <option value="">Select pack…</option>
            {packs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ''}</option>
            ))}
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
            disabled={isPending}
            className="text-sm font-semibold px-5 py-2 rounded-full text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
          >
            {isPending ? 'Creating…' : 'Create Review'}
          </button>
        </div>
      </div>
    </div>
  )
}
