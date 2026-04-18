'use client'

import { useState, useTransition } from 'react'
import type { ReviewExportData } from '../actions'

interface Props {
  vendorId: string
  packId: string
  exportCsvAction: (vendorId: string, packId: string) => Promise<{ csv?: string; fileName?: string; message?: string }>
  exportPdfDataAction: (vendorId: string, packId: string) => Promise<{ data?: ReviewExportData; message?: string }>
}

const SECTIONS = [
  { key: 'items',       label: 'Review items & decisions',    default: true },
  { key: 'compliance',  label: 'Compliance references',       default: true },
  { key: 'comments',    label: 'Reviewer comments',           default: true },
  { key: 'evidence',    label: 'Evidence status',             default: false },
  { key: 'approvals',   label: 'Approval chain history',      default: false },
  { key: 'exceptions',  label: 'Exceptions',                  default: false },
] as const

type SectionKey = (typeof SECTIONS)[number]['key']

const DECISION_LABELS: Record<string, { label: string; color: [number, number, number] }> = {
  not_started:        { label: 'PENDING',   color: [148, 163, 184] },
  pass:               { label: 'PASS',      color: [5, 150, 105] },
  fail:               { label: 'FAIL',      color: [225, 29, 72] },
  na:                 { label: 'N/A',       color: [100, 116, 139] },
  needs_follow_up:    { label: 'FOLLOW-UP', color: [217, 119, 6] },
  exception_approved: { label: 'EXCEPTION', color: [124, 58, 237] },
}

