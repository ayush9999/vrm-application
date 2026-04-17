'use client'

import { useState } from 'react'
import type { OrgUser } from '@/lib/db/organizations'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    reason: string
    expiryDate: string
    ownerUserId: string
    requiresCountersign: boolean
  }) => void
  isPending: boolean
  users: OrgUser[]
  itemName: string
  isRequired: boolean
}

export function ExceptionModal({
  isOpen,
  onClose,
  onSubmit,
  isPending,
  users,
  itemName,
  isRequired,
}: Props) {
  const [reason, setReason] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [ownerUserId, setOwnerUserId] = useState('')
  const [requiresCountersign, setRequiresCountersign] = useState(isRequired)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = () => {
    if (!reason.trim()) { setError('Reason is required'); return }
    if (!expiryDate) { setError('Expiry date is required'); return }
    if (!ownerUserId) { setError('Owner is required'); return }
    setError(null)
    onSubmit({ reason: reason.trim(), expiryDate, ownerUserId, requiresCountersign })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div
        className="w-full max-w-lg rounded-2xl p-6 space-y-4"
        style={{ background: 'white', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-semibold" style={{ color: '#1e1550' }}>Exception Approval</h3>
          <p className="text-xs mt-1" style={{ color: '#8b7fd4' }}>
            Approving an exception for: <span className="font-medium" style={{ color: '#1e1550' }}>{itemName}</span>
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6c5dd3' }}>
            Reason <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Why is this exception being granted? What risk is being accepted?"
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(108,93,211,0.15)]"
            style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6c5dd3' }}>
              Expiry Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
            />
            <p className="text-[10px] mt-1" style={{ color: '#8b7fd4' }}>How long is this exception valid?</p>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6c5dd3' }}>
              Exception Owner <span className="text-rose-500">*</span>
            </label>
            <select
              value={ownerUserId}
              onChange={(e) => setOwnerUserId(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
            >
              <option value="">Select owner…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name ?? u.email ?? u.id}</option>
              ))}
            </select>
            <p className="text-[10px] mt-1" style={{ color: '#8b7fd4' }}>Who monitors this exception?</p>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={requiresCountersign}
            onChange={(e) => setRequiresCountersign(e.target.checked)}
            className="h-4 w-4 rounded"
            style={{ accentColor: '#6c5dd3' }}
          />
          <span className="text-sm" style={{ color: '#4a4270' }}>
            Requires countersignature from approver
          </span>
        </label>

        {error && <p className="text-xs" style={{ color: '#e11d48' }}>{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2" style={{ borderTop: '1px solid rgba(109,93,211,0.08)' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-sm px-4 py-2 rounded-full"
            style={{ color: '#8b7fd4' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="text-sm font-semibold px-5 py-2 rounded-full text-white disabled:opacity-50"
            style={{ background: '#7c3aed' }}
          >
            {isPending ? 'Saving…' : 'Approve with Exception'}
          </button>
        </div>
      </div>
    </div>
  )
}
