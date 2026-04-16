'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { VendorApprovalStatus } from '@/types/vendor'
import { updateApprovalStatusAction } from '@/app/vendors/actions'

const FLOW: { value: VendorApprovalStatus; label: string }[] = [
  { value: 'draft',                   label: 'Draft' },
  { value: 'waiting_on_vendor',       label: 'Waiting on Vendor' },
  { value: 'in_internal_review',      label: 'In Internal Review' },
  { value: 'approved',                label: 'Approved' },
  { value: 'approved_with_exception', label: 'Approved with Exception' },
  { value: 'blocked',                 label: 'Blocked' },
  { value: 'suspended',               label: 'Suspended' },
  { value: 'offboarded',              label: 'Offboarded' },
]

export function QuickApprovalMenu({
  vendorId,
  current,
}: {
  vendorId: string
  current: VendorApprovalStatus
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSet = (status: VendorApprovalStatus) => {
    setOpen(false)
    if (status === 'approved_with_exception') {
      const reason = prompt('Exception reason (required):')
      if (!reason?.trim()) return
      startTransition(async () => {
        await updateApprovalStatusAction(vendorId, status, reason.trim())
        router.refresh()
      })
      return
    }
    startTransition(async () => {
      await updateApprovalStatusAction(vendorId, status)
      router.refresh()
    })
  }

  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          setOpen((v) => !v)
        }}
        disabled={isPending}
        className="opacity-60 hover:opacity-100 transition-opacity p-1 rounded"
        aria-label="Change approval status"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ color: '#6c5dd3' }}>
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="13" cy="8" r="1.5" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-10 rounded-xl overflow-hidden min-w-[220px]"
          style={{
            background: 'white',
            border: '1px solid rgba(109,93,211,0.15)',
            boxShadow: '0 4px 16px rgba(109,93,211,0.15)',
          }}
        >
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8', borderBottom: '1px solid rgba(109,93,211,0.06)' }}>
            Set approval status
          </div>
          {FLOW.filter((f) => f.value !== current).map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={(e) => {
                e.preventDefault()
                handleSet(f.value)
              }}
              className="w-full text-left text-xs px-3 py-2 hover:bg-[rgba(109,93,211,0.04)] transition-colors"
              style={{ color: '#1e1550' }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
