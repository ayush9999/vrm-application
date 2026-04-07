'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { VendorDispute, DisputeStatus } from '@/types/dispute'
import type { FormState } from '@/types/common'
import { Spinner } from '@/app/_components/Spinner'

const DISPUTE_STATUS_CONFIG: Record<DisputeStatus, { label: string; className: string }> = {
  open:         { label: 'Open',         className: 'bg-slate-100 text-slate-700' },
  under_review: { label: 'Under Review', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20' },
  resolved:     { label: 'Resolved',     className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' },
  rejected:     { label: 'Rejected',     className: 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20' },
}

function StatusButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 font-medium transition-colors disabled:opacity-50"
      style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#6b5fa8' }}
      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(109,93,211,0.04)'}
      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {pending && <Spinner />}
      {pending ? 'Updating…' : `Mark ${label}`}
    </button>
  )
}

const NEXT_STATUSES: Record<DisputeStatus, DisputeStatus[]> = {
  open:         ['under_review', 'rejected'],
  under_review: ['resolved', 'rejected'],
  resolved:     [],
  rejected:     [],
}

const inputCls =
  'w-full rounded-lg border border-[rgba(109,93,211,0.2)] bg-white px-3 py-2 text-sm text-[#1e1550] placeholder:text-[#c4bae8] shadow-sm focus:border-[#6c5dd3] focus:outline-none focus:ring-1 focus:ring-[#6c5dd3] transition-colors'
const labelCls = 'block text-xs font-semibold text-[#6b5fa8] mb-1'

interface DisputesTabProps {
  vendorId: string
  disputes: VendorDispute[]
  createDisputeAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  updateDisputeStatusAction: (vendorId: string, formData: FormData) => Promise<void>
}

export function DisputesTab({
  vendorId,
  disputes,
  createDisputeAction,
  updateDisputeStatusAction,
}: DisputesTabProps) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(createDisputeAction, {})
  const err = state.errors ?? {}

  useEffect(() => {
    if (state.success) router.refresh()
  }, [state.success, router])

  return (
    <div className="space-y-8">
      {/* Create dispute form */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: '#1e1550' }}>Raise a Dispute</h3>
        <form action={formAction} className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(109,93,211,0.03)', border: '1px solid rgba(109,93,211,0.1)' }}>
          {state.message && (
            <p className="text-xs text-rose-600 font-medium">{state.message}</p>
          )}
          {state.success && (
            <p className="text-xs text-emerald-600 font-medium">Dispute created.</p>
          )}

          <div>
            <label className={labelCls}>
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              name="title"
              type="text"
              placeholder="e.g. NDA not signed by counterparty"
              className={inputCls}
            />
            {err.title && <p className="mt-1 text-xs text-rose-600">{err.title[0]}</p>}
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              name="description"
              rows={3}
              placeholder="Provide additional context…"
              className={inputCls}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-1.5 justify-center rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-50 transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
          >
            {isPending && <Spinner />}
            {isPending ? 'Creating…' : 'Create Dispute'}
          </button>
        </form>
      </section>

      {/* Disputes list */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: '#1e1550' }}>
          Disputes ({disputes.length})
        </h3>

        {disputes.length === 0 ? (
          <div className="rounded-2xl px-6 py-14 text-center" style={{ border: '1.5px dashed rgba(109,93,211,0.2)' }}>
            <p className="text-sm font-medium" style={{ color: '#1e1550' }}>No disputes raised yet.</p>
            <p className="text-xs mt-1" style={{ color: '#a99fd8' }}>Use the form above to log a new dispute.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {disputes.map((d) => {
              const { label, className } = DISPUTE_STATUS_CONFIG[d.status]
              const nextStatuses = NEXT_STATUSES[d.status]
              const boundUpdate = updateDisputeStatusAction.bind(null, vendorId)

              return (
                <div key={d.id} className="rounded-2xl bg-white shadow-[0_2px_12px_rgba(109,93,211,0.08)] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#1e1550' }}>{d.title}</p>
                      {d.description && (
                        <p className="text-xs mt-1 leading-relaxed" style={{ color: '#4a4270' }}>{d.description}</p>
                      )}
                      <p className="text-xs mt-2" style={{ color: '#a99fd8' }}>
                        {new Date(d.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${className}`}>
                      {label}
                    </span>
                  </div>

                  {nextStatuses.length > 0 && (
                    <div className="mt-4 flex gap-2 pt-3 border-t" style={{ borderColor: 'rgba(109,93,211,0.08)' }}>
                      {nextStatuses.map((s) => (
                        <form key={s} action={boundUpdate}>
                          <input type="hidden" name="dispute_id" value={d.id} />
                          <input type="hidden" name="status" value={s} />
                          <StatusButton label={DISPUTE_STATUS_CONFIG[s].label} />
                        </form>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
