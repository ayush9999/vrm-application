'use client'

import { useActionState, useState, useEffect } from 'react'
import type { AssessmentFramework } from '@/types/assessment'
import type { FormState } from '@/types/common'
import { Spinner } from '@/app/_components/Spinner'

const TYPE_LABEL: Record<string, string> = {
  compliance:      'Compliance',
  security:        'Security',
  risk_assessment: 'Risk',
  due_diligence:   'Due Diligence',
  financial:       'Financial',
  esg:             'ESG',
  custom:          'Custom',
}

const TYPE_COLOR: Record<string, string> = {
  compliance:      'bg-blue-50 text-blue-700',
  security:        'bg-violet-50 text-violet-700',
  risk_assessment: 'bg-amber-50 text-amber-700',
  due_diligence:   'bg-emerald-50 text-emerald-700',
  financial:       'bg-slate-100 text-slate-600',
  esg:             'bg-green-50 text-green-700',
  custom:          'bg-rose-50 text-rose-700',
}

interface Props {
  frameworks: AssessmentFramework[]
  selectedIds: Set<string>
  action: (prev: FormState, formData: FormData) => Promise<FormState>
}

export function FrameworkSelector({ frameworks, selectedIds, action }: Props) {
  const [editing, setEditing] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set(selectedIds))
  const [state, formAction, isPending] = useActionState(action, {})

  // Close edit mode automatically on successful save
  useEffect(() => {
    if (state.success) setEditing(false)
  }, [state.success])

  const activeFrameworks = frameworks.filter((f) => checked.has(f.id))

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleCancel() {
    setChecked(new Set(selectedIds))
    setEditing(false)
  }

  // ── View mode ───────────────────────────────────────────────
  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: '#1e1550' }}>
              {activeFrameworks.length > 0
                ? `${activeFrameworks.length} standard${activeFrameworks.length !== 1 ? 's' : ''} active`
                : 'No standards selected'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>
              These drive audit reporting and compliance alignment for your organisation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{
              background: 'rgba(109,93,211,0.08)',
              color: '#6c5dd3',
              border: '1px solid rgba(109,93,211,0.2)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 1.5a1.414 1.414 0 012 2L4 11H1.5v-2.5L9.5 1.5z"/>
            </svg>
            Edit
          </button>
        </div>

        {state.success && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-2.5 text-sm text-emerald-700">
            ✓ Saved successfully
          </div>
        )}

        {state.message && !state.success && (
          <div className="rounded-lg bg-rose-50 border border-rose-100 px-4 py-2.5 text-sm text-rose-600">
            {state.message}
          </div>
        )}

        {activeFrameworks.length === 0 ? (
          <div
            className="rounded-xl border-2 border-dashed p-8 text-center"
            style={{ borderColor: 'rgba(109,93,211,0.15)' }}
          >
            <p className="text-sm font-medium" style={{ color: '#6c5dd3' }}>No standards configured</p>
            <p className="text-xs mt-1" style={{ color: '#a99fd8' }}>
              Click Edit to select the compliance standards your organisation follows.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeFrameworks.map((fw) => {
              const typeKey = fw.framework_type ?? 'custom'
              const label = TYPE_LABEL[typeKey] ?? 'Custom'
              const color = TYPE_COLOR[typeKey] ?? TYPE_COLOR.custom

              return (
                <div
                  key={fw.id}
                  className="rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{ background: 'rgba(109,93,211,0.04)', border: '1px solid rgba(109,93,211,0.1)' }}
                >
                  <div className="shrink-0 w-2 h-2 rounded-full" style={{ background: '#6c5dd3' }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold" style={{ color: '#1e1550' }}>
                      {fw.name}
                      {fw.version && (
                        <span className="ml-1.5 text-xs font-normal" style={{ color: '#a99fd8' }}>
                          v{fw.version}
                        </span>
                      )}
                    </span>
                    {fw.description && (
                      <p className="text-xs mt-0.5 line-clamp-1" style={{ color: '#a99fd8' }}>{fw.description}</p>
                    )}
                  </div>
                  <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-md ${color}`}>
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Edit mode ───────────────────────────────────────────────
  return (
    <form action={formAction} className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: '#1e1550' }}>Select compliance standards</p>
          <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>{checked.size} selected</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{ color: '#a99fd8', border: '1px solid rgba(109,93,211,0.15)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-all hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)',
              boxShadow: '0 2px 8px rgba(108,93,211,0.25)',
            }}
          >
            {isPending && <Spinner />}
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {state.message && !state.success && (
        <div className="rounded-lg bg-rose-50 border border-rose-100 px-4 py-2.5 text-sm text-rose-600">
          {state.message}
        </div>
      )}

      <div className="space-y-2">
        {frameworks.map((fw) => {
          const isChecked = checked.has(fw.id)
          const typeKey = fw.framework_type ?? 'custom'
          const label = TYPE_LABEL[typeKey] ?? 'Custom'
          const color = TYPE_COLOR[typeKey] ?? TYPE_COLOR.custom

          return (
            <label
              key={fw.id}
              className="flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer"
              style={{
                border: `1px solid ${isChecked ? 'rgba(109,93,211,0.35)' : 'rgba(109,93,211,0.1)'}`,
                background: isChecked ? 'rgba(109,93,211,0.03)' : 'white',
              }}
            >
              <input
                type="checkbox"
                name="framework_ids"
                value={fw.id}
                checked={isChecked}
                onChange={() => toggle(fw.id)}
                className="h-4 w-4 rounded shrink-0"
                style={{ accentColor: '#6c5dd3' }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: '#1e1550' }}>{fw.name}</span>
                  {fw.version && (
                    <span className="text-xs font-mono" style={{ color: '#a99fd8' }}>v{fw.version}</span>
                  )}
                </div>
                {fw.description && (
                  <p className="text-xs mt-0.5 line-clamp-1" style={{ color: '#a99fd8' }}>{fw.description}</p>
                )}
              </div>
              <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-md ${color}`}>
                {label}
              </span>
            </label>
          )
        })}
      </div>
    </form>
  )
}
