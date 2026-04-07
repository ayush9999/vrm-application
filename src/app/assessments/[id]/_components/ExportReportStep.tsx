'use client'

import React, { useState, useRef } from 'react'
import type {
  VendorAssessment,
  AssessmentItem,
  AssessmentFinding,
  AssessmentReport,
  AssessmentFramework,
  AssessmentItemStatus,
} from '@/types/assessment'
import type { VendorDocStatus } from '@/lib/db/documents'

// ─── Status helpers ──────────────────────────────────────────────────────────

const STATUS_COLOR: Record<AssessmentItemStatus, string> = {
  not_started:     '#a99fd8',
  in_progress:     '#6c5dd3',
  satisfactory:    '#059669',
  needs_attention: '#d97706',
  high_risk:       '#e11d48',
  mitigated:       '#0ea5e9',
  not_applicable:  '#94a3b8',
}
const STATUS_LABEL: Record<AssessmentItemStatus, string> = {
  not_started:     'Not Started',
  in_progress:     'In Progress',
  satisfactory:    'Satisfactory',
  needs_attention: 'Needs Attention',
  high_risk:       'High Risk',
  mitigated:       'Mitigated',
  not_applicable:  'N/A',
}

const SEVERITY_CLS: Record<string, string> = {
  high:   'bg-rose-100 text-rose-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-[rgba(169,159,216,0.12)] text-[#a99fd8]',
}

type DetailLevel = 'summary' | 'standard' | 'detailed'

// ─── Props ───────────────────────────────────────────────────────────────────

