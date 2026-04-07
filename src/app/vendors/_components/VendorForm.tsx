'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useActionState } from 'react'
import Link from 'next/link'
import type { VendorCategory, VendorRow, VendorFormState } from '@/types/vendor'
import type { OrgUser } from '@/lib/db/organizations'
import type { AssessmentFramework } from '@/types/assessment'
import { COUNTRIES } from '@/lib/countries'
import { Spinner } from '@/app/_components/Spinner'

interface VendorFormProps {
  action: (prevState: VendorFormState, formData: FormData) => Promise<VendorFormState>
  categories: VendorCategory[]
  users: OrgUser[]
  defaultValues?: Partial<VendorRow>
  submitLabel?: string
  cancelHref: string
  /** If provided (create only), shows a Risk Frameworks selection section */
  allVrfs?: AssessmentFramework[]
  categoryVrfMap?: Record<string, string[]>
}

const INITIAL_STATE: VendorFormState = {}

const inputCls = 'w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(108,93,211,0.12)] focus:border-[#6c5dd3] transition-colors'
const inputStyle: React.CSSProperties = { border: '1px solid rgba(109,93,211,0.2)', background: 'white', color: '#1e1550' }
const labelStyle: React.CSSProperties = { color: '#3d2e8a' }
const fieldErrorCls = 'mt-1.5 text-xs text-rose-500'
const sectionStyle: React.CSSProperties = { color: '#a99fd8' }

