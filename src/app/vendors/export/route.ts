import { NextResponse } from 'next/server'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendors } from '@/lib/db/vendors'
import { getVendorListMetrics } from '@/lib/db/review-packs'
import { getCountryName } from '@/lib/countries'

export const dynamic = 'force-dynamic'

const HEADERS = [
  'vendor_code', 'name', 'legal_name', 'categories', 'service_types', 'criticality_tier',
  'is_critical', 'data_access_levels', 'processes_personal_data', 'annual_spend',
  'status', 'approval_status', 'approved_at', 'exception_reason',
  'internal_owner_name', 'internal_owner_email', 'primary_email', 'phone', 'website_url', 'country',
  'last_reviewed_at', 'next_review_due_at',
  'risk_band', 'risk_score', 'readiness_pct', 'readiness_completed', 'readiness_applicable',
  'missing_evidence_count', 'open_remediation_count',
  'created_at', 'updated_at',
]

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET() {
  const user = await requireCurrentUser()

  // Pull all vendors (large page size to get them all in one go for now)
  const result = await getVendors(user.orgId, { pageSize: 1000 })
  const metrics = await getVendorListMetrics(
    result.rows.map((v) => ({ id: v.id, approval_status: v.approval_status })),
  )

  const lines: string[] = [HEADERS.join(',')]
  for (const v of result.rows) {
    const m = metrics.get(v.id)
    const row = [
      v.vendor_code,
      v.name,
      v.legal_name,
      v.vendor_categories.map((c) => c.name).join('; '),
      v.service_types.join('; '),
      v.criticality_tier,
      v.is_critical,
      v.data_access_levels.join('; '),
      v.processes_personal_data,
      v.annual_spend,
      v.status,
      v.approval_status,
      v.approved_at,
      v.exception_reason,
      v.internal_owner?.name ?? '',
      v.internal_owner?.email ?? '',
      v.primary_email,
      v.phone,
      v.website_url,
      getCountryName(v.country_code) ?? '',
      v.last_reviewed_at,
      v.next_review_due_at,
      m?.risk.band ?? '',
      m?.risk.score ?? '',
      m?.readinessPct ?? '',
      m?.completed ?? '',
      m?.applicable ?? '',
      m?.missingEvidenceCount ?? '',
      m?.openRemediationCount ?? '',
      v.created_at,
      v.updated_at,
    ]
    lines.push(row.map(csvEscape).join(','))
  }

  const csv = lines.join('\n')
  const filename = `vendors-${new Date().toISOString().split('T')[0]}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
