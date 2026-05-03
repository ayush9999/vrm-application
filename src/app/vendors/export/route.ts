import { NextResponse, type NextRequest } from 'next/server'
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

function parseList(v: string | null): string[] | undefined {
  if (!v) return undefined
  const arr = v.split(',').map((s) => s.trim()).filter(Boolean)
  return arr.length > 0 ? arr : undefined
}

export async function GET(req: NextRequest) {
  const user = await requireCurrentUser()
  const sp = req.nextUrl.searchParams

  const format = (sp.get('format') ?? 'csv').toLowerCase() as 'csv' | 'pdf'
  const vendorIds = parseList(sp.get('ids'))
  const serviceTypes = parseList(sp.get('service_types'))
  const approvalStatuses = parseList(sp.get('approval_statuses'))
  const criticalParam = sp.get('critical') // 'true' | 'false' | null
  const isCritical = criticalParam === 'true' ? true : criticalParam === 'false' ? false : undefined

  const result = await getVendors(user.orgId, {
    pageSize: 5000,
    vendorIds,
    serviceTypes,
    approvalStatuses,
    isCritical,
  })
  const metrics = await getVendorListMetrics(
    result.rows.map((v) => ({ id: v.id, approval_status: v.approval_status })),
  )

  if (format === 'pdf') {
    return await renderPdf(result.rows, metrics, {
      vendorIds,
      serviceTypes,
      approvalStatuses,
      isCritical,
    })
  }

  return renderCsv(result.rows, metrics)
}

function renderCsv(
  vendors: Awaited<ReturnType<typeof getVendors>>['rows'],
  metrics: Awaited<ReturnType<typeof getVendorListMetrics>>,
) {
  const lines: string[] = [HEADERS.join(',')]
  for (const v of vendors) {
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

async function renderPdf(
  vendors: Awaited<ReturnType<typeof getVendors>>['rows'],
  metrics: Awaited<ReturnType<typeof getVendorListMetrics>>,
  filters: {
    vendorIds?: string[]
    serviceTypes?: string[]
    approvalStatuses?: string[]
    isCritical?: boolean
  },
): Promise<NextResponse> {
  // Dynamically import jspdf — it's a heavy client lib, no need to bundle in cold starts elsewhere.
  const { jsPDF } = await import('jspdf')
  const autoTableModule = await import('jspdf-autotable')
  const autoTable = (autoTableModule as { default?: typeof autoTableModule } & typeof autoTableModule).default
    ?? (autoTableModule as unknown as typeof autoTableModule)

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor('#1e1550')
  doc.text('Vendor Export', 32, 40)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor('#5d5285')
  const exportedAt = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  doc.text(`${vendors.length} vendor${vendors.length === 1 ? '' : 's'} · exported ${exportedAt}`, 32, 56)

  // Filter summary line
  const filterParts: string[] = []
  if (filters.vendorIds && filters.vendorIds.length > 0) filterParts.push(`Specific: ${filters.vendorIds.length} selected`)
  if (filters.isCritical === true) filterParts.push('Critical only')
  if (filters.isCritical === false) filterParts.push('Non-critical only')
  if (filters.serviceTypes && filters.serviceTypes.length > 0) filterParts.push(`Service: ${filters.serviceTypes.join(', ')}`)
  if (filters.approvalStatuses && filters.approvalStatuses.length > 0) filterParts.push(`Status: ${filters.approvalStatuses.join(', ')}`)
  if (filterParts.length > 0) {
    doc.setTextColor('#6c5dd3')
    doc.text(`Filters: ${filterParts.join(' · ')}`, 32, 70)
  }

  // Table
  const head = [[
    'Code', 'Name', 'Categories', 'Service Types', 'Tier', 'Critical',
    'Status', 'Approval', 'Risk', 'Readiness', 'Owner',
  ]]
  const body = vendors.map((v) => {
    const m = metrics.get(v.id)
    return [
      v.vendor_code ?? '',
      v.name,
      v.vendor_categories.map((c) => c.name).join(', ') || '—',
      v.service_types.join(', ') || '—',
      v.criticality_tier != null ? `T${v.criticality_tier}` : '—',
      v.is_critical ? 'Yes' : 'No',
      v.status,
      v.approval_status,
      m ? `${m.risk.band} (${m.risk.score})` : '—',
      m ? `${m.readinessPct}%` : '—',
      v.internal_owner?.name ?? v.internal_owner?.email ?? '—',
    ]
  })

  autoTable(doc, {
    head,
    body,
    startY: filterParts.length > 0 ? 84 : 72,
    margin: { left: 32, right: 32 },
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [108, 93, 211], textColor: '#ffffff', fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 247, 252] },
    columnStyles: {
      0: { cellWidth: 60 },     // Code
      1: { cellWidth: 110 },    // Name
      2: { cellWidth: 100 },    // Categories
      3: { cellWidth: 90 },     // Service Types
      4: { cellWidth: 36, halign: 'center' },
      5: { cellWidth: 50, halign: 'center' },
      6: { cellWidth: 70 },
      7: { cellWidth: 90 },
      8: { cellWidth: 60 },
      9: { cellWidth: 56, halign: 'right' },
      10: { cellWidth: 'auto' },
    },
    didDrawPage: (data) => {
      // Footer with page number
      const pageCount = doc.internal.pages.length - 1
      doc.setFontSize(8)
      doc.setTextColor('#6b5fa8')
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        pageWidth - 32, doc.internal.pageSize.getHeight() - 18,
        { align: 'right' },
      )
    },
  })

  const pdfBytes = doc.output('arraybuffer')
  const filename = `vendors-${new Date().toISOString().split('T')[0]}.pdf`

  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