async function generatePdf(data: ReviewExportData, sections: Set<SectionKey>) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 16

  // ── Header ──
  doc.setFontSize(18)
  doc.setTextColor(30, 21, 80) // #1e1550
  doc.text(data.packName, 14, y)
  y += 8

  doc.setFontSize(9)
  doc.setTextColor(139, 127, 212) // #8b7fd4
  const meta = [
    `Vendor: ${data.vendorName}${data.vendorCode ? ` (${data.vendorCode})` : ''}`,
    `Status: ${data.status.replace(/_/g, ' ')}`,
    `Type: ${data.reviewType}`,
    data.completedAt ? `Completed: ${new Date(data.completedAt).toLocaleDateString()}` : null,
  ].filter(Boolean).join('  ·  ')
  doc.text(meta, 14, y)
  y += 4

  if (data.packDescription) {
    doc.setFontSize(8)
    doc.text(data.packDescription, 14, y, { maxWidth: pageWidth - 28 })
    y += 5
  }

  // Purple divider
  doc.setDrawColor(108, 93, 211)
  doc.setLineWidth(0.5)
  doc.line(14, y, pageWidth - 14, y)
  y += 8

  // ── Summary stats ──
  const stats = [
    { label: 'Readiness', value: `${data.readinessPct}%`, color: data.readinessPct === 100 ? [5, 150, 105] : [108, 93, 211] },
    { label: 'Total Items', value: String(data.totalItems), color: [30, 21, 80] },
    { label: 'Passed', value: String(data.passedCount), color: [5, 150, 105] },
    { label: 'Failed', value: String(data.failedCount), color: [225, 29, 72] },
  ] as const

  const statWidth = (pageWidth - 28) / stats.length
  stats.forEach((stat, i) => {
    const x = 14 + i * statWidth + statWidth / 2
    doc.setFontSize(20)
    doc.setTextColor(...(stat.color as [number, number, number]))
    doc.text(stat.value, x, y, { align: 'center' })
    doc.setFontSize(7)
    doc.setTextColor(139, 127, 212)
    doc.text(stat.label.toUpperCase(), x, y + 5, { align: 'center' })
  })
  y += 14

  // ── Review items table ──
  if (sections.has('items')) {
    doc.setFontSize(11)
    doc.setTextColor(108, 93, 211)
    doc.text('REVIEW ITEMS', 14, y)
    y += 2

    const head = ['Requirement', 'Decision']
    if (sections.has('comments')) head.push('Comment')
    if (sections.has('compliance')) head.push('Compliance Refs')

    const body = data.items.map((item) => {
      const dec = DECISION_LABELS[item.decision] ?? { label: item.decision, color: [148, 163, 184] }
      const row: string[] = [item.name, dec.label]
      if (sections.has('comments')) row.push(item.comment ?? '—')
      if (sections.has('compliance')) {
        row.push(item.complianceRefs.map((r) => `${r.standard} ${r.reference}`).join(', ') || '—')
      }
      return row
    })

    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      theme: 'grid',
      headStyles: {
        fillColor: [248, 247, 252],
        textColor: [108, 93, 211],
        fontSize: 7,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 21, 80],
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: sections.has('compliance') ? 50 : 70 },
        1: { cellWidth: 22, halign: 'center' },
      },
      alternateRowStyles: { fillColor: [252, 251, 255] },
      margin: { left: 14, right: 14 },
      didParseCell(hookData) {
        // Color-code the decision column
        if (hookData.section === 'body' && hookData.column.index === 1) {
          const label = hookData.cell.raw as string
          const entry = Object.values(DECISION_LABELS).find((d) => d.label === label)
          if (entry) {
            hookData.cell.styles.textColor = entry.color
            hookData.cell.styles.fontStyle = 'bold'
          }
        }
      },
    })

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // ── Approval history ──
  if (sections.has('approvals') && data.approvals.length > 0) {
    if (y > 250) { doc.addPage(); y = 16 }

    doc.setFontSize(11)
    doc.setTextColor(108, 93, 211)
    doc.text('APPROVAL HISTORY', 14, y)
    y += 2

    autoTable(doc, {
      startY: y,
      head: [['Level', 'User', 'Decision', 'Comment', 'Date']],
      body: data.approvals.map((a) => [
        `Step ${a.level}`,
        a.userName,
        a.decision.replace(/_/g, ' '),
        a.comment ?? '—',
        new Date(a.decidedAt).toLocaleDateString(),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [248, 247, 252], textColor: [108, 93, 211], fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [30, 21, 80], cellPadding: 3 },
      alternateRowStyles: { fillColor: [252, 251, 255] },
      margin: { left: 14, right: 14 },
    })

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(169, 159, 216)
    doc.text(
      `Exported from VRM · ${new Date().toLocaleString()} · Confidential · Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' },
    )
  }

  // ── Download ──
  const packSlug = (data.packCode ?? 'review').replace(/[^a-zA-Z0-9]/g, '-')
  const vendorSlug = (data.vendorCode ?? 'vendor').replace(/[^a-zA-Z0-9]/g, '-')
  doc.save(`${vendorSlug}-${packSlug}-${new Date().toISOString().split('T')[0]}.pdf`)
}

export function ExportButton({ vendorId, packId, exportCsvAction, exportPdfDataAction }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv')
  const [selected, setSelected] = useState<Set<SectionKey>>(
    new Set(SECTIONS.filter((s) => s.default).map((s) => s.key)),
  )
  const [isPending, startTransition] = useTransition()

  const toggle = (key: SectionKey) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleExport = () => {
    startTransition(async () => {
      if (format === 'csv') {
        const r = await exportCsvAction(vendorId, packId)
        if (r.csv && r.fileName) {
          const blob = new Blob([r.csv], { type: 'text/csv' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = r.fileName
          a.click()
          URL.revokeObjectURL(url)
        } else if (r.message) {
          alert(r.message)
        }
      } else {
        const r = await exportPdfDataAction(vendorId, packId)
        if (r.data) {
          await generatePdf(r.data, selected)
        } else if (r.message) {
          alert(r.message)
        }
      }
      setIsOpen(false)
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.12)' }}
      >
        ↓ Export
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl p-4 space-y-3"
            style={{ background: 'white', border: '1px solid rgba(109,93,211,0.15)', boxShadow: '0 8px 24px rgba(109,93,211,0.15)' }}
          >
            <div className="text-sm font-semibold" style={{ color: '#1e1550' }}>Export Review</div>

            {/* Format */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8b7fd4' }}>Format</div>
              <div className="flex items-center gap-2">
                {(['csv', 'pdf'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className="text-xs font-medium px-3 py-1.5 rounded-full flex-1 uppercase"
                    style={format === f ? { background: '#6c5dd3', color: 'white' } : { background: 'rgba(109,93,211,0.06)', color: '#6c5dd3' }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* What to include */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8b7fd4' }}>Include</div>
              <div className="space-y-1">
                {SECTIONS.map((s) => (
                  <label key={s.key} className="flex items-center gap-2 cursor-pointer py-0.5">
                    <input
                      type="checkbox"
                      checked={selected.has(s.key)}
                      onChange={() => toggle(s.key)}
                      className="w-3.5 h-3.5 rounded"
                      style={{ accentColor: '#6c5dd3' }}
                    />
                    <span className="text-xs" style={{ color: '#4a4270' }}>{s.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2" style={{ borderTop: '1px solid rgba(109,93,211,0.06)' }}>
              <button type="button" onClick={() => setIsOpen(false)} className="text-xs px-3 py-1.5" style={{ color: '#a99fd8' }}>Cancel</button>
              <button
                type="button"
                onClick={handleExport}
                disabled={isPending || selected.size === 0}
                className="text-xs font-semibold px-4 py-1.5 rounded-full text-white disabled:opacity-50"
                style={{ background: '#6c5dd3' }}
              >
                {isPending ? 'Exporting…' : format === 'csv' ? '↓ Download CSV' : '↓ Download PDF'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
