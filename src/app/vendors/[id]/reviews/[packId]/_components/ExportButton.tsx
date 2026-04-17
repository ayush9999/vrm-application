'use client'

import { useState, useTransition } from 'react'

interface Props {
  vendorId: string
  packId: string
  exportAction: (vendorId: string, packId: string) => Promise<{ csv?: string; fileName?: string; message?: string }>
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

export function ExportButton({ vendorId, packId, exportAction }: Props) {
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
    if (format === 'csv') {
      startTransition(async () => {
        const r = await exportAction(vendorId, packId)
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
        setIsOpen(false)
      })
    } else {
      // PDF — open print-friendly page in new tab
      const params = new URLSearchParams()
      for (const s of selected) params.append('include', s)
      window.open(`/vendors/${vendorId}/reviews/${packId}/print?${params.toString()}`, '_blank')
      setIsOpen(false)
    }
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
                {isPending ? 'Exporting…' : format === 'csv' ? '↓ Download CSV' : '🖨 Generate PDF'}
              </button>
            </div>

            {format === 'pdf' && (
              <p className="text-[10px]" style={{ color: '#a99fd8' }}>
                Opens a print-optimized page. Use Ctrl+P → &quot;Save as PDF&quot;.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
