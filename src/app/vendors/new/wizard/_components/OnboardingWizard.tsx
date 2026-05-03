'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { VendorCategory } from '@/types/vendor'
import type { VendorServiceType, VendorDataAccessLevel } from '@/types/review-pack'
import type { OrgUser } from '@/lib/db/organizations'
import { CategoryPicker } from '@/app/vendors/_components/CategoryPicker'

const STEPS = ['Basics', 'Classification', 'Review Packs', 'Evidence', 'Confirm'] as const

const CREATING_STEPS: { label: string; sub: string }[] = [
  { label: 'Creating vendor record',     sub: 'Saving identity, classification, and contact details…' },
  { label: 'Auto-applying review packs', sub: 'Matching applicable packs against the vendor profile…' },
  { label: 'Generating evidence checklist', sub: 'Creating placeholder rows for each required document…' },
  { label: 'Setting up the onboarding review', sub: 'Linking everything under a single review engagement…' },
  { label: 'Almost done',                sub: 'Wrapping up — should be just a moment…' },
]

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
    category_ids?: string[]
    is_critical: boolean
    criticality_tier?: number | null
    status: 'active' | 'under_review' | 'suspended'
    internal_owner_user_id?: string | null
    website_url?: string | null
    primary_email?: string | null
    phone?: string | null
    country_code?: string | null
    service_types: VendorServiceType[]
    data_access_levels: VendorDataAccessLevel[]
    processes_personal_data: boolean
    annual_spend?: number | null
  }) => Promise<{ vendorId?: string; message?: string }>
  previewAction: (input: {
    category_ids?: string[]
    criticality_tier?: number | null
    service_types: VendorServiceType[]
    data_access_levels: VendorDataAccessLevel[]
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
  // Step 2 (now multi-select)
  category_ids: string[]
  service_types: VendorServiceType[]
  criticality_tier: string
  data_access_levels: VendorDataAccessLevel[]
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
  category_ids: [],
  service_types: [],
  criticality_tier: '',
  data_access_levels: [],
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
  const [createdVendorId, setCreatedVendorId] = useState<string | null>(null)
  const [creatingStepIdx, setCreatingStepIdx] = useState(0)

  const isCreatingFinal = isPending && step === STEPS.length - 1 && !createdVendorId

  // Cycle progress messages while the final create is in flight
  useEffect(() => {
    if (!isCreatingFinal) {
      setCreatingStepIdx(0)
      return
    }
    const interval = setInterval(() => {
      setCreatingStepIdx((i) => Math.min(i + 1, CREATING_STEPS.length - 1))
    }, 1400)
    return () => clearInterval(interval)
  }, [isCreatingFinal])

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
          category_ids: data.category_ids,
          criticality_tier: data.criticality_tier ? parseInt(data.criticality_tier, 10) : null,
          service_types: data.service_types,
          data_access_levels: data.data_access_levels,
          processes_personal_data: data.data_access_levels.some((l) => l === 'personal_data' || l === 'sensitive_personal_data'),
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
      const tierNum = data.criticality_tier ? parseInt(data.criticality_tier, 10) : null
      const processesPersonalData = data.data_access_levels.some(
        (l) => l === 'personal_data' || l === 'sensitive_personal_data',
      )
      const result = await createAction({
        name: data.name.trim(),
        legal_name: data.legal_name || null,
        category_ids: data.category_ids,
        is_critical: tierNum === 1,
        criticality_tier: tierNum,
        status: 'active',
        internal_owner_user_id: data.internal_owner_user_id || null,
        website_url: data.website_url || null,
        primary_email: data.primary_email || null,
        phone: data.phone || null,
        country_code: data.country_code || null,
        service_types: data.service_types,
        data_access_levels: data.data_access_levels,
        processes_personal_data: processesPersonalData,
        annual_spend: data.annual_spend ? Number(data.annual_spend) : null,
      })
      if (result.message || !result.vendorId) {
        setError(result.message ?? 'Failed to create vendor')
        return
      }
      setCreatedVendorId(result.vendorId)
    })
  }

  const isComplete = !!createdVendorId

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
                    : { background: 'rgba(109,93,211,0.08)', color: '#6b5fa8' }
                }
              >
                {done ? '✓' : i + 1}
              </span>
              <span
                className="text-xs font-medium hidden sm:inline"
                style={{ color: active ? '#1e1550' : '#6b5fa8' }}
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
        {isCreatingFinal || isComplete ? (
          <CreatingPanel
            vendorName={data.name}
            stepIdx={creatingStepIdx}
            complete={isComplete}
            onOpenProfile={() => router.push(`/vendors/${createdVendorId}?tab=reviews`)}
            onBackToList={() => router.push('/vendors')}
          />
        ) : (
          <>
            {step === 0 && <Step1Basics data={data} update={update} countries={countries} users={users} />}
            {step === 1 && <Step2Classification data={data} update={update} categories={categories} />}
            {step === 2 && <Step3Packs matched={matchedPacks} excluded={data.excluded_pack_ids} setExcluded={(s) => update('excluded_pack_ids', s)} />}
            {step === 3 && <Step4Evidence packs={includedPacks} />}
            {step === 4 && <Step6Confirm data={data} categories={categories} packs={includedPacks} />}
          </>
        )}
      </div>

      {error && (
        <p className="text-xs mt-4" style={{ color: '#e11d48' }}>{error}</p>
      )}

      {/* Footer nav — hidden once the vendor is created (CTAs live inside the panel) */}
      {!isComplete && (
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
      )}
    </div>
  )
}

