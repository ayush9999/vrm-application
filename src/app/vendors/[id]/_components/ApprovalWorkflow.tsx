'use client'

import { useState, useTransition } from 'react'
import type { VendorApprovalStatus } from '@/types/vendor'

const FLOW: { value: VendorApprovalStatus; label: string; color: string; bg: string }[] = [
  { value: 'draft',                   label: 'Draft',                color: '#64748b', bg: 'rgba(148,163,184,0.15)' },
  { value: 'waiting_on_vendor',       label: 'Waiting on Vendor',    color: '#d97706', bg: 'rgba(245,158,11,0.1)' },
  { value: 'in_internal_review',      label: 'In Internal Review',   color: '#0284c7', bg: 'rgba(14,165,233,0.1)' },
  { value: 'approved',                label: 'Approved',             color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  { value: 'approved_with_exception', label: 'Approved (Exception)', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  { value: 'blocked',                 label: 'Blocked',              color: '#e11d48', bg: 'rgba(225,29,72,0.1)' },
  { value: 'suspended',               label: 'Suspended',            color: '#e11d48', bg: 'rgba(225,29,72,0.1)' },
  { value: 'offboarded',              label: 'Offboarded',           color: '#64748b', bg: 'rgba(148,163,184,0.15)' },
]

interface Props {
  vendorId: string
  currentStatus: VendorApprovalStatus
  approvedAt: string | null
  exceptionReason: string | null
  updateAction: (
    vendorId: string,
    newStatus: VendorApprovalStatus,
    exceptionReason?: string,
  ) => Promise<{ message?: string; success?: boolean }>
}

export function ApprovalWorkflow({ vendorId, currentStatus, approvedAt, exceptionReason, updateAction }: Props) {
  const [isPending, startTransition] = useTransition()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [showExceptionField, setShowExceptionField] = useState(false)
  const [exceptionInput, setExceptionInput] = useState(exceptionReason ?? '')
  const [error, setError] = useState<string | null>(null)

  const current = FLOW.find((f) => f.value === currentStatus) ?? FLOW[0]

  const handleSet = (status: VendorApprovalStatus) => {
    setError(null)
    if (status === 'approved_with_exception') {
      setShowExceptionField(true)
      setPickerOpen(false)
      return
    }
    setPickerOpen(false)
    startTransition(async () => {
      const result = await updateAction(vendorId, status)
      if (!result.success) setError(result.message ?? 'Failed to update')
    })
  }

  const submitException = () => {
    if (!exceptionInput.trim()) {
      setError('Exception reason is required')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await updateAction(vendorId, 'approved_with_exception', exceptionInput.trim())
      if (!result.success) setError(result.message ?? 'Failed to update')
      else setShowExceptionField(false)
    })
  }

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
            Approval Status
          </h3>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            disabled={isPending}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.12)' }}
          >
            {isPending ? 'Updating…' : 'Change Status'}
          </button>
          {pickerOpen && (
            <div
              className="absolute right-0 top-full mt-1 z-10 rounded-xl overflow-hidden min-w-[240px]"
              style={{ background: 'white', border: '1px solid rgba(109,93,211,0.15)', boxShadow: '0 4px 16px rgba(109,93,211,0.15)' }}
            >
              {FLOW.filter((f) => f.value !== currentStatus).map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => handleSet(f.value)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[rgba(109,93,211,0.04)] transition-colors"
                  style={{ color: '#1e1550' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: f.color }} />
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center text-xs px-2.5 py-1 rounded-full font-semibold"
          style={{ background: current.bg, color: current.color }}
        >
          {current.label}
        </span>
        {approvedAt && (
          <span className="text-[11px]" style={{ color: '#a99fd8' }}>
            since {new Date(approvedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Exception reason display */}
      {currentStatus === 'approved_with_exception' && exceptionReason && !showExceptionField && (
        <div
          className="mt-3 px-3 py-2 rounded-lg text-xs"
          style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.15)' }}
        >
          <span className="font-bold uppercase tracking-widest text-[10px]" style={{ color: '#7c3aed' }}>Exception:</span>
          <p className="mt-0.5" style={{ color: '#4a4270' }}>{exceptionReason}</p>
        </div>
      )}

      {/* Exception input */}
      {showExceptionField && (
        <div className="mt-3 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
            Exception Reason (required)
          </label>
          <textarea
            value={exceptionInput}
            onChange={(e) => setExceptionInput(e.target.value)}
            rows={2}
            placeholder="Why is this approval being granted with an exception?"
            className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[rgba(108,93,211,0.12)]"
            style={{ border: '1px solid rgba(109,93,211,0.2)', background: 'white', color: '#1e1550' }}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={submitException}
              disabled={isPending}
              className="text-xs font-semibold px-3 py-1.5 rounded-full text-white disabled:opacity-50"
              style={{ background: '#7c3aed' }}
            >
              {isPending ? 'Saving…' : 'Approve with Exception'}
            </button>
            <button
              type="button"
              onClick={() => { setShowExceptionField(false); setError(null) }}
              className="text-xs px-3 py-1.5 rounded-full"
              style={{ color: '#a99fd8' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs" style={{ color: '#e11d48' }}>{error}</p>
      )}
    </div>
  )
}
