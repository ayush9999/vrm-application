'use client'

import { useState, useTransition } from 'react'
import type { CompanyProfile } from '@/lib/db/org-settings'

const inputCls = 'w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(108,93,211,0.12)]'
const inputStyle = { border: '1px solid rgba(109,93,211,0.2)', background: 'white', color: '#1e1550' }
const labelStyle = { color: '#6c5dd3' }

interface Props {
  profile: CompanyProfile
  countries: { code: string; name: string }[]
  canEdit: boolean
  updateAction: (patch: {
    company_type?: string | null
    industry?: string | null
    operating_countries?: string[]
    default_review_cadence?: string | null
    esg_enabled?: boolean
  }) => Promise<{ success?: boolean; message?: string }>
  allStandards: { code: string; name: string }[]
  selectedStandards: string[]
  updateStandardsAction: (standards: string[]) => Promise<{ success?: boolean; message?: string }>
}

export function CompanyProfileForm({ profile, countries, canEdit, updateAction, allStandards, selectedStandards: initialStandards, updateStandardsAction }: Props) {
  const [companyType, setCompanyType] = useState(profile.company_type ?? '')
  const [industry, setIndustry] = useState(profile.industry ?? '')
  const [operatingCountries, setOperatingCountries] = useState<string[]>(profile.operating_countries ?? [])
  const [cadence, setCadence] = useState(profile.default_review_cadence ?? 'annual')
  const [esg, setEsg] = useState(profile.esg_enabled)
  const [standards, setStandards] = useState<Set<string>>(new Set(initialStandards))
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [standardsMsg, setStandardsMsg] = useState<string | null>(null)

  const toggleStandard = (code: string) => {
    setStandards((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const saveStandards = () => {
    setStandardsMsg(null)
    startTransition(async () => {
      const r = await updateStandardsAction(Array.from(standards))
      setStandardsMsg(r.success ? 'Saved' : r.message ?? 'Failed')
    })
  }

  const toggleCountry = (code: string) => {
    setOperatingCountries((c) => (c.includes(code) ? c.filter((x) => x !== code) : [...c, code]))
  }

  const handleSubmit = () => {
    setMessage(null)
    startTransition(async () => {
      const r = await updateAction({
        company_type: companyType || null,
        industry: industry || null,
        operating_countries: operatingCountries,
        default_review_cadence: cadence,
        esg_enabled: esg,
      })
      if (r.success) setMessage('Saved')
      else setMessage(r.message ?? 'Failed')
    })
  }

  const fieldset = canEdit ? '' : 'opacity-50 pointer-events-none'

  return (
    <div
      className={`rounded-2xl p-6 space-y-5 ${fieldset}`}
      style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}
    >
      {!canEdit && (
        <p className="text-xs" style={{ color: '#d97706' }}>Read-only — only site admins can edit company profile.</p>
      )}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Organisation Name</label>
        <input className={inputCls} style={{ ...inputStyle, opacity: 0.6 }} value={profile.name} disabled />
        <p className="text-[10px] mt-1" style={{ color: '#a99fd8' }}>To rename your organisation, contact support.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Company Type</label>
          <select className={inputCls} style={inputStyle} value={companyType} onChange={(e) => setCompanyType(e.target.value)}>
            <option value="">— Not set —</option>
            <option value="private">Private</option>
            <option value="public">Public</option>
            <option value="non_profit">Non-Profit</option>
            <option value="government">Government</option>
            <option value="sole_proprietor">Sole Proprietor</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Industry</label>
          <select className={inputCls} style={inputStyle} value={industry} onChange={(e) => setIndustry(e.target.value)}>
            <option value="">— Not set —</option>
            <option value="technology">Technology</option>
            <option value="financial_services">Financial Services</option>
            <option value="healthcare">Healthcare</option>
            <option value="retail">Retail</option>
            <option value="manufacturing">Manufacturing</option>
            <option value="logistics">Logistics</option>
            <option value="energy">Energy</option>
            <option value="government">Government</option>
            <option value="education">Education</option>
            <option value="professional_services">Professional Services</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Default Review Cadence</label>
          <select className={inputCls} style={inputStyle} value={cadence} onChange={(e) => setCadence(e.target.value)}>
            <option value="annual">Annual</option>
            <option value="biannual">Biannual</option>
            <option value="on_renewal">On Renewal</option>
            <option value="on_incident">On Incident</option>
          </select>
          <p className="text-[10px] mt-1" style={{ color: '#a99fd8' }}>
            Used as the default review cadence for new custom Review Packs.
          </p>
        </div>
        <div className="flex items-center gap-2 pt-7">
          <input id="esg" type="checkbox" checked={esg} onChange={(e) => setEsg(e.target.checked)} className="h-4 w-4 rounded" style={{ accentColor: '#6c5dd3' }} />
          <label htmlFor="esg" className="text-sm font-medium" style={{ color: '#4a4270' }}>ESG enabled</label>
          <p className="text-[10px] ml-2" style={{ color: '#a99fd8' }}>(Auto-applies the ESG &amp; Supplier Conduct pack to new vendors)</p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={labelStyle}>
          Operating Countries ({operatingCountries.length} selected)
        </label>
        <div className="rounded-xl p-3 max-h-48 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1" style={{ background: 'rgba(108,93,211,0.04)', border: '1px solid rgba(108,93,211,0.1)' }}>
          {countries.map((c) => (
            <label key={c.code} className="flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-[rgba(109,93,211,0.06)] cursor-pointer">
              <input
                type="checkbox"
                checked={operatingCountries.includes(c.code)}
                onChange={() => toggleCountry(c.code)}
                className="h-3.5 w-3.5 rounded shrink-0"
                style={{ accentColor: '#6c5dd3' }}
              />
              <span style={{ color: '#4a4270' }}>{c.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2" style={{ borderTop: '1px solid rgba(109,93,211,0.06)' }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !canEdit}
          className="text-sm font-semibold px-5 py-2 rounded-full text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
        >
          {isPending ? 'Saving…' : 'Save Changes'}
        </button>
        {message && <p className="text-xs" style={{ color: message === 'Saved' ? '#059669' : '#e11d48' }}>{message}</p>}
      </div>

      {/* ── Compliance Standards ── */}
      <div className="pt-4 mt-4" style={{ borderTop: '2px solid rgba(109,93,211,0.08)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#1e1550' }}>Compliance Standards</h3>
            <p className="text-xs mt-0.5" style={{ color: '#8b7fd4' }}>
              Select the standards your organisation is accountable to. These drive reporting filters and review item highlighting.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={saveStandards}
              disabled={isPending || !canEdit}
              className="text-xs font-semibold px-4 py-1.5 rounded-full text-white disabled:opacity-50"
              style={{ background: '#6c5dd3' }}
            >
              {isPending ? 'Saving…' : 'Save Standards'}
            </button>
            {standardsMsg && <span className="text-[11px]" style={{ color: standardsMsg === 'Saved' ? '#059669' : '#e11d48' }}>{standardsMsg}</span>}
          </div>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)' }}>
          {allStandards.map((s, i) => (
            <label
              key={s.code}
              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[rgba(109,93,211,0.02)] transition-colors"
              style={{ borderBottom: i === allStandards.length - 1 ? undefined : '1px solid rgba(109,93,211,0.04)' }}
            >
              <input
                type="checkbox"
                checked={standards.has(s.code)}
                onChange={() => toggleStandard(s.code)}
                disabled={!canEdit}
                className="h-4 w-4 rounded shrink-0"
                style={{ accentColor: '#6c5dd3' }}
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium" style={{ color: '#1e1550' }}>{s.code}</span>
                <span className="text-xs ml-2" style={{ color: '#8b7fd4' }}>{s.name}</span>
              </div>
              {standards.has(s.code) && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0" style={{ background: 'rgba(5,150,105,0.08)', color: '#059669' }}>
                  Selected
                </span>
              )}
            </label>
          ))}
        </div>

        <p className="text-[10px] mt-2" style={{ color: '#a99fd8' }}>
          {standards.size} standard{standards.size !== 1 ? 's' : ''} selected. Review items matching these standards will be highlighted during reviews.
        </p>
      </div>
    </div>
  )
}
