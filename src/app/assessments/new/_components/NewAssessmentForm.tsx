'use client'

import React, { useState } from 'react'
import { useActionState } from 'react'
import type { Vendor } from '@/types/vendor'
import type { AssessmentFramework, AssessmentFormState } from '@/types/assessment'
import { Spinner } from '@/app/_components/Spinner'

const inputCls = 'w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(108,93,211,0.12)] focus:border-[#6c5dd3] transition-colors'
const inputStyle: React.CSSProperties = { border: '1px solid rgba(109,93,211,0.2)', background: 'white', color: '#1e1550' }
const labelStyle: React.CSSProperties = { color: '#3d2e8a' }
const sectionStyle: React.CSSProperties = { color: '#a99fd8' }

interface Props {
  action: (prev: AssessmentFormState, formData: FormData) => Promise<AssessmentFormState>
  vendors: Vendor[]
  frameworks: AssessmentFramework[]
  primaryFrameworkId: string | null
}

const INITIAL: AssessmentFormState = {}

export function NewAssessmentForm({ action, vendors, frameworks, primaryFrameworkId }: Props) {
  const [state, formAction, isPending] = useActionState(action, INITIAL)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(primaryFrameworkId ? [primaryFrameworkId] : []),
  )

  function toggle(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 p-3.5 text-sm text-rose-600">
          {state.message}
        </div>
      )}

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={sectionStyle}>Assessment Setup</p>
        <div className="space-y-4">

          <div>
            <label className="block text-sm font-medium mb-1.5" style={labelStyle}>
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              name="title"
              type="text"
              required
              placeholder="e.g. Q1 2025 Risk Review — Acme Supplies"
              className={inputCls}
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={labelStyle}>
              Vendor <span className="text-rose-500">*</span>
            </label>
            <select name="vendor_id" required className={inputCls} style={inputStyle}>
              <option value="">— Select vendor —</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}{v.vendor_code ? ` (${v.vendor_code})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={labelStyle}>
              Frameworks
              <span className="ml-1.5 text-[11px] font-normal" style={{ color: '#a99fd8' }}>
                (select one or more)
              </span>
            </label>

            {/* Hidden inputs — one per selected framework */}
            {Array.from(selectedIds).map(id => (
              <input key={id} type="hidden" name="framework_ids" value={id} />
            ))}

            {frameworks.length === 0 ? (
              <p className="text-sm py-3" style={{ color: '#a99fd8' }}>No frameworks available.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {frameworks.map(f => {
                  const checked = selectedIds.has(f.id)
                  return (
                    <label
                      key={f.id}
                      className="flex items-start gap-3 rounded-xl px-4 py-3 cursor-pointer transition-all"
                      style={{
                        border: checked ? '1.5px solid #6c5dd3' : '1px solid rgba(109,93,211,0.18)',
                        background: checked ? 'rgba(109,93,211,0.06)' : 'white',
                      }}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggle(f.id)}
                      />
                      {/* Custom checkbox */}
                      <span
                        className="w-4 h-4 rounded flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                        style={{
                          border: checked ? 'none' : '1.5px solid rgba(109,93,211,0.35)',
                          background: checked ? '#6c5dd3' : 'white',
                        }}
                      >
                        {checked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium" style={{ color: '#1e1550' }}>
                          {f.name}
                          {f.version ? ` v${f.version}` : ''}
                        </span>
                        {f.description && (
                          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: '#a99fd8' }}>{f.description}</p>
                        )}
                      </div>
                      {checked && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                          style={{ background: 'rgba(109,93,211,0.12)', color: '#6c5dd3' }}
                        >
                          Selected
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            )}
            <p className="text-xs mt-1.5" style={{ color: '#a99fd8' }}>
              Review items are created for each selected framework.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={labelStyle}>Period Type</label>
              <select name="period_type" className={inputCls} style={inputStyle}>
                <option value="">— Select —</option>
                <option value="annual">Annual</option>
                <option value="semiannual">Semi-Annual</option>
                <option value="quarterly">Quarterly</option>
                <option value="monthly">Monthly</option>
                <option value="ad_hoc">Ad Hoc</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={labelStyle}>Period Start</label>
              <input name="period_start" type="date" className={inputCls} style={inputStyle} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={labelStyle}>Description</label>
            <textarea
              name="description"
              rows={3}
              placeholder="Scope, context or any additional notes about this assessment…"
              className={inputCls}
              style={inputStyle}
            />
          </div>

        </div>
      </div>

      <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid rgba(109,93,211,0.1)' }}>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 justify-center rounded-full px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50 transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 4px 12px rgba(108,93,211,0.3)' }}
        >
          {isPending && <Spinner />}
          {isPending ? 'Creating…' : 'Create Assessment →'}
        </button>
        <a href="/assessments" className="text-sm transition-colors hover:opacity-70" style={{ color: '#a99fd8' }}>
          Cancel
        </a>
      </div>
    </form>
  )
}
