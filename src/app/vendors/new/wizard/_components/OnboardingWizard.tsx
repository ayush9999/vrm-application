'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { VendorCategory } from '@/types/vendor'
import type { VendorServiceType, VendorDataAccessLevel } from '@/types/review-pack'
import type { OrgUser } from '@/lib/db/organizations'

const STEPS = ['Basics', 'Classification', 'Review Packs', 'Evidence', 'Confirm'] as const

interface MatchedPack {
  id: string
  name: string
  code: string | null
  description: string | null
  matched_rule: string
}

interface Props {
  categories: VendorCategory[]
  users: OrgUser[]
  countries: { code: string; name: string }[]
  createAction: (prevState: unknown, formData: FormData) => Promise<{ message?: string; errors?: Record<string, string[] | undefined> }>
  previewAction: (input: {
    category_id?: string | null
    criticality_tier?: number | null
    service_type: VendorServiceType
    data_access_level: VendorDataAccessLevel
    processes_personal_data: boolean
  }) => Promise<{ packs?: MatchedPack[]; message?: string }>
}

interface FormData {
  // Step 1
  name: string
  legal_name: string
  website_url: string
  primary_email: string
  phone: string
  country_code: string
  internal_owner_user_id: string
  // Step 2
  category_id: string
  service_type: VendorServiceType
  criticality_tier: string
  data_access_level: VendorDataAccessLevel
  processes_personal_data: boolean
  is_critical: boolean
  annual_spend: string
  // Step 3
  excluded_pack_ids: Set<string>
}

const INITIAL: FormData = {
  name: '',
  legal_name: '',
  website_url: '',
  primary_email: '',
  phone: '',
  country_code: '',
  internal_owner_user_id: '',
  category_id: '',
  service_type: 'other',
  criticality_tier: '',
  data_access_level: 'none',
  processes_personal_data: false,
  is_critical: false,
  annual_spend: '',
  excluded_pack_ids: new Set(),
}

