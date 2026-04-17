'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { VendorReviewPackStatus } from '@/types/review-pack'

interface Props {
  vendorId: string
  packId: string
  status: VendorReviewPackStatus
  submitAction: (vendorId: string, vrpId: string) => Promise<{ success?: boolean; message?: string }>
  approveAction: (vendorId: string, vrpId: string, decision: 'approved' | 'approved_with_exception' | 'sent_back', comment: string | null) => Promise<{ success?: boolean; message?: string }>
}

export function JourneyCardActions({ vendorId, packId, status, submitAction, approveAction }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    startTransition(async () => {
      await submitAction(vendorId, packId)
      router.refresh()
    })
  }

  const handleApprove = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    startTransition(async () => {
      await approveAction(vendorId, packId, 'approved', null)
      router.refresh()
    })
  }

  if (status === 'in_progress' || status === 'sent_back') {
    return (
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="text-[11px] font-semibold px-3 py-1 rounded-full text-white disabled:opacity-50 shrink-0"
        style={{ background: '#6c5dd3' }}
      >
        {isPending ? '…' : 'Submit for Approval'}
      </button>
    )
  }

  if (status === 'awaiting_approval') {
    return (
      <button
        type="button"
        onClick={handleApprove}
        disabled={isPending}
        className="text-[11px] font-semibold px-3 py-1 rounded-full text-white disabled:opacity-50 shrink-0"
        style={{ background: '#059669' }}
      >
        {isPending ? '…' : 'Approve'}
      </button>
    )
  }

  return null
}