interface ExportReportStepProps {
  assessment: VendorAssessment
  items: AssessmentItem[]
  findings: AssessmentFinding[]
  reports: AssessmentReport[]
  frameworks: AssessmentFramework[]
  vendorDocStatus: Map<string, VendorDocStatus>
  orgStandardIds: Set<string>
  isFinished: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ExportReportStep({
  assessment,
  items,
  findings,
  reports,
  frameworks,
  vendorDocStatus,
  orgStandardIds,
  isFinished,
}: ExportReportStepProps) {
  const printRef = useRef<HTMLDivElement>(null)

  // Export config state
  const [includeVendorInfo, setIncludeVendorInfo] = useState(true)
  const [includeSummary, setIncludeSummary] = useState(true)
  const [includeItems, setIncludeItems] = useState(true)
  const [includeFindings, setIncludeFindings] = useState(true)
  const [includeDocEvidence, setIncludeDocEvidence] = useState(true)
  const [includeComplianceMapping, setIncludeComplianceMapping] = useState(true)
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('standard')
  const [copied, setCopied] = useState(false)

  // Derived data
  const frameworkById = new Map(frameworks.map(f => [f.id, f]))
  const byFramework = new Map<string | null, Map<string, AssessmentItem[]>>()
  for (const item of items) {
    const fwId = item.framework_id ?? null
    if (!byFramework.has(fwId)) byFramework.set(fwId, new Map())
    const byDomain = byFramework.get(fwId)!
    const domain = item.category ?? 'Uncategorised'
    if (!byDomain.has(domain)) byDomain.set(domain, [])
    byDomain.get(domain)!.push(item)
  }
  const orderedFwIds = [
    ...frameworks.map(f => f.id).filter(id => byFramework.has(id)),
    ...(byFramework.has(null) ? [null] : []),
  ] as (string | null)[]

  const openFindings = findings.filter(f => f.status === 'open')
  const highFindings = findings.filter(f => f.severity === 'high' && f.status === 'open')
  const mitigatedFindings = findings.filter(f => f.status === 'mitigated')
  const docCheckItems = items.filter(i => i.expected_document_type_id)

  function handlePrint() {
    // Print just the report preview area
    const content = printRef.current
    if (!content) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${assessment.title ?? 'Assessment Report'}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e1550; padding: 40px; font-size: 12px; line-height: 1.5; }
            h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
            h2 { font-size: 14px; font-weight: 600; margin: 20px 0 8px; color: #6c5dd3; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
            h3 { font-size: 12px; font-weight: 600; margin: 12px 0 4px; color: #3d2e8a; }
            .meta { color: #6b5fa8; font-size: 11px; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 600; }
            .badge-purple { background: rgba(109,93,211,0.1); color: #6c5dd3; }
            .badge-green { background: rgba(5,150,105,0.1); color: #059669; }
            .badge-red { background: rgba(225,29,72,0.1); color: #e11d48; }
            .badge-amber { background: rgba(217,119,6,0.1); color: #d97706; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 12px 0; }
            .stat-card { text-align: center; padding: 8px; border: 1px solid #e5e7eb; border-radius: 8px; }
            .stat-card .value { font-size: 22px; font-weight: 700; }
            .stat-card .label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #a99fd8; }
            table { width: 100%; border-collapse: collapse; margin: 8px 0; }
            th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
            th { font-weight: 600; color: #6b5fa8; background: #f8f7fc; }
            .finding-card { padding: 8px; margin: 4px 0; border: 1px solid #e5e7eb; border-radius: 6px; }
            .compliance-tag { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; background: rgba(109,93,211,0.08); color: #6c5dd3; margin: 1px 2px; }
            .status-pill { display: inline-block; padding: 1px 8px; border-radius: 9999px; font-size: 10px; font-weight: 600; }
            .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #a99fd8; text-align: center; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          ${content.innerHTML}
          <div class="footer">
            Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} — Vendor Risk Management Platform
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 300)
  }

  function handleShare() {
    const token = assessment.share_token
    const url = token
      ? `${window.location.origin}/reports/${token}`
      : window.location.href
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: '#1e1550' }}>Export Report</h2>
        <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>
          Configure what to include in the report and export as PDF.
        </p>
      </div>

      {/* ── Configuration Panel ─────────────────────────────────────── */}
      <div
        className="rounded-xl p-5 space-y-5"
        style={{ background: 'rgba(109,93,211,0.03)', border: '1px solid rgba(109,93,211,0.12)' }}
      >
        <div>
          <p className="text-xs font-semibold mb-3" style={{ color: '#3d2e8a' }}>Include Sections</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <CheckboxOption label="Vendor Information" checked={includeVendorInfo} onChange={setIncludeVendorInfo} />
            <CheckboxOption label="Summary & Recommendation" checked={includeSummary} onChange={setIncludeSummary} />
            <CheckboxOption label="Review Items" checked={includeItems} onChange={setIncludeItems} />
            <CheckboxOption label="Findings & Mitigations" checked={includeFindings} onChange={setIncludeFindings} />
            <CheckboxOption label="Document Evidence" checked={includeDocEvidence} onChange={setIncludeDocEvidence} />
            <CheckboxOption label="Compliance Mapping" checked={includeComplianceMapping} onChange={setIncludeComplianceMapping} />
          </div>
        </div>

        {includeItems && (
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: '#3d2e8a' }}>Item Detail Level</p>
            <div className="flex items-center gap-3">
              {([
                { value: 'summary', label: 'Summary Only', desc: 'Stats and counts per domain' },
                { value: 'standard', label: 'Standard', desc: 'Title, status, and score' },
                { value: 'detailed', label: 'Detailed', desc: 'Full rationale, notes, and evidence' },
              ] as const).map(opt => (
                <label
                  key={opt.value}
                  className="flex-1 cursor-pointer rounded-xl p-3 transition-all"
                  style={{
                    border: detailLevel === opt.value ? '2px solid #6c5dd3' : '1px solid rgba(109,93,211,0.15)',
                    background: detailLevel === opt.value ? 'rgba(109,93,211,0.06)' : 'white',
                  }}
                >
                  <input
                    type="radio"
                    name="detail_level"
                    value={opt.value}
                    checked={detailLevel === opt.value}
                    onChange={() => setDetailLevel(opt.value)}
                    className="sr-only"
                  />
                  <p className="text-xs font-semibold" style={{ color: detailLevel === opt.value ? '#6c5dd3' : '#3d2e8a' }}>
                    {opt.label}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#a99fd8' }}>{opt.desc}</p>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Export actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 4px 12px rgba(108,93,211,0.3)' }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2" />
              <rect x="4" y="9" width="8" height="5" rx="0.5" />
              <path d="M4 5V1.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5V5" />
            </svg>
            Export PDF
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium transition-all hover:opacity-80"
            style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.2)' }}
          >
            {copied ? '✓ Link copied!' : '↗ Share Report'}
          </button>
          <span className="text-[10px]" style={{ color: '#a99fd8' }}>
            {assessment.share_token ? 'Shareable link active' : 'Share copies current URL'}
          </span>
        </div>
        <p className="text-[10px]" style={{ color: '#a99fd8' }}>
          {reports.length > 0
            ? `Last snapshot: ${new Date(reports[0].created_at).toLocaleDateString()}`
            : 'No report snapshots yet'}
        </p>
      </div>

      {/* ── Report Preview ──────────────────────────────────────────── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(109,93,211,0.15)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ background: 'rgba(109,93,211,0.05)', borderBottom: '1px solid rgba(109,93,211,0.1)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
            Report Preview
          </p>
          <span className="text-[10px]" style={{ color: '#c4bae8' }}>
            What you see below is what will be exported
          </span>
        </div>

        <div ref={printRef} className="px-5 py-4 space-y-4 bg-white">
          {/* Title */}
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#1e1550' }}>
              {assessment.title ?? 'Assessment Report'}
            </h1>
            {assessment.frameworks?.length > 0 && (
              <p style={{ fontSize: '11px', color: '#a99fd8', marginTop: '2px' }}>
                {assessment.frameworks.map(f => f.name).join(' · ')}
              </p>
            )}
            <p style={{ fontSize: '11px', color: '#a99fd8', marginTop: '2px' }}>
              Generated {new Date().toLocaleDateString()}
            </p>
          </div>

          {/* Vendor Info */}
          {includeVendorInfo && assessment.vendor && (
            <div>
              <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#6c5dd3', borderBottom: '1px solid rgba(109,93,211,0.1)', paddingBottom: '4px', marginBottom: '8px' }}>
                Vendor Information
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <PrintMeta label="Vendor" value={assessment.vendor.name} />
                <PrintMeta label="Status" value={assessment.status.replace(/_/g, ' ')} />
                <PrintMeta label="Period" value={assessment.period_type ?? '—'} />
                {assessment.period_start && <PrintMeta label="Start" value={new Date(assessment.period_start).toLocaleDateString()} />}
                {assessment.period_end && <PrintMeta label="End" value={new Date(assessment.period_end).toLocaleDateString()} />}
                <PrintMeta label="Risk Level" value={assessment.risk_level ?? '—'} />
                <PrintMeta label="Score" value={assessment.overall_score != null ? `${assessment.overall_score}%` : '—'} />
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Controls', value: items.length, color: '#6c5dd3' },
              { label: 'Passed', value: items.filter(i => i.status === 'satisfactory' || i.status === 'mitigated').length, color: '#059669' },
              { label: 'Failed', value: items.filter(i => i.status === 'high_risk' || i.status === 'needs_attention').length, color: items.filter(i => i.status === 'high_risk' || i.status === 'needs_attention').length > 0 ? '#e11d48' : '#059669' },
              { label: 'Findings', value: findings.length, color: '#6c5dd3' },
              { label: 'Open Findings', value: openFindings.length, color: openFindings.length > 0 ? '#d97706' : '#059669' },
              { label: 'High Severity', value: highFindings.length, color: highFindings.length > 0 ? '#e11d48' : '#059669' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', padding: '8px', border: '1px solid rgba(109,93,211,0.1)', borderRadius: '8px' }}>
                <p style={{ fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#a99fd8' }}>{s.label}</p>
                <p style={{ fontSize: '22px', fontWeight: 700, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Summary */}
          {includeSummary && (assessment.final_summary || assessment.final_recommendation) && (
            <div>
              <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#6c5dd3', borderBottom: '1px solid rgba(109,93,211,0.1)', paddingBottom: '4px', marginBottom: '8px' }}>
                Summary & Recommendation
              </h2>
              {assessment.final_summary && (
                <p style={{ fontSize: '12px', color: '#1e1550', marginBottom: '6px', lineHeight: 1.6 }}>{assessment.final_summary}</p>
              )}
              {assessment.final_recommendation && (
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#059669' }}>
                  Recommendation: {assessment.final_recommendation}
                </p>
              )}
              {assessment.human_notes && (
                <p style={{ fontSize: '11px', color: '#6b5fa8', marginTop: '6px' }}>
                  Notes: {assessment.human_notes}
                </p>
              )}
            </div>
          )}

          {/* Items */}
          {includeItems && items.length > 0 && (
            <div>
              <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#6c5dd3', borderBottom: '1px solid rgba(109,93,211,0.1)', paddingBottom: '4px', marginBottom: '8px' }}>
                Review Items
              </h2>
              {orderedFwIds.map(fwId => {
                const fw = fwId ? frameworkById.get(fwId) : null
                const domains = byFramework.get(fwId)!
                return (
                  <div key={fwId ?? 'none'} style={{ marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#3d2e8a', marginBottom: '6px' }}>
                      {fw?.name ?? 'Other Items'}
                    </h3>
                    {detailLevel === 'summary' ? (
                      // Summary: stats per domain
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '10px', fontWeight: 600, color: '#6b5fa8', background: '#f8f7fc', borderBottom: '1px solid #e5e7eb' }}>Domain</th>
                            <th style={{ textAlign: 'center', padding: '4px 8px', fontSize: '10px', fontWeight: 600, color: '#6b5fa8', background: '#f8f7fc', borderBottom: '1px solid #e5e7eb' }}>Total</th>
                            <th style={{ textAlign: 'center', padding: '4px 8px', fontSize: '10px', fontWeight: 600, color: '#6b5fa8', background: '#f8f7fc', borderBottom: '1px solid #e5e7eb' }}>Satisfactory</th>
                            <th style={{ textAlign: 'center', padding: '4px 8px', fontSize: '10px', fontWeight: 600, color: '#6b5fa8', background: '#f8f7fc', borderBottom: '1px solid #e5e7eb' }}>Flagged</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from(domains.entries()).map(([domain, domainItems]) => {
                            const passed = domainItems.filter(i => i.status === 'satisfactory' || i.status === 'mitigated').length
                            const failed = domainItems.filter(i => i.status === 'needs_attention' || i.status === 'high_risk').length
                            const domainSignal = failed > 0 ? '#e11d48' : passed === domainItems.length ? '#059669' : 'transparent'
                            return (
                              <tr key={domain} style={{ borderLeft: `3px solid ${domainSignal}` }}>
                                <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #f1f5f9', fontWeight: 500 }}>{domain || 'General'}</td>
                                <td style={{ textAlign: 'center', padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #f1f5f9' }}>{domainItems.length}</td>
                                <td style={{ textAlign: 'center', padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #f1f5f9', color: '#059669', fontWeight: 600 }}>{passed}</td>
                                <td style={{ textAlign: 'center', padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #f1f5f9', color: failed > 0 ? '#e11d48' : '#94a3b8', fontWeight: failed > 0 ? 600 : 400 }}>{failed}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    ) : (
                      // Standard / Detailed
                      Array.from(domains.entries()).map(([domain, domainItems]) => (
                        <div key={domain} style={{ marginBottom: '8px' }}>
                          <p style={{ fontSize: '11px', fontWeight: 600, color: '#8b7fd4', marginBottom: '4px', paddingLeft: '8px', borderLeft: '2px solid rgba(109,93,211,0.2)' }}>
                            {domain || 'General'}
                          </p>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '10px', fontWeight: 600, color: '#6b5fa8', background: '#f8f7fc', borderBottom: '1px solid #e5e7eb' }}>Control</th>
                                <th style={{ textAlign: 'center', padding: '4px 8px', fontSize: '10px', fontWeight: 600, color: '#6b5fa8', background: '#f8f7fc', borderBottom: '1px solid #e5e7eb', width: '90px' }}>Result</th>
                                <th style={{ textAlign: 'center', padding: '4px 8px', fontSize: '10px', fontWeight: 600, color: '#6b5fa8', background: '#f8f7fc', borderBottom: '1px solid #e5e7eb', width: '50px' }}>Score</th>
                                {includeComplianceMapping && (
                                  <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '10px', fontWeight: 600, color: '#6b5fa8', background: '#f8f7fc', borderBottom: '1px solid #e5e7eb' }}>Compliance</th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {domainItems.map(item => {
                                const refs = includeComplianceMapping
                                  ? (item.mapped_standard_refs ?? []).filter(r => orgStandardIds.has(r.standard_id))
                                  : []
                                const rowBorder = (item.status === 'satisfactory' || item.status === 'mitigated')
                                  ? '#059669' : (item.status === 'high_risk' || item.status === 'needs_attention')
                                  ? '#e11d48' : 'transparent'
                                return (
                                  <React.Fragment key={item.id}>
                                    <tr style={{ borderLeft: `3px solid ${rowBorder}` }}>
                                      <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #f1f5f9' }}>
                                        {item.title}
                                        {item.required && <span style={{ color: '#e11d48', fontSize: '10px', marginLeft: '4px' }}>*</span>}
                                      </td>
                                      <td style={{ textAlign: 'center', padding: '4px 8px', fontSize: '10px', borderBottom: '1px solid #f1f5f9' }}>
                                        {(item.status === 'satisfactory' || item.status === 'mitigated') ? (
                                          <span style={{
                                            display: 'inline-block', padding: '2px 10px', borderRadius: '4px',
                                            fontSize: '10px', fontWeight: 700, color: '#fff', background: '#059669',
                                            textTransform: 'uppercase', letterSpacing: '0.5px',
                                          }}>
                                            ✓ PASS
                                          </span>
                                        ) : (item.status === 'high_risk' || item.status === 'needs_attention') ? (
                                          <span style={{
                                            display: 'inline-block', padding: '2px 10px', borderRadius: '4px',
                                            fontSize: '10px', fontWeight: 700, color: '#fff', background: '#e11d48',
                                            textTransform: 'uppercase', letterSpacing: '0.5px',
                                          }}>
                                            ✗ FAIL
                                          </span>
                                        ) : (
                                          <span style={{
                                            display: 'inline-block', padding: '1px 8px', borderRadius: '9999px',
                                            fontSize: '10px', fontWeight: 600,
                                            color: STATUS_COLOR[item.status], background: `${STATUS_COLOR[item.status]}15`,
                                          }}>
                                            {STATUS_LABEL[item.status]}
                                          </span>
                                        )}
                                      </td>
                                      <td style={{ textAlign: 'center', padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #f1f5f9', color: '#6c5dd3', fontWeight: 600 }}>
                                        {item.score ?? '—'}
                                      </td>
                                      {includeComplianceMapping && (
                                        <td style={{ padding: '4px 8px', fontSize: '10px', borderBottom: '1px solid #f1f5f9' }}>
                                          {refs.map(r => (
                                            <span
                                              key={`${r.standard_id}-${r.ref}`}
                                              className="compliance-tag"
                                              style={{ display: 'inline-block', padding: '1px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 600, background: 'rgba(109,93,211,0.08)', color: '#6c5dd3', margin: '1px 2px' }}
                                            >
                                              {r.standard_name} › {r.ref}
                                            </span>
                                          ))}
                                        </td>
                                      )}
                                    </tr>
                                    {detailLevel === 'detailed' && (item.rationale || item.reviewer_notes) && (
                                      <tr>
                                        <td colSpan={includeComplianceMapping ? 4 : 3} style={{ padding: '2px 8px 6px 20px', fontSize: '10px', color: '#6b5fa8', borderBottom: '1px solid #f1f5f9' }}>
                                          {item.rationale && <p>Rationale: {item.rationale}</p>}
                                          {item.reviewer_notes && <p>Notes: {item.reviewer_notes}</p>}
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      ))
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Findings */}
          {includeFindings && findings.length > 0 && (
            <div>
              <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#6c5dd3', borderBottom: '1px solid rgba(109,93,211,0.1)', paddingBottom: '4px', marginBottom: '8px' }}>
                Findings ({findings.length})
              </h2>
              {findings.map(f => {
                const linkedItem = f.assessment_item_id ? items.find(i => i.id === f.assessment_item_id) : null
                const refs = includeComplianceMapping
                  ? (linkedItem?.mapped_standard_refs ?? []).filter(r => orgStandardIds.has(r.standard_id))
                  : []
                return (
                  <div
                    key={f.id}
                    style={{ padding: '8px', margin: '4px 0', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span
                        className={SEVERITY_CLS[f.severity] ?? ''}
                        style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}
                      >
                        {f.severity}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e1550' }}>{f.title}</span>
                      <span style={{ fontSize: '10px', color: '#a99fd8' }}>({f.status})</span>
                    </div>
                    {f.description && (
                      <p style={{ fontSize: '11px', color: '#6b5fa8', marginTop: '4px' }}>{f.description}</p>
                    )}
                    {refs.length > 0 && (
                      <div style={{ marginTop: '4px' }}>
                        <span style={{ fontSize: '10px', color: '#a99fd8' }}>Compliance: </span>
                        {refs.map(r => (
                          <span
                            key={`${r.standard_id}-${r.ref}`}
                            style={{ display: 'inline-block', padding: '1px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 600, background: 'rgba(109,93,211,0.08)', color: '#6c5dd3', margin: '1px 2px' }}
                          >
                            {r.standard_name} › {r.ref}
                          </span>
                        ))}
                      </div>
                    )}
                    {f.mitigations && f.mitigations.length > 0 && (
                      <div style={{ marginTop: '6px', paddingLeft: '10px', borderLeft: '2px solid rgba(5,150,105,0.2)' }}>
                        <p style={{ fontSize: '10px', fontWeight: 600, color: '#059669', marginBottom: '2px' }}>Mitigations</p>
                        {f.mitigations.map(m => (
                          <div key={m.id} style={{ marginBottom: '3px' }}>
                            <p style={{ fontSize: '11px', color: '#1e1550' }}>{m.action} <span style={{ color: '#a99fd8', fontSize: '10px' }}>({m.status})</span></p>
                            {m.due_at && <p style={{ fontSize: '10px', color: '#a99fd8' }}>Due: {new Date(m.due_at).toLocaleDateString()}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Document Evidence */}
          {includeDocEvidence && docCheckItems.length > 0 && (
            <div>
              <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#6c5dd3', borderBottom: '1px solid rgba(109,93,211,0.1)', paddingBottom: '4px', marginBottom: '8px' }}>
                Document Evidence ({docCheckItems.length})
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '10px', fontWeight: 600, color: '#6b5fa8', background: '#f8f7fc', borderBottom: '1px solid #e5e7eb' }}>Document</th>
                    <th style={{ textAlign: 'center', padding: '4px 8px', fontSize: '10px', fontWeight: 600, color: '#6b5fa8', background: '#f8f7fc', borderBottom: '1px solid #e5e7eb', width: '70px' }}>Required</th>
                    <th style={{ textAlign: 'center', padding: '4px 8px', fontSize: '10px', fontWeight: 600, color: '#6b5fa8', background: '#f8f7fc', borderBottom: '1px solid #e5e7eb', width: '80px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {docCheckItems.map(item => {
                    const ds = vendorDocStatus.get(item.expected_document_type_id!)
                    const statusLabel = ds?.status === 'uploaded' ? 'Uploaded' : ds?.status === 'expired' ? 'Expired' : 'Missing'
                    const statusColor = ds?.status === 'uploaded' ? '#059669' : ds?.status === 'expired' ? '#e11d48' : '#a99fd8'
                    return (
                      <tr key={item.id}>
                        <td style={{ padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #f1f5f9' }}>{item.title}</td>
                        <td style={{ textAlign: 'center', padding: '4px 8px', fontSize: '10px', borderBottom: '1px solid #f1f5f9' }}>
                          {item.required ? 'Yes' : 'No'}
                        </td>
                        <td style={{ textAlign: 'center', padding: '4px 8px', fontSize: '10px', fontWeight: 600, borderBottom: '1px solid #f1f5f9', color: statusColor }}>
                          {statusLabel}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CheckboxOption({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded"
        style={{ accentColor: '#6c5dd3' }}
      />
      <span className="text-xs" style={{ color: '#3d2e8a' }}>{label}</span>
    </label>
  )
}

function PrintMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#a99fd8', marginBottom: '1px' }}>{label}</p>
      <p style={{ fontSize: '12px', color: '#3d2e8a', textTransform: 'capitalize' }}>{value}</p>
    </div>
  )
}
