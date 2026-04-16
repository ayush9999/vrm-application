'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { VendorCategory } from '@/types/vendor'
import type { VendorServiceType, VendorDataAccessLevel } from '@/types/review-pack'
import type { OrgUser } from '@/lib/db/organizations'

const STEPS = ['Basics', 'Classification', 'Review Packs', 'Evidence', 'Collect', 'Confirm'] as const

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
  createAction: (input: {
    name: string
    legal_name?: string | null
    category_id?: string | null
    is_critical: boolean
    criticality_tier?: number | null
    status: 'active' | 'under_review' | 'suspended'
    internal_owner_user_id?: string | null
    website_url?: string | null
    primary_email?: string | null
    phone?: string | null
    country_code?: string | null
    service_type: VendorServiceType
    data_access_level: VendorDataAccessLevel
    processes_personal_data: boolean
    annual_spend?: number | null
  }) => Promise<{ vendorId?: string; message?: string }>
  previewAction: (input: {
    category_id?: string | null
    criticality_tier?: number | null
    service_type: VendorServiceType
    data_access_level: VendorDataAccessLevel
    processes_personal_data: boolean
  }) => Promise<{ packs?: MatchedPack[]; message?: string }>
  generatePortalLinksAction: (
    vendorId: string,
    recipientEmail: string | null,
    expiryDays: number,
  ) => Promise<{ urls?: string[]; message?: string }>
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
  // Step 5 (Collect)
  send_portal_link: boolean
  portal_recipient_email: string
  portal_expiry_days: string
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
  send_portal_link: false,
  portal_recipient_email: '',
  portal_expiry_days: '14',
}