export function VendorForm({
  action,
  categories,
  users,
  defaultValues = {},
  submitLabel = 'Save Vendor',
  cancelHref,
  allVrfs,
  categoryVrfMap,
}: VendorFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE)

  // Framework selection state (create-only — only present when allVrfs is provided)
  const [selectedCategoryId, setSelectedCategoryId] = useState(defaultValues.category_id ?? '')
  const prevAutoRef = useRef<string[]>([])
  const [checkedFrameworkIds, setCheckedFrameworkIds] = useState<Set<string>>(() => {
    if (!categoryVrfMap || !defaultValues.category_id) return new Set()
    const initial = categoryVrfMap[defaultValues.category_id] ?? []
    prevAutoRef.current = initial
    return new Set(initial)
  })

  useEffect(() => {
    if (!categoryVrfMap) return
    const newSuggested = categoryVrfMap[selectedCategoryId] ?? []
    const prevSuggested = prevAutoRef.current
    prevAutoRef.current = newSuggested
    setCheckedFrameworkIds((prev) => {
      const next = new Set(prev)
      for (const id of prevSuggested) next.delete(id)
      for (const id of newSuggested) next.add(id)
      return next
    })
  }, [selectedCategoryId, categoryVrfMap])

  const err = state.errors ?? {}

  return (
    <form action={formAction} className="space-y-8">
      {state.message && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 p-3.5 text-sm text-rose-600">
          {state.message}
        </div>
      )}

      {/* ── Identity ── */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-4 pt-2" style={sectionStyle}>Identity</p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className={defaultValues.vendor_code ? '' : 'sm:col-span-2'}>
            <label className="block text-sm font-medium mb-1.5" style={labelStyle}>
              Vendor Name <span className="text-rose-500">*</span>
            </label>
            <input
              name="name"
              type="text"
              defaultValue={defaultValues.name ?? ''}
              required
              placeholder="Acme Supplies Ltd."
              className={inputCls}
              style={inputStyle}
            />
            {err.name && <p className={fieldErrorCls}>{err.name[0]}</p>}
          </div>

          {defaultValues.vendor_code && (
            <div>
              <label className="block text-sm font-medium mb-1.5" style={labelStyle}>Vendor Code</label>
              <p
                className="px-3.5 py-2.5 rounded-xl text-sm font-mono select-all"
                style={{ background: 'rgba(109,93,211,0.05)', border: '1px solid rgba(109,93,211,0.15)', color: '#6b5fa8' }}
              >
                {defaultValues.vendor_code}
              </p>
              <p className="mt-1 text-xs" style={{ color: '#a99fd8' }}>Auto-generated · read-only</p>
            </div>
          )}

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1.5" style={labelStyle}>Legal Name</label>
            <input
              name="legal_name"
              type="text"
              defaultValue={defaultValues.legal_name ?? ''}
              placeholder="Acme Supplies Private Limited"
              className={inputCls}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* ── Classification ── */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-4 pt-2" style={sectionStyle}>Classification</p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={labelStyle}>Category</label>
            <select
              name="category_id"
              defaultValue={defaultValues.category_id ?? ''}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className={inputCls}
              style={inputStyle}
            >
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {err.category_id && <p className={fieldErrorCls}>{err.category_id[0]}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={labelStyle}>
              Status <span className="text-rose-500">*</span>
            </label>
            <select
              name="status"
              defaultValue={defaultValues.status ?? 'active'}
              className={inputCls}
              style={inputStyle}
            >
              <option value="active">Active</option>
              <option value="under_review">Under Review</option>
              <option value="suspended">Suspended</option>
            </select>
            {err.status && <p className={fieldErrorCls}>{err.status[0]}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={labelStyle}>Criticality Tier</label>
            <select
              name="criticality_tier"
              defaultValue={defaultValues.criticality_tier ?? ''}
              className={inputCls}
              style={inputStyle}
            >
              <option value="">— None —</option>
              <option value="1">1 — Low</option>
              <option value="2">2 — Medium</option>
              <option value="3">3 — High</option>
              <option value="4">4 — Critical</option>
              <option value="5">5 — Very Critical</option>
            </select>
            {err.criticality_tier && <p className={fieldErrorCls}>{err.criticality_tier[0]}</p>}
          </div>

          <div className="flex items-center gap-3 pt-6">
            <input id="is_critical" name="is_critical" type="hidden" value="false" />
            <input
              id="is_critical_check"
              name="is_critical"
              type="checkbox"
              value="true"
              defaultChecked={defaultValues.is_critical ?? false}
              className="h-4 w-4 rounded"
              style={{ accentColor: '#6c5dd3' }}
              onChange={(e) => {
                const hidden = e.currentTarget.form?.elements.namedItem(
                  'is_critical',
                ) as HTMLInputElement | null
                if (hidden) hidden.value = e.currentTarget.checked ? 'true' : 'false'
              }}
            />
            <label htmlFor="is_critical_check" className="text-sm font-medium" style={labelStyle}>
              Mark as Critical Vendor
            </label>
          </div>
        </div>
      </div>

      {/* ── Contact ── */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-4 pt-2" style={sectionStyle}>Contact</p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1.5" style={labelStyle}>Website URL</label>
            <input
              name="website_url"
              type="url"
              defaultValue={defaultValues.website_url ?? ''}
              placeholder="https://acme.com"
              className={inputCls}
              style={inputStyle}
            />
            {err.website_url && <p className={fieldErrorCls}>{err.website_url[0]}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={labelStyle}>Primary Email</label>
            <input
              name="primary_email"
              type="email"
              defaultValue={defaultValues.primary_email ?? ''}
              placeholder="contact@acme.com"
              className={inputCls}
              style={inputStyle}
            />
            {err.primary_email && <p className={fieldErrorCls}>{err.primary_email[0]}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={labelStyle}>Phone</label>
            <input
              name="phone"
              type="tel"
              defaultValue={defaultValues.phone ?? ''}
              placeholder="+1 555 000 0000"
              className={inputCls}
              style={inputStyle}
            />
            {err.phone && <p className={fieldErrorCls}>{err.phone[0]}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={labelStyle}>Country</label>
            <select
              name="country_code"
              defaultValue={defaultValues.country_code ?? ''}
              className={inputCls}
              style={inputStyle}
            >
              <option value="">— None —</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            {err.country_code && <p className={fieldErrorCls}>{err.country_code[0]}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={labelStyle}>Internal Owner</label>
            <select
              name="internal_owner_user_id"
              defaultValue={defaultValues.internal_owner_user_id ?? ''}
              className={inputCls}
              style={inputStyle}
            >
              <option value="">— Unassigned —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name && u.email
                    ? `${u.name} (${u.email})`
                    : u.name ?? u.email ?? u.id}
                </option>
              ))}
            </select>
            {err.internal_owner_user_id && (
              <p className={fieldErrorCls}>{err.internal_owner_user_id[0]}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Review ── */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-4 pt-2" style={sectionStyle}>Review</p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={labelStyle}>Next Review Due</label>
            <input
              name="next_review_due_at"
              type="date"
              defaultValue={
                defaultValues.next_review_due_at
                  ? defaultValues.next_review_due_at.split('T')[0]
                  : ''
              }
              className={inputCls}
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={labelStyle}>Last Reviewed</label>
            <input
              name="last_reviewed_at"
              type="date"
              defaultValue={
                defaultValues.last_reviewed_at
                  ? defaultValues.last_reviewed_at.split('T')[0]
                  : ''
              }
              className={inputCls}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* ── Notes ── */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-4 pt-2" style={sectionStyle}>Notes</p>
        <textarea
          name="notes"
          rows={4}
          defaultValue={defaultValues.notes ?? ''}
          placeholder="Any relevant notes about this vendor…"
          className={inputCls}
          style={inputStyle}
        />
      </div>

      {/* ── Risk Frameworks (create only) ── */}
      {allVrfs && allVrfs.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-1 pt-2" style={sectionStyle}>Risk Frameworks</p>
          <p className="text-xs mb-4" style={{ color: '#a99fd8' }}>
            Select which vendor risk frameworks apply to this vendor. Suggested ones are pre-selected based on category.
          </p>
          {/* Hidden inputs for checked IDs */}
          {[...checkedFrameworkIds].map((id) => (
            <input key={id} type="hidden" name="framework_ids" value={id} />
          ))}
          <div className="space-y-1">
            {(() => {
              const suggestedIds = new Set(categoryVrfMap?.[selectedCategoryId] ?? [])
              const suggested = allVrfs.filter((f) => suggestedIds.has(f.id))
              const others = allVrfs.filter((f) => !suggestedIds.has(f.id))
              return (
                <>
                  {suggested.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[11px] font-medium mb-2" style={{ color: '#a99fd8' }}>Suggested for this category</p>
                      {suggested.map((f) => (
                        <label
                          key={f.id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-violet-50 transition-colors"
                          style={{ border: '1px solid rgba(109,93,211,0.15)', marginBottom: '4px', background: checkedFrameworkIds.has(f.id) ? 'rgba(109,93,211,0.06)' : 'white' }}
                        >
                          <input
                            type="checkbox"
                            checked={checkedFrameworkIds.has(f.id)}
                            onChange={(e) => {
                              setCheckedFrameworkIds((prev) => {
                                const next = new Set(prev)
                                e.target.checked ? next.add(f.id) : next.delete(f.id)
                                return next
                              })
                            }}
                            className="h-4 w-4 rounded"
                            style={{ accentColor: '#6c5dd3' }}
                          />
                          <span className="flex-1 text-sm font-medium" style={{ color: '#1e1550' }}>{f.name}</span>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3' }}>
                            Recommended
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  {others.length > 0 && (
                    <div>
                      {suggested.length > 0 && (
                        <p className="text-[11px] font-medium mb-2 mt-3" style={{ color: '#a99fd8' }}>Other frameworks</p>
                      )}
                      {others.map((f) => (
                        <label
                          key={f.id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-[rgba(109,93,211,0.05)] transition-colors"
                          style={{ border: '1px solid rgba(109,93,211,0.1)', marginBottom: '4px', background: checkedFrameworkIds.has(f.id) ? 'rgba(109,93,211,0.04)' : 'white' }}
                        >
                          <input
                            type="checkbox"
                            checked={checkedFrameworkIds.has(f.id)}
                            onChange={(e) => {
                              setCheckedFrameworkIds((prev) => {
                                const next = new Set(prev)
                                e.target.checked ? next.add(f.id) : next.delete(f.id)
                                return next
                              })
                            }}
                            className="h-4 w-4 rounded"
                            style={{ accentColor: '#6c5dd3' }}
                          />
                          <span className="text-sm" style={{ color: '#1e1550' }}>{f.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {suggested.length === 0 && others.length === 0 && (
                    <p className="text-sm" style={{ color: '#a99fd8' }}>No risk frameworks available.</p>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid rgba(109,93,211,0.1)' }}>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 justify-center rounded-full px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50 transition-all hover:opacity-90"
          style={{
            background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)',
            boxShadow: '0 4px 12px rgba(108,93,211,0.3)',
          }}
        >
          {isPending && <Spinner />}
          {isPending ? 'Saving…' : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="text-sm transition-colors hover:opacity-70"
          style={{ color: '#a99fd8' }}
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
