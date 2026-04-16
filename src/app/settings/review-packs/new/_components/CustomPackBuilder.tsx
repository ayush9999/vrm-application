'use client'

import { useState, useTransition } from 'react'
import type { ApplicabilityRules, VendorServiceType, VendorDataAccessLevel } from '@/types/review-pack'

const inputCls = 'w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(108,93,211,0.12)]'
const inputStyle = { border: '1px solid rgba(109,93,211,0.2)', background: 'white', color: '#1e1550' }
const labelStyle = { color: '#6c5dd3' }

interface EvidenceInput {
  name: string
  description: string
  required: boolean
  expiry_applies: boolean
}

interface ComplianceRef {
  standard: string
  reference: string
}

interface ReviewInput {
  name: string
  description: string
  required: boolean
  creates_remediation_on_fail: boolean
  linked_evidence_index: number | null
  compliance_references: ComplianceRef[]
}

interface Props {
  createAction: (input: {
    name: string
    description: string | null
    applicability_rules: ApplicabilityRules
    review_cadence: 'annual' | 'biannual' | 'on_incident' | 'on_renewal'
    evidence_requirements: { name: string; description?: string | null; required: boolean; expiry_applies: boolean }[]
    review_requirements: {
      name: string
      description?: string | null
      required: boolean
      creates_remediation_on_fail: boolean
      linked_evidence_index?: number | null
      compliance_references?: { standard: string; reference: string }[]
    }[]
  }) => Promise<{ message?: string; packId?: string }>
}