// ─── Creating-state panel ───────────────────────────────────────────────────

function CreatingPanel({
  vendorName,
  stepIdx,
  complete,
  onOpenProfile,
  onBackToList,
}: {
  vendorName: string
  stepIdx: number
  complete: boolean
  onOpenProfile: () => void
  onBackToList: () => void
}) {
  // When complete, force every step into the "done" state.
  const effectiveStepIdx = complete ? CREATING_STEPS.length : stepIdx

  return (
    <div className="flex flex-col items-center justify-center text-center py-10">
      {/* Hero indicator: spinner ring while creating, green check on complete */}
      <div className="relative mb-5" style={{ width: 64, height: 64 }}>
        {complete ? (
          <div
            className="absolute inset-0 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(5,150,105,0.1)', animation: 'wizardPop 380ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          >
            <svg width="30" height="30" viewBox="0 0 16 16" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8.5l3.5 3.5 6.5-8" />
            </svg>
          </div>
        ) : (
          <>
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'conic-gradient(from 0deg, rgba(108,93,211,0.05), #6c5dd3, rgba(108,93,211,0.05))',
                animation: 'wizardSpin 1.2s linear infinite',
                WebkitMaskImage: 'radial-gradient(circle, transparent 56%, black 57%)',
                maskImage: 'radial-gradient(circle, transparent 56%, black 57%)',
              }}
            />
            <div
              className="absolute inset-0 flex items-center justify-center text-xs font-bold tracking-wide"
              style={{ color: '#6c5dd3' }}
            >
              {Math.min(stepIdx + 1, CREATING_STEPS.length)}/{CREATING_STEPS.length}
            </div>
          </>
        )}
      </div>

      <h3 className="text-base font-semibold mb-1" style={{ color: '#1e1550' }}>
        {complete ? (
          <>Vendor <span style={{ color: '#059669' }}>{vendorName.trim() || 'vendor'}</span> is ready</>
        ) : (
          <>Creating <span style={{ color: '#6c5dd3' }}>{vendorName.trim() || 'vendor'}</span>…</>
        )}
      </h3>
      <p className="text-xs mb-6" style={{ color: '#6b5fa8' }}>
        {complete
          ? 'Review Packs were auto-applied. You can start the review or send the questionnaire now.'
          : 'This usually takes a few seconds. Please don’t close the tab.'}
      </p>

      {/* Step list */}
      <ul className="w-full max-w-md text-left space-y-2">
        {CREATING_STEPS.map((s, i) => {
          const done = i < effectiveStepIdx
          const active = !complete && i === effectiveStepIdx
          return (
            <li key={s.label} className="flex items-start gap-2.5">
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={
                  done
                    ? { background: complete ? '#059669' : '#6c5dd3', color: 'white' }
                    : active
                    ? { background: 'rgba(108,93,211,0.18)', color: '#6c5dd3' }
                    : { background: 'rgba(109,93,211,0.08)', color: '#6b5fa8' }
                }
              >
                {done ? (
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 6l2.5 2.5 4.5-5" />
                  </svg>
                ) : active ? (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#6c5dd3', animation: 'wizardPulse 1.2s ease-in-out infinite' }} />
                ) : null}
              </span>
              <div className="flex-1">
                <div
                  className="text-xs font-medium"
                  style={{ color: done || active ? '#1e1550' : '#6b5fa8' }}
                >
                  {s.label}
                </div>
                {active && (
                  <div className="text-xs mt-0.5" style={{ color: '#5d5285' }}>
                    {s.sub}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {/* CTAs */}
      {complete && (
        <div className="flex items-center justify-center gap-3 mt-6 pt-5 w-full max-w-md" style={{ borderTop: '1px solid rgba(108,93,211,0.08)' }}>
          <button
            type="button"
            onClick={onOpenProfile}
            className="text-sm font-medium px-5 py-2 rounded-full text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 4px 12px rgba(108,93,211,0.3)' }}
          >
            Open Vendor Profile →
          </button>
          <button
            type="button"
            onClick={onBackToList}
            className="text-sm font-medium px-4 py-2 rounded-full hover:opacity-70"
            style={{ color: '#6b5fa8' }}
          >
            Back to Vendors list
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes wizardSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes wizardPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.6); opacity: 0.5; }
        }
        @keyframes wizardPop {
          0%   { transform: scale(0.7); opacity: 0; }
          60%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
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

const SERVICE_TYPE_OPTIONS: { value: VendorServiceType; label: string }[] = [
  { value: 'saas', label: 'SaaS' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'other', label: 'Other' },
]

const DATA_ACCESS_LEVEL_OPTIONS: { value: VendorDataAccessLevel; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'internal_only', label: 'Internal Only' },
  { value: 'personal_data', label: 'Personal Data' },
  { value: 'sensitive_personal_data', label: 'Sensitive Personal Data' },
  { value: 'financial_data', label: 'Financial Data' },
]

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
        Select all that apply — Review Packs will auto-match on any overlap.
      </p>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Categories</label>
        <CategoryPicker
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          selected={data.category_ids}
          onChange={(next) => update('category_ids', next)}
          emptyHint="No categories configured yet."
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Service Types</label>
        <CategoryPicker
          options={SERVICE_TYPE_OPTIONS}
          selected={data.service_types}
          onChange={(next) => update('service_types', next as VendorServiceType[])}
          placeholder="Select service types…"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Data Access Levels</label>
        <CategoryPicker
          options={DATA_ACCESS_LEVEL_OPTIONS}
          selected={data.data_access_levels}
          onChange={(next) => update('data_access_levels', next as VendorDataAccessLevel[])}
          placeholder="Select data access levels…"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Annual Spend</label>
          <input className={inputCls} style={inputStyle} type="number" min="0" step="0.01" value={data.annual_spend} onChange={(e) => update('annual_spend', e.target.value)} placeholder="50000" />
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
      <p className="text-sm py-8 text-center" style={{ color: '#6b5fa8' }}>
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
                {p.code && <span className="text-xs font-mono" style={{ color: '#6b5fa8' }}>{p.code}</span>}
              </div>
              {p.description && <p className="text-xs mt-0.5" style={{ color: '#4a4270' }}>{p.description}</p>}
              <p className="text-xs italic mt-1" style={{ color: '#5d5285' }}>Why: {p.matched_rule}</p>
            </div>
          </label>
        )
      })}
      <p className="text-xs mt-3" style={{ color: '#6b5fa8' }}>
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
            <span className="text-xs uppercase tracking-wider" style={{ color: '#6b5fa8' }}>Evidence checklist will generate</span>
          </div>
        ))}
      </div>
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
  const catNames = data.category_ids
    .map((id) => categories.find((c) => c.id === id)?.name)
    .filter(Boolean)
    .join(', ')
  const serviceTypeLabels = data.service_types
    .map((v) => SERVICE_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v)
    .join(', ')
  const dataAccessLabels = data.data_access_levels
    .map((v) => DATA_ACCESS_LEVEL_OPTIONS.find((o) => o.value === v)?.label ?? v)
    .join(', ')

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#6b5fa8' }}>{label}</span>
      <span className="text-sm font-medium text-right ml-4" style={{ color: '#1e1550' }}>{value || '—'}</span>
    </div>
  )
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: '#4a4270' }}>Review the details and click Create Vendor.</p>
      <div className="rounded-xl p-4 divide-y divide-[rgba(109,93,211,0.06)]" style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)' }}>
        <Row label="Name" value={data.name} />
        <Row label="Legal Name" value={data.legal_name} />
        <Row label="Categories" value={catNames} />
        <Row label="Service Types" value={serviceTypeLabels} />
        <Row label="Criticality" value={data.criticality_tier ? `Tier ${data.criticality_tier}${data.criticality_tier === '1' ? ' ★' : ''}` : '—'} />
        <Row label="Data Access" value={dataAccessLabels} />
        <Row label="Annual Spend" value={data.annual_spend ? `$${data.annual_spend}` : '—'} />
        <Row label="Country" value={data.country_code} />
        <Row label="Review Packs" value={`${packs.length} packs will be applied`} />
      </div>
    </div>
  )
}