export function OnboardingWizard({ categories, users, countries, createAction, previewAction }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<FormData>(INITIAL)
  const [matchedPacks, setMatchedPacks] = useState<MatchedPack[]>([])
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setData((d) => ({ ...d, [key]: value }))
  }

  const includedPacks = matchedPacks.filter((p) => !data.excluded_pack_ids.has(p.id))

  const goNext = () => {
    setError(null)
    if (step === 0) {
      if (!data.name.trim()) { setError('Vendor name is required'); return }
    }
    if (step === 1) {
      // Fetch matching packs
      startTransition(async () => {
        const r = await previewAction({
          category_id: data.category_id || null,
          criticality_tier: data.criticality_tier ? parseInt(data.criticality_tier, 10) : null,
          service_type: data.service_type,
          data_access_level: data.data_access_level,
          processes_personal_data: data.processes_personal_data,
        })
        if (r.packs) {
          setMatchedPacks(r.packs)
          setStep(2)
        } else {
          setError(r.message ?? 'Failed to preview packs')
        }
      })
      return
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1))
  }

  const goBack = () => {
    setError(null)
    setStep((s) => Math.max(0, s - 1))
  }

  const handleSubmit = () => {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('name', data.name.trim())
      if (data.legal_name) fd.set('legal_name', data.legal_name)
      if (data.website_url) fd.set('website_url', data.website_url)
      if (data.primary_email) fd.set('primary_email', data.primary_email)
      if (data.phone) fd.set('phone', data.phone)
      if (data.country_code) fd.set('country_code', data.country_code)
      if (data.internal_owner_user_id) fd.set('internal_owner_user_id', data.internal_owner_user_id)
      if (data.category_id) fd.set('category_id', data.category_id)
      fd.set('status', 'active')
      if (data.criticality_tier) fd.set('criticality_tier', data.criticality_tier)
      fd.set('service_type', data.service_type)
      fd.set('data_access_level', data.data_access_level)
      fd.set('processes_personal_data', data.processes_personal_data ? 'true' : 'false')
      fd.set('is_critical', data.is_critical ? 'true' : 'false')
      if (data.annual_spend) fd.set('annual_spend', data.annual_spend)

      const result = await createAction({}, fd)
      if (result.message) setError(result.message)
      else if (result.errors) setError(Object.values(result.errors)[0]?.[0] ?? 'Validation error')
      else router.push('/vendors')
    })
  }

  return (
    <div
      className="bg-white rounded-2xl p-6"
      style={{ boxShadow: '0 2px 12px rgba(109,93,211,0.08)', border: '1px solid rgba(109,93,211,0.1)' }}
    >
      {/* Stepper */}
      <div className="flex items-center justify-between mb-6">
        {STEPS.map((label, i) => {
          const done = i < step
          const active = i === step
          return (
            <div key={label} className="flex items-center gap-2 flex-1">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={
                  done || active
                    ? { background: '#6c5dd3', color: 'white' }
                    : { background: 'rgba(109,93,211,0.08)', color: '#a99fd8' }
                }
              >
                {done ? '✓' : i + 1}
              </span>
              <span
                className="text-xs font-medium hidden sm:inline"
                style={{ color: active ? '#1e1550' : '#a99fd8' }}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <span className="flex-1 h-px mx-2" style={{ background: i < step ? '#6c5dd3' : 'rgba(109,93,211,0.12)' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div className="min-h-[280px] space-y-4">
        {step === 0 && <Step1Basics data={data} update={update} countries={countries} users={users} />}
        {step === 1 && <Step2Classification data={data} update={update} categories={categories} />}
        {step === 2 && <Step3Packs matched={matchedPacks} excluded={data.excluded_pack_ids} setExcluded={(s) => update('excluded_pack_ids', s)} />}
        {step === 3 && <Step4Evidence packs={includedPacks} />}
        {step === 4 && <Step5Confirm data={data} categories={categories} packs={includedPacks} />}
      </div>

      {error && (
        <p className="text-xs mt-4" style={{ color: '#e11d48' }}>{error}</p>
      )}

      {/* Footer nav */}
      <div className="flex items-center justify-between mt-6 pt-4" style={{ borderTop: '1px solid rgba(109,93,211,0.1)' }}>
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0 || isPending}
          className="text-sm font-medium px-4 py-2 rounded-full transition-colors disabled:opacity-30"
          style={{ color: '#6c5dd3' }}
        >
          ← Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={isPending}
            className="text-sm font-medium px-5 py-2 rounded-full text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
          >
            {isPending ? 'Working…' : 'Next →'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="text-sm font-medium px-5 py-2 rounded-full text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
          >
            {isPending ? 'Creating…' : 'Create Vendor'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Steps ──────────────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(108,93,211,0.12)]'
const inputStyle = { border: '1px solid rgba(109,93,211,0.2)', background: 'white', color: '#1e1550' }
const labelStyle = { color: '#6c5dd3' }

function Step1Basics({
  data,
  update,
  countries,
  users,
}: {
  data: FormData
  update: <K extends keyof FormData>(key: K, value: FormData[K]) => void
  countries: { code: string; name: string }[]
  users: OrgUser[]
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Vendor Name *</label>
        <input className={inputCls} style={inputStyle} value={data.name} onChange={(e) => update('name', e.target.value)} placeholder="Acme Supplies" />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Legal Name</label>
        <input className={inputCls} style={inputStyle} value={data.legal_name} onChange={(e) => update('legal_name', e.target.value)} placeholder="Acme Supplies Pvt Ltd" />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Website</label>
        <input className={inputCls} style={inputStyle} value={data.website_url} onChange={(e) => update('website_url', e.target.value)} placeholder="https://acme.com" type="url" />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Primary Email</label>
        <input className={inputCls} style={inputStyle} value={data.primary_email} onChange={(e) => update('primary_email', e.target.value)} type="email" />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Phone</label>
        <input className={inputCls} style={inputStyle} value={data.phone} onChange={(e) => update('phone', e.target.value)} type="tel" />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Country</label>
        <select className={inputCls} style={inputStyle} value={data.country_code} onChange={(e) => update('country_code', e.target.value)}>
          <option value="">— None —</option>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Internal Owner</label>
        <select className={inputCls} style={inputStyle} value={data.internal_owner_user_id} onChange={(e) => update('internal_owner_user_id', e.target.value)}>
          <option value="">Unassigned</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
        </select>
      </div>
    </div>
  )
}

function Step2Classification({
  data,
  update,
  categories,
}: {
  data: FormData
  update: <K extends keyof FormData>(key: K, value: FormData[K]) => void
  categories: VendorCategory[]
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: '#4a4270' }}>
        These fields decide which Review Packs we&apos;ll auto-assign in the next step.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Category</label>
          <select className={inputCls} style={inputStyle} value={data.category_id} onChange={(e) => update('category_id', e.target.value)}>
            <option value="">— None —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Service Type</label>
          <select className={inputCls} style={inputStyle} value={data.service_type} onChange={(e) => update('service_type', e.target.value as VendorServiceType)}>
            <option value="saas">SaaS</option>
            <option value="contractor">Contractor</option>
            <option value="supplier">Supplier</option>
            <option value="logistics">Logistics</option>
            <option value="professional_services">Professional Services</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Criticality Tier</label>
          <select className={inputCls} style={inputStyle} value={data.criticality_tier} onChange={(e) => update('criticality_tier', e.target.value)}>
            <option value="">— None —</option>
            <option value="1">1 — Critical (gets all packs)</option>
            <option value="2">2 — High</option>
            <option value="3">3 — Medium</option>
            <option value="4">4 — Low</option>
            <option value="5">5 — Very Low</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Data Access Level</label>
          <select className={inputCls} style={inputStyle} value={data.data_access_level} onChange={(e) => update('data_access_level', e.target.value as VendorDataAccessLevel)}>
            <option value="none">None</option>
            <option value="internal_only">Internal Only</option>
            <option value="personal_data">Personal Data</option>
            <option value="sensitive_personal_data">Sensitive Personal Data</option>
            <option value="financial_data">Financial Data</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Annual Spend</label>
          <input className={inputCls} style={inputStyle} type="number" min="0" step="0.01" value={data.annual_spend} onChange={(e) => update('annual_spend', e.target.value)} placeholder="50000" />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input id="ppd" type="checkbox" checked={data.processes_personal_data} onChange={(e) => update('processes_personal_data', e.target.checked)} className="h-4 w-4 rounded" style={{ accentColor: '#6c5dd3' }} />
          <label htmlFor="ppd" className="text-sm font-medium" style={{ color: '#4a4270' }}>Processes personal data</label>
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input id="critical" type="checkbox" checked={data.is_critical} onChange={(e) => update('is_critical', e.target.checked)} className="h-4 w-4 rounded" style={{ accentColor: '#6c5dd3' }} />
          <label htmlFor="critical" className="text-sm font-medium" style={{ color: '#4a4270' }}>Mark as Critical Vendor (★)</label>
        </div>
      </div>
    </div>
  )
}

function Step3Packs({
  matched,
  excluded,
  setExcluded,
}: {
  matched: MatchedPack[]
  excluded: Set<string>
  setExcluded: (s: Set<string>) => void
}) {
  const toggle = (id: string) => {
    const next = new Set(excluded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExcluded(next)
  }
  if (matched.length === 0) {
    return (
      <p className="text-sm py-8 text-center" style={{ color: '#a99fd8' }}>
        No Review Packs match this vendor profile. You can still create the vendor and apply packs manually later.
      </p>
    )
  }
  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: '#4a4270' }}>
        Based on the classification you entered, these {matched.length} Review Packs would be auto-assigned. Uncheck any you don&apos;t want.
      </p>
      {matched.map((p) => {
        const included = !excluded.has(p.id)
        return (
          <label
            key={p.id}
            className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors"
            style={{ background: included ? 'rgba(108,93,211,0.04)' : 'rgba(148,163,184,0.04)', border: `1px solid ${included ? 'rgba(108,93,211,0.15)' : 'rgba(148,163,184,0.2)'}` }}
          >
            <input
              type="checkbox"
              checked={included}
              onChange={() => toggle(p.id)}
              className="mt-1 h-4 w-4 rounded shrink-0"
              style={{ accentColor: '#6c5dd3' }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold" style={{ color: '#1e1550' }}>{p.name}</span>
                {p.code && <span className="text-[10px] font-mono" style={{ color: '#a99fd8' }}>{p.code}</span>}
              </div>
              {p.description && <p className="text-xs mt-0.5" style={{ color: '#4a4270' }}>{p.description}</p>}
              <p className="text-[10px] italic mt-1" style={{ color: '#8b7fd4' }}>Why: {p.matched_rule}</p>
            </div>
          </label>
        )
      })}
      <p className="text-[11px] mt-3" style={{ color: '#a99fd8' }}>
        Note: in this version, ALL matched packs will be applied on create. To exclude a pack you can archive it in Settings → Review Packs before creating, or remove it after creation.
      </p>
    </div>
  )
}

function Step4Evidence({ packs }: { packs: MatchedPack[] }) {
  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: '#4a4270' }}>
        Once you create the vendor, an evidence checklist will be auto-generated for each Review Pack.
        You can upload evidence yourself or request it from the vendor (via the Evidence tab).
      </p>
      <div className="rounded-xl overflow-hidden" style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)' }}>
        {packs.map((p, i) => (
          <div key={p.id} className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: i === packs.length - 1 ? undefined : '1px solid rgba(109,93,211,0.06)' }}>
            <span className="text-sm font-medium flex-1" style={{ color: '#1e1550' }}>{p.name}</span>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: '#a99fd8' }}>Evidence checklist will generate</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Step5Confirm({
  data,
  categories,
  packs,
}: {
  data: FormData
  categories: VendorCategory[]
  packs: MatchedPack[]
}) {
  const cat = categories.find((c) => c.id === data.category_id)
  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#a99fd8' }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: '#1e1550' }}>{value || '—'}</span>
    </div>
  )
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: '#4a4270' }}>Review the details and click Create Vendor.</p>
      <div className="rounded-xl p-4 divide-y divide-[rgba(109,93,211,0.06)]" style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)' }}>
        <Row label="Name" value={data.name} />
        <Row label="Legal Name" value={data.legal_name} />
        <Row label="Category" value={cat?.name ?? '—'} />
        <Row label="Service Type" value={data.service_type} />
        <Row label="Criticality" value={data.criticality_tier ? `Tier ${data.criticality_tier}` : '—'} />
        <Row label="Data Access" value={data.data_access_level} />
        <Row label="Personal Data" value={data.processes_personal_data ? 'Yes' : 'No'} />
        <Row label="Critical" value={data.is_critical ? 'Yes ★' : 'No'} />
        <Row label="Annual Spend" value={data.annual_spend ? `$${data.annual_spend}` : '—'} />
        <Row label="Country" value={data.country_code} />
        <Row label="Review Packs" value={`${packs.length} packs will be applied`} />
      </div>
    </div>
  )
}
