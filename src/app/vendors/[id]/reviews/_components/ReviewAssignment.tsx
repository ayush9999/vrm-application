'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { OrgUser } from '@/lib/db/organizations'

interface Props {
  vendorId: string
  vendorReviewPackId: string
  currentReviewerId: string | null
  currentApproverId: string | null
  users: OrgUser[]
  assignAction: (
    vendorId: string,
    vendorReviewPackId: string,
    reviewerUserId: string | null,
    approverUserId: string | null,
  ) => Promise<{ success?: boolean; message?: string }>
}

export function ReviewAssignment({
  vendorId,
  vendorReviewPackId,
  currentReviewerId,
  currentApproverId,
  users,
  assignAction,
}: Props) {
  const router = useRouter()
  const [reviewer, setReviewer] = useState(currentReviewerId ?? '')
  const [approver, setApprover] = useState(currentApproverId ?? '')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const handleSave = () => {
    setMessage(null)
    startTransition(async () => {
      const r = await assignAction(vendorId, vendorReviewPackId, reviewer || null, approver || null)
      if (r.success) {
        setMessage('Saved')
        router.refresh()
      } else {
        setMessage(r.message ?? 'Failed')
      }
    })
  }

  const changed = reviewer !== (currentReviewerId ?? '') || approver !== (currentApproverId ?? '')

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <label className="flex items-center gap-1.5 text-xs">
        <span className="font-semibold" style={{ color: '#6c5dd3' }}>Reviewer:</span>
        <select
          value={reviewer}
          onChange={(e) => setReviewer(e.target.value)}
          className="rounded-lg px-2 py-1 text-xs"
          style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
        >
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name ?? u.email ?? u.id}</option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-xs">
        <span className="font-semibold" style={{ color: '#6c5dd3' }}>Approver:</span>
        <select
          value={approver}
          onChange={(e) => setApprover(e.target.value)}
          className="rounded-lg px-2 py-1 text-xs"
          style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
        >
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name ?? u.email ?? u.id}</option>
          ))}
        </select>
      </label>

      {changed && (
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="text-xs font-semibold px-3 py-1 rounded-full text-white disabled:opacity-50"
          style={{ background: '#6c5dd3' }}
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      )}

      {message && (
        <span className="text-[11px]" style={{ color: message === 'Saved' ? '#059669' : '#e11d48' }}>{message}</span>
      )}
    </div>
  )
}