export function CustomPackBuilder({ createAction }: Props) {
  // Pack-level
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [cadence, setCadence] = useState<'annual' | 'biannual' | 'on_incident' | 'on_renewal'>('annual')

  // Applicability rules
  const [always, setAlways] = useState(false)
  const [processesPersonalData, setProcessesPersonalData] = useState(false)
  const [requiresEsg, setRequiresEsg] = useState(false)
  const [minCriticalityTier, setMinCriticalityTier] = useState('')
  const [serviceTypes, setServiceTypes] = useState<Set<VendorServiceType>>(new Set())
  const [dataAccessLevels, setDataAccessLevels] = useState<Set<VendorDataAccessLevel>>(new Set())

  // Sub-items
  const [evidence, setEvidence] = useState<EvidenceInput[]>([])
  const [reviews, setReviews] = useState<ReviewInput[]>([])

  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const toggleSet = <T,>(s: Set<T>, v: T): Set<T> => {
    const n = new Set(s)
    if (n.has(v)) n.delete(v)
    else n.add(v)
    return n
  }

  const addEvidence = () => setEvidence((e) => [...e, { name: '', description: '', required: true, expiry_applies: false }])
  const removeEvidence = (i: number) => {
    setEvidence((e) => e.filter((_, idx) => idx !== i))
    // Also clear any review's link to this index, and shift indices > i down by 1
    setReviews((rs) => rs.map((r) => {
      if (r.linked_evidence_index === null) return r
      if (r.linked_evidence_index === i) return { ...r, linked_evidence_index: null }
      if (r.linked_evidence_index > i) return { ...r, linked_evidence_index: r.linked_evidence_index - 1 }
      return r
    }))
  }
  const updateEvidence = (i: number, patch: Partial<EvidenceInput>) => {
    setEvidence((e) => e.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
  }

  const addReview = () => setReviews((r) => [...r, { name: '', description: '', required: true, creates_remediation_on_fail: false, linked_evidence_index: null, compliance_references: [] }])
  const removeReview = (i: number) => setReviews((r) => r.filter((_, idx) => idx !== i))
  const updateReview = (i: number, patch: Partial<ReviewInput>) => {
    setReviews((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
  }

  const handleSubmit = () => {
    setError(null)
    if (!name.trim()) { setError('Pack name is required'); return }
    if (evidence.some((e) => !e.name.trim())) { setError('All evidence requirements need a name'); return }
    if (reviews.some((r) => !r.name.trim())) { setError('All review items need a name'); return }

    const rules: ApplicabilityRules = {}
    if (always) rules.always = true
    if (processesPersonalData) rules.processes_personal_data = true
    if (requiresEsg) rules.requires_esg_setting = true
    if (minCriticalityTier) rules.min_criticality_tier = parseInt(minCriticalityTier, 10)
    if (serviceTypes.size > 0) rules.service_types = Array.from(serviceTypes)
    if (dataAccessLevels.size > 0) rules.data_access_levels = Array.from(dataAccessLevels)

    startTransition(async () => {
      const r = await createAction({
        name,
        description: description || null,
        applicability_rules: rules,
        review_cadence: cadence,
        evidence_requirements: evidence.map((e) => ({
          name: e.name.trim(),
          description: e.description || null,
          required: e.required,
          expiry_applies: e.expiry_applies,
        })),
        review_requirements: reviews.map((r) => ({
          name: r.name.trim(),
          description: r.description || null,
          required: r.required,
          creates_remediation_on_fail: r.creates_remediation_on_fail,
          linked_evidence_index: r.linked_evidence_index,
          compliance_references: r.compliance_references.filter((c) => c.standard.trim() && c.reference.trim()),
        })),
      })
      if (r.message) setError(r.message)
      // On success the action redirects, so we won't get here
    })
  }

  return (
    <div className="space-y-5">
      {/* Pack basics */}
      <Section title="Pack Basics">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase mb-1.5" style={labelStyle}>Pack Name *</label>
            <input className={inputCls} style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Software Vendor Onboarding" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase mb-1.5" style={labelStyle}>Description</label>
            <textarea rows={2} className={inputCls} style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this pack cover?" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase mb-1.5" style={labelStyle}>Review Cadence</label>
            <select className={inputCls} style={inputStyle} value={cadence} onChange={(e) => setCadence(e.target.value as 'annual' | 'biannual' | 'on_incident' | 'on_renewal')}>
              <option value="annual">Annual</option>
              <option value="biannual">Biannual</option>
              <option value="on_renewal">On Renewal</option>
              <option value="on_incident">On Incident</option>
            </select>
          </div>
        </div>
      </Section>

      {/* Applicability */}
      <Section title="Auto-Apply Rules" subtitle="Choose which vendors get this pack automatically. Leave all blank for manual-only assignment.">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={always} onChange={(e) => setAlways(e.target.checked)} className="h-4 w-4 rounded" style={{ accentColor: '#6c5dd3' }} />
            <span style={{ color: '#1e1550' }}>Always assign to every vendor</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={processesPersonalData} onChange={(e) => setProcessesPersonalData(e.target.checked)} className="h-4 w-4 rounded" style={{ accentColor: '#6c5dd3' }} />
            <span style={{ color: '#1e1550' }}>Vendor processes personal data</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={requiresEsg} onChange={(e) => setRequiresEsg(e.target.checked)} className="h-4 w-4 rounded" style={{ accentColor: '#6c5dd3' }} />
            <span style={{ color: '#1e1550' }}>Org has ESG enabled (Settings → Company Profile)</span>
          </label>

          <div className="pt-2">
            <label className="block text-xs font-semibold uppercase mb-1.5" style={labelStyle}>Min Criticality Tier (apply if vendor tier ≤ this)</label>
            <select className={inputCls + ' max-w-xs'} style={inputStyle} value={minCriticalityTier} onChange={(e) => setMinCriticalityTier(e.target.value)}>
              <option value="">— Not used —</option>
              <option value="1">1 (only Tier 1)</option>
              <option value="2">2 (Tier 1 or 2)</option>
              <option value="3">3 (Tier 1–3)</option>
            </select>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-semibold uppercase mb-1.5" style={labelStyle}>Service Types (any-match)</label>
            <div className="flex flex-wrap gap-2">
              {(['saas', 'contractor', 'supplier', 'logistics', 'professional_services', 'other'] as VendorServiceType[]).map((s) => (
                <Chip key={s} active={serviceTypes.has(s)} onClick={() => setServiceTypes(toggleSet(serviceTypes, s))}>{s.replace(/_/g, ' ')}</Chip>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-semibold uppercase mb-1.5" style={labelStyle}>Data Access Levels (any-match)</label>
            <div className="flex flex-wrap gap-2">
              {(['none', 'internal_only', 'personal_data', 'sensitive_personal_data', 'financial_data'] as VendorDataAccessLevel[]).map((s) => (
                <Chip key={s} active={dataAccessLevels.has(s)} onClick={() => setDataAccessLevels(toggleSet(dataAccessLevels, s))}>{s.replace(/_/g, ' ')}</Chip>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Evidence */}
      <Section title={`Evidence Requirements (${evidence.length})`} subtitle="Documents the vendor must upload.">
        {evidence.map((e, i) => (
          <div key={i} className="rounded-xl p-3 mb-2" style={{ background: 'rgba(108,93,211,0.04)', border: '1px solid rgba(108,93,211,0.1)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input className={inputCls} style={inputStyle} value={e.name} onChange={(ev) => updateEvidence(i, { name: ev.target.value })} placeholder="Evidence name (e.g. Signed NDA)" />
              <div className="flex items-center gap-2 sm:gap-4">
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={e.required} onChange={(ev) => updateEvidence(i, { required: ev.target.checked })} className="h-3.5 w-3.5 rounded" style={{ accentColor: '#6c5dd3' }} />
                  <span style={{ color: '#4a4270' }}>Required</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={e.expiry_applies} onChange={(ev) => updateEvidence(i, { expiry_applies: ev.target.checked })} className="h-3.5 w-3.5 rounded" style={{ accentColor: '#6c5dd3' }} />
                  <span style={{ color: '#4a4270' }}>Has expiry</span>
                </label>
                <button type="button" onClick={() => removeEvidence(i)} className="ml-auto text-xs px-2 py-1 rounded" style={{ color: '#e11d48' }}>Remove</button>
              </div>
              <input className={inputCls + ' sm:col-span-2'} style={inputStyle} value={e.description} onChange={(ev) => updateEvidence(i, { description: ev.target.value })} placeholder="Description (optional)" />
            </div>
          </div>
        ))}
        <button type="button" onClick={addEvidence} className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: 'rgba(108,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(108,93,211,0.15)' }}>
          + Add Evidence Requirement
        </button>
      </Section>

      {/* Review items */}
      <Section title={`Review Items (${reviews.length})`} subtitle="Questions the reviewer answers about this vendor.">
        {reviews.map((r, i) => (
          <div key={i} className="rounded-xl p-3 mb-2" style={{ background: 'rgba(108,93,211,0.04)', border: '1px solid rgba(108,93,211,0.1)' }}>
            <div className="space-y-2">
              <input className={inputCls} style={inputStyle} value={r.name} onChange={(ev) => updateReview(i, { name: ev.target.value })} placeholder="Review item (e.g. Is the contract signed?)" />
              <textarea rows={2} className={inputCls} style={inputStyle} value={r.description} onChange={(ev) => updateReview(i, { description: ev.target.value })} placeholder="What does passing look like?" />
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={r.required} onChange={(ev) => updateReview(i, { required: ev.target.checked })} className="h-3.5 w-3.5 rounded" style={{ accentColor: '#6c5dd3' }} />
                  <span style={{ color: '#4a4270' }}>Required</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={r.creates_remediation_on_fail} onChange={(ev) => updateReview(i, { creates_remediation_on_fail: ev.target.checked })} className="h-3.5 w-3.5 rounded" style={{ accentColor: '#6c5dd3' }} />
                  <span style={{ color: '#4a4270' }}>Auto-create Remediation on Fail</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <span style={{ color: '#4a4270' }}>Linked evidence:</span>
                  <select
                    className="rounded px-2 py-0.5 text-xs"
                    style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
                    value={r.linked_evidence_index ?? ''}
                    onChange={(ev) => updateReview(i, { linked_evidence_index: ev.target.value === '' ? null : parseInt(ev.target.value, 10) })}
                  >
                    <option value="">— None —</option>
                    {evidence.map((e, idx) => (
                      <option key={idx} value={idx}>{e.name || `Evidence #${idx + 1}`}</option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={() => removeReview(i)} className="ml-auto text-xs px-2 py-1 rounded" style={{ color: '#e11d48' }}>Remove</button>
              </div>

              {/* Compliance references */}
              <div className="pt-2 border-t" style={{ borderColor: 'rgba(108,93,211,0.1)' }}>
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#a99fd8' }}>
                  Compliance References (optional)
                </label>
                {r.compliance_references.length === 0 && (
                  <p className="text-[10px] mb-1" style={{ color: '#a99fd8' }}>e.g. GDPR Art 28, SOC 2 CC6.1 — shown to reviewers as context</p>
                )}
                {r.compliance_references.map((cr, ci) => (
                  <div key={ci} className="flex items-center gap-2 mb-1">
                    <input
                      className="rounded px-2 py-1 text-xs flex-1"
                      style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
                      placeholder="Standard (e.g. GDPR)"
                      value={cr.standard}
                      onChange={(ev) => {
                        const next = [...r.compliance_references]
                        next[ci] = { ...next[ci], standard: ev.target.value }
                        updateReview(i, { compliance_references: next })
                      }}
                    />
                    <input
                      className="rounded px-2 py-1 text-xs flex-1"
                      style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
                      placeholder="Reference (e.g. Art 28)"
                      value={cr.reference}
                      onChange={(ev) => {
                        const next = [...r.compliance_references]
                        next[ci] = { ...next[ci], reference: ev.target.value }
                        updateReview(i, { compliance_references: next })
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => updateReview(i, { compliance_references: r.compliance_references.filter((_, x) => x !== ci) })}
                      className="text-xs px-1.5 py-0.5"
                      style={{ color: '#e11d48' }}
                    >×</button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => updateReview(i, { compliance_references: [...r.compliance_references, { standard: '', reference: '' }] })}
                  className="text-[11px] font-medium"
                  style={{ color: '#6c5dd3' }}
                >
                  + Add reference
                </button>
              </div>
            </div>
          </div>
        ))}
        <button type="button" onClick={addReview} className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: 'rgba(108,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(108,93,211,0.15)' }}>
          + Add Review Item
        </button>
      </Section>

      {error && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(225,29,72,0.05)', color: '#e11d48', border: '1px solid rgba(225,29,72,0.15)' }}>
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="text-sm font-semibold px-5 py-2.5 rounded-full text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 4px 12px rgba(108,93,211,0.3)' }}
        >
          {isPending ? 'Creating…' : 'Create Pack'}
        </button>
      </div>
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl p-5"
      style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}
    >
      <h3 className="text-sm font-semibold mb-1" style={{ color: '#1e1550' }}>{title}</h3>
      {subtitle && <p className="text-xs mb-3" style={{ color: '#a99fd8' }}>{subtitle}</p>}
      <div className={subtitle ? 'mt-2' : ''}>{children}</div>
    </section>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-medium px-2.5 py-1 rounded-full transition-colors"
      style={
        active
          ? { background: '#6c5dd3', color: 'white' }
          : { background: 'rgba(108,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(108,93,211,0.15)' }
      }
    >
      {children}
    </button>
  )
}