export function OnboardingWizard({ categories, users, countries, createAction, previewAction, generatePortalLinksAction }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<FormData>(INITIAL)
  const [matchedPacks, setMatchedPacks] = useState<MatchedPack[]>([])
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [createdVendorId, setCreatedVendorId] = useState<string | null>(null)
  const [portalUrls, setPortalUrls] = useState<string[]>([])

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
      const result = await createAction({
        name: data.name.trim(),
        legal_name: data.legal_name || null,
        category_id: data.category_id || null,
        is_critical: data.is_critical,
        criticality_tier: data.criticality_tier ? parseInt(data.criticality_tier, 10) : null,
        status: 'active',
        internal_owner_user_id: data.internal_owner_user_id || null,
        website_url: data.website_url || null,
        primary_email: data.primary_email || null,
        phone: data.phone || null,
        country_code: data.country_code || null,
        service_type: data.service_type,
        data_access_level: data.data_access_level,
        processes_personal_data: data.processes_personal_data,
        annual_spend: data.annual_spend ? Number(data.annual_spend) : null,
      })
      if (result.message || !result.vendorId) {
        setError(result.message ?? 'Failed to create vendor')
        return
      }
      setCreatedVendorId(result.vendorId)

      // Optionally generate portal links for the freshly-created vendor's packs
      if (data.send_portal_link) {
        const r = await generatePortalLinksAction(
          result.vendorId,
          data.portal_recipient_email.trim() || null,
          parseInt(data.portal_expiry_days, 10) || 14,
        )
        if (r.urls) setPortalUrls(r.urls)
        else if (r.message) setError(`Vendor created, but portal-link generation failed: ${r.message}`)
      }
    })
  }

  // Success state
  if (createdVendorId) {
    return (
      <div
        className="bg-white rounded-2xl p-8 space-y-5 text-center"
        style={{ boxShadow: '0 2px 12px rgba(109,93,211,0.08)', border: '1px solid rgba(109,93,211,0.1)' }}
      >
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mx-auto"
          style={{ background: 'rgba(5,150,105,0.08)' }}
        >
          <svg width="26" height="26" viewBox="0 0 16 16" fill="none" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8.5l3.5 3.5 6.5-8" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-semibold" style={{ color: '#1e1550' }}>
            Vendor created — {data.name}
          </h2>
          <p className="text-sm mt-1" style={{ color: '#a99fd8' }}>
            Review Packs were auto-applied. You can now start the review or send the questionnaire to the vendor.
          </p>
        </div>

        {portalUrls.length > 0 && (
          <div
            className="text-left rounded-xl p-4 space-y-2"
            style={{ background: 'rgba(108,93,211,0.04)', border: '1px solid rgba(108,93,211,0.15)' }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#6c5dd3' }}>
              Portal Links Generated ({portalUrls.length})
            </p>
            <p className="text-xs" style={{ color: '#4a4270' }}>
              Send these URLs to the vendor. They&apos;ll be able to upload evidence and answer review questions without logging in.
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {portalUrls.map((url, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded bg-white text-[11px]">
                  <code className="flex-1 truncate font-mono" style={{ color: '#1e1550' }}>{url}</code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(url)}
                    className="text-[10px] font-medium px-2 py-0.5 rounded"
                    style={{ background: 'rgba(108,93,211,0.06)', color: '#6c5dd3' }}
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push(`/vendors/${createdVendorId}?tab=reviews`)}
            className="text-sm font-medium px-5 py-2 rounded-full text-white"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
          >
            Open Vendor Profile →
          </button>
          <button
            type="button"
            onClick={() => router.push('/vendors')}
            className="text-sm font-medium px-4 py-2 rounded-full"
            style={{ color: '#a99fd8' }}
          >
            Back to Vendors list
          </button>
        </div>
      </div>
    )
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
        {step === 4 && <Step5Collect data={data} update={update} />}
        {step === 5 && <Step6Confirm data={data} categories={categories} packs={includedPacks} />}
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

function Step5Collect({
  data,
  update,
}: {
  data: FormData
  update: <K extends keyof FormData>(key: K, value: FormData[K]) => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: '#4a4270' }}>
        Decide how to collect evidence from this vendor. You can always send portal links later from the Reviews tab.
      </p>

      <div
        className="rounded-xl p-4"
        style={{ background: 'rgba(108,93,211,0.04)', border: '1px solid rgba(108,93,211,0.15)' }}
      >
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={data.send_portal_link}
            onChange={(e) => update('send_portal_link', e.target.checked)}
            className="mt-1 h-4 w-4 rounded shrink-0"
            style={{ accentColor: '#6c5dd3' }}
          />
          <div className="flex-1">
            <div className="text-sm font-semibold" style={{ color: '#1e1550' }}>
              Generate portal links for the vendor on creation
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#4a4270' }}>
              We&apos;ll create a unique URL per assigned Review Pack. Vendor opens the link to upload evidence and answer review questions — no login required.
            </div>
          </div>
        </label>

        {data.send_portal_link && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 pl-7">
            <input
              type="email"
              value={data.portal_recipient_email}
              onChange={(e) => update('portal_recipient_email', e.target.value)}
              placeholder="Vendor contact email (optional)"
              className="rounded-lg px-3 py-2 text-xs sm:col-span-2"
              style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
            />
            <select
              value={data.portal_expiry_days}
              onChange={(e) => update('portal_expiry_days', e.target.value)}
              className="rounded-lg px-3 py-2 text-xs"
              style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
            >
              <option value="7">Expires in 7 days</option>
              <option value="14">Expires in 14 days</option>
              <option value="30">Expires in 30 days</option>
              <option value="90">Expires in 90 days</option>
            </select>
          </div>
        )}
      </div>

      {!data.send_portal_link && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(108,93,211,0.04)', color: '#6c5dd3' }}>
          You can upload evidence yourself from the vendor&apos;s Evidence tab after creation.
        </p>
      )}
    </div>
  )
}

function Step6Confirm({
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
        <Row label="Send Portal Link" value={data.send_portal_link ? `Yes (${data.portal_expiry_days}d expiry${data.portal_recipient_email ? ` → ${data.portal_recipient_email}` : ''})` : 'No'} />
      </div>
    </div>
  )
}
