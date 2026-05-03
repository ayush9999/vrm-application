'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updatePackMetadataAction } from '../../actions'
import type { ApplicabilityRules, VendorServiceType, VendorDataAccessLevel } from '@/types/review-pack'

interface Props {
  packId: string
  initial: ApplicabilityRules
  canEdit: boolean
}

const SERVICE_TYPES: { value: VendorServiceType; label: string }[] = [
  { value: 'saas', label: 'SaaS' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'other', label: 'Other' },
]

const DATA_ACCESS_LEVELS: { value: VendorDataAccessLevel; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'internal_only', label: 'Internal only' },
  { value: 'personal_data', label: 'Personal data' },
  { value: 'sensitive_personal_data', label: 'Sensitive personal data' },
  { value: 'financial_data', label: 'Financial data' },
]

export function ApplicabilityRulesEditor({ packId, initial, canEdit }: Props) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Local edit state
  const [always, setAlways] = useState(initial.always === true)
  const [processesPersonalData, setProcessesPersonalData] = useState(initial.processes_personal_data === true)
  const [requiresEsg, setRequiresEsg] = useState(initial.requires_esg_setting === true)
  const [useMinTier, setUseMinTier] = useState(initial.min_criticality_tier != null)
  const [minTier, setMinTier] = useState<number>(initial.min_criticality_tier ?? 2)
  const [serviceTypes, setServiceTypes] = useState<Set<VendorServiceType>>(new Set(initial.service_types ?? []))
  const [dataAccessLevels, setDataAccessLevels] = useState<Set<VendorDataAccessLevel>>(new Set(initial.data_access_levels ?? []))

  const cancel = () => {
    setAlways(initial.always === true)
    setProcessesPersonalData(initial.processes_personal_data === true)
    setRequiresEsg(initial.requires_esg_setting === true)
    setUseMinTier(initial.min_criticality_tier != null)
    setMinTier(initial.min_criticality_tier ?? 2)
    setServiceTypes(new Set(initial.service_types ?? []))
    setDataAccessLevels(new Set(initial.data_access_levels ?? []))
    setError(null)
    setIsEditing(false)
  }

  const save = () => {
    const rules: ApplicabilityRules = {}
    if (always) rules.always = true
    if (processesPersonalData) rules.processes_personal_data = true
    if (requiresEsg) rules.requires_esg_setting = true
    if (useMinTier) rules.min_criticality_tier = minTier
    if (serviceTypes.size > 0) rules.service_types = Array.from(serviceTypes)
    if (dataAccessLevels.size > 0) rules.data_access_levels = Array.from(dataAccessLevels)

    setError(null)
    startTransition(async () => {
      const r = await updatePackMetadataAction(packId, { applicability_rules: rules })
      if (r.success) {
        setIsEditing(false)
        router.refresh()
      } else {
        setError(r.message ?? 'Failed to save')
      }
    })
  }

  const toggleSet = <T,>(s: Set<T>, v: T): Set<T> => {
    const n = new Set(s)
    if (n.has(v)) n.delete(v)
    else n.add(v)
    return n
  }

  // ─── Read-only summary ──────────────────────────────────────────────────
  if (!isEditing) {
    return (
      <div className="space-y-2">
        <SummaryView rules={initial} />
        {canEdit && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: 'rgba(108,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(108,93,211,0.15)' }}
          >
            Edit Rules
          </button>
        )}
      </div>
    )
  }

  // ─── Edit form ──────────────────────────────────────────────────────────
  return (
    <div
      className="rounded-xl p-4 space-y-4"
      style={{ background: 'white', border: '1px solid rgba(108,93,211,0.18)', boxShadow: '0 4px 16px rgba(30,21,80,0.06)' }}
    >
      <p className="text-xs leading-relaxed" style={{ color: '#4a4270' }}>
        A vendor gets this pack auto-assigned if it matches <strong>any</strong> rule below. Leave everything off to keep
        the pack manual-only.
      </p>

      {/* Always */}
      <div>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={always}
            onChange={(e) => setAlways(e.target.checked)}
            className="h-4 w-4 rounded mt-0.5"
            style={{ accentColor: '#6c5dd3' }}
          />
          <span>
            <span className="font-medium" style={{ color: '#1e1550' }}>Always assign to every vendor</span>
            <span className="block text-xs mt-0.5" style={{ color: '#6b5fa8' }}>
              Use for foundational packs like Legal &amp; Contract.
            </span>
          </span>
        </label>
      </div>

      {!always && (
        <>
          {/* Vendor flags */}
          <div className="space-y-2 pt-1" style={{ borderTop: '1px solid rgba(108,93,211,0.08)' }}>
            <label className="flex items-center gap-2 text-sm cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={processesPersonalData}
                onChange={(e) => setProcessesPersonalData(e.target.checked)}
                className="h-4 w-4 rounded"
                style={{ accentColor: '#6c5dd3' }}
              />
              <span style={{ color: '#1e1550' }}>Vendor processes personal data</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={requiresEsg}
                onChange={(e) => setRequiresEsg(e.target.checked)}
                className="h-4 w-4 rounded"
                style={{ accentColor: '#6c5dd3' }}
              />
              <span style={{ color: '#1e1550' }}>Org has ESG enabled in Company Profile</span>
            </label>
          </div>

          {/* Criticality */}
          <div className="pt-2" style={{ borderTop: '1px solid rgba(108,93,211,0.08)' }}>
            <label className="flex items-center gap-2 text-sm cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={useMinTier}
                onChange={(e) => setUseMinTier(e.target.checked)}
                className="h-4 w-4 rounded"
                style={{ accentColor: '#6c5dd3' }}
              />
              <span style={{ color: '#1e1550' }}>Minimum criticality tier</span>
            </label>
            {useMinTier && (
              <div className="ml-6 mt-2 flex items-center gap-2">
                <span className="text-xs" style={{ color: '#4a4270' }}>Apply when vendor tier ≤</span>
                <select
                  value={minTier}
                  onChange={(e) => setMinTier(parseInt(e.target.value, 10))}
                  className="rounded-lg px-2.5 py-1 text-sm"
                  style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550', background: 'white' }}
                >
                  <option value={1}>1 (only Tier 1)</option>
                  <option value={2}>2 (Tier 1 or 2)</option>
                  <option value={3}>3 (Tier 1–3)</option>
                  <option value={4}>4 (Tier 1–4)</option>
                  <option value={5}>5 (every tier)</option>
                </select>
                <span className="text-xs" style={{ color: '#6b5fa8' }}>
                  (Tier 1 = most critical)
                </span>
              </div>
            )}
          </div>

          {/* Service types */}
          <div className="pt-2" style={{ borderTop: '1px solid rgba(108,93,211,0.08)' }}>
            <div className="text-xs font-semibold uppercase tracking-wider pt-2 mb-1.5" style={{ color: '#6c5dd3' }}>
              Match Service Types
            </div>
            <p className="text-xs mb-2" style={{ color: '#6b5fa8' }}>
              Pack applies if the vendor has at least one of these.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_TYPES.map((o) => (
                <Chip key={o.value} active={serviceTypes.has(o.value)} onClick={() => setServiceTypes(toggleSet(serviceTypes, o.value))}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Data access */}
          <div className="pt-2" style={{ borderTop: '1px solid rgba(108,93,211,0.08)' }}>
            <div className="text-xs font-semibold uppercase tracking-wider pt-2 mb-1.5" style={{ color: '#6c5dd3' }}>
              Match Data Access Levels
            </div>
            <p className="text-xs mb-2" style={{ color: '#6b5fa8' }}>
              Pack applies if the vendor has at least one of these.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DATA_ACCESS_LEVELS.map((o) => (
                <Chip key={o.value} active={dataAccessLevels.has(o.value)} onClick={() => setDataAccessLevels(toggleSet(dataAccessLevels, o.value))}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>
        </>
      )}

      {error && <p className="text-xs" style={{ color: '#e11d48' }}>{error}</p>}

      <div className="flex items-center justify-end gap-2 pt-1" style={{ borderTop: '1px solid rgba(108,93,211,0.08)' }}>
        <button
          type="button"
          onClick={cancel}
          disabled={isPending}
          className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
          style={{ color: '#6b5fa8' }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="text-xs font-semibold px-4 py-1.5 rounded-full text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ─── Summary view ─────────────────────────────────────────────────────────

function SummaryView({ rules }: { rules: ApplicabilityRules }) {
  const conditions: { label: string; tone?: 'primary' | 'amber' }[] = []

  if (rules.always) {
    conditions.push({ label: 'Applies to every vendor', tone: 'primary' })
  } else {
    if (rules.processes_personal_data) conditions.push({ label: 'Vendor processes personal data' })
    if (rules.requires_esg_setting) conditions.push({ label: 'Org ESG enabled', tone: 'amber' })
    if (rules.min_criticality_tier != null) {
      conditions.push({ label: `Criticality tier ≤ ${rules.min_criticality_tier}` })
    }
    if (rules.service_types && rules.service_types.length > 0) {
      conditions.push({ label: `Service: ${rules.service_types.map(humanize).join(', ')}` })
    }
    if (rules.data_access_levels && rules.data_access_levels.length > 0) {
      conditions.push({ label: `Data access: ${rules.data_access_levels.map(humanize).join(', ')}` })
    }
  }

  if (conditions.length === 0) {
    return (
      <div
        className="rounded-lg px-3 py-2.5 text-xs"
        style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.18)', color: '#64748b' }}
      >
        <span className="font-medium">Manual assignment only</span> — no auto-apply rules. Vendors will only get this pack
        if you assign it explicitly.
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium" style={{ color: '#6b5fa8' }}>
        Auto-applied to vendors matching <strong>any</strong> of these:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {conditions.map((c, i) => (
          <span
            key={i}
            className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={
              c.tone === 'primary'
                ? { background: 'rgba(108,93,211,0.12)', color: '#6c5dd3' }
                : c.tone === 'amber'
                ? { background: 'rgba(245,158,11,0.1)', color: '#d97706' }
                : { background: 'rgba(108,93,211,0.06)', color: '#4a4270', border: '1px solid rgba(108,93,211,0.12)' }
            }
          >
            {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs px-2.5 py-1 rounded-full transition-colors"
      style={
        active
          ? { background: '#6c5dd3', color: 'white', fontWeight: 500 }
          : { background: 'white', color: '#6c5dd3', border: '1px solid rgba(108,93,211,0.2)' }
      }
    >
      {children}
    </button>
  )
}
