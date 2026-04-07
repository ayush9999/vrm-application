'use client'

import { useState, useTransition } from 'react'

interface Props {
  assessmentId: string
  assessmentTitle: string
  deleteAction: (id: string) => Promise<void>
}

export function DeleteAssessmentButton({ assessmentId, assessmentTitle, deleteAction }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      await deleteAction(assessmentId)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
        style={{ border: '1px solid rgba(225,29,72,0.25)', color: '#e11d48', background: 'rgba(225,29,72,0.04)' }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1.5 3h9M4.5 3V1.5h3V3M9.5 3l-.5 7.5h-6L2.5 3" />
          <path d="M5 5.5v3M7 5.5v3" />
        </svg>
        Delete
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,10,40,0.45)', backdropFilter: 'blur(2px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm"
            style={{ boxShadow: '0 20px 60px rgba(109,93,211,0.18)', border: '1px solid rgba(109,93,211,0.12)' }}
          >
            <div className="flex items-start gap-3 mb-4">
              <div
                className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(225,29,72,0.08)' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#e11d48" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 4h12M5.5 4V2.5h5V4M12.5 4l-.667 9.5H4.167L3.5 4" />
                  <path d="M6.5 7v4M9.5 7v4" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: '#1e1550' }}>Delete assessment?</p>
                <p className="text-xs mt-1" style={{ color: '#a99fd8' }}>
                  <span className="font-medium" style={{ color: '#6b5fa8' }}>&quot;{assessmentTitle}&quot;</span> will be permanently deleted.
                  This cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-70 disabled:opacity-40"
                style={{ color: '#a99fd8', border: '1px solid rgba(109,93,211,0.15)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)', boxShadow: '0 4px 12px rgba(225,29,72,0.3)' }}
              >
                {isPending ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
