'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { ReviewVendorRow } from '@/lib/db/reviews-by-vendor'
import { RISK_BAND_STYLE } from '@/lib/risk-score'

interface Props {
  vendors: ReviewVendorRow[]
  todayStr: string
}

type ColId =
  | 'select' | 'vendor' | 'reviews' | 'readiness' | 'risk'
  | 'next_due' | 'approval' | 'actions'

interface ColumnDef {
  id: ColId
  label: string
  defaultWidth: number
  minWidth: number
  align?: 'left' | 'center' | 'right'
  canHide: boolean
  canResize: boolean
}

const COLUMNS: ColumnDef[] = [
  { id: 'select',    label: '',          defaultWidth: 52,  minWidth: 52,  canHide: false, canResize: false, align: 'center' },
  { id: 'vendor',    label: 'Vendor',    defaultWidth: 220, minWidth: 160, canHide: false, canResize: true },
  { id: 'reviews',   label: 'Reviews',   defaultWidth: 240, minWidth: 160, canHide: true,  canResize: true },
  { id: 'readiness', label: 'Readiness', defaultWidth: 150, minWidth: 110, canHide: true,  canResize: true },
  { id: 'risk',      label: 'Risk',      defaultWidth: 130, minWidth: 100, canHide: true,  canResize: true },
  { id: 'next_due',  label: 'Next Due',  defaultWidth: 120, minWidth: 90,  canHide: true,  canResize: true },
  { id: 'approval',  label: 'Approval',  defaultWidth: 140, minWidth: 110, canHide: true,  canResize: true },
  { id: 'actions',   label: '',          defaultWidth: 130, minWidth: 100, canHide: false, canResize: false, align: 'right' },
]

const STORAGE_WIDTHS = 'vrm.reviewsTable.widths'
const STORAGE_HIDDEN = 'vrm.reviewsTable.hidden'

const APPROVAL_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  draft:                   { label: 'Draft',          bg: 'rgba(148,163,184,0.15)', color: '#64748b' },
  waiting_on_vendor:       { label: 'Waiting Vendor', bg: 'rgba(245,158,11,0.1)',   color: '#d97706' },
  in_internal_review:      { label: 'In Review',      bg: 'rgba(14,165,233,0.1)',   color: '#0284c7' },
  approved:                { label: 'Approved',       bg: 'rgba(5,150,105,0.1)',    color: '#059669' },
  approved_with_exception: { label: 'Approved (Exc)', bg: 'rgba(124,58,237,0.1)',   color: '#7c3aed' },
  blocked:                 { label: 'Blocked',        bg: 'rgba(225,29,72,0.1)',    color: '#e11d48' },
  suspended:               { label: 'Suspended',      bg: 'rgba(225,29,72,0.1)',    color: '#e11d48' },
  offboarded:              { label: 'Offboarded',     bg: 'rgba(148,163,184,0.15)', color: '#64748b' },
}

export function ReviewsTable({ vendors, todayStr }: Props) {
  // ─── Selection ─────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const visibleIds = useMemo(() => vendors.map((v) => v.vendor_id), [vendors])
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const someVisibleSelected = !allVisibleSelected && visibleIds.some((id) => selected.has(id))

  const toggleRow = (id: string) => setSelected((p) => {
    const next = new Set(p); if (next.has(id)) next.delete(id); else next.add(id); return next
  })
  const toggleAll = () => setSelected((p) => {
    const next = new Set(p)
    if (allVisibleSelected) for (const id of visibleIds) next.delete(id)
    else for (const id of visibleIds) next.add(id)
    return next
  })
  const clearSelection = () => setSelected(new Set())

  // ─── Column visibility ────────────────────────────────────────────────────
  const [hidden, setHidden] = useState<Set<ColId>>(new Set())
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false)
  const columnsMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_HIDDEN)
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) setHidden(new Set(arr as ColId[]))
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!columnsMenuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(e.target as Node)) {
        setColumnsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [columnsMenuOpen])

  const toggleColumn = (id: ColId) => setHidden((p) => {
    const next = new Set(p)
    if (next.has(id)) next.delete(id); else next.add(id)
    try { localStorage.setItem(STORAGE_HIDDEN, JSON.stringify(Array.from(next))) } catch {}
    return next
  })

  // ─── Column widths ────────────────────────────────────────────────────────
  const [widths, setWidths] = useState<Record<ColId, number>>(() => {
    const o = {} as Record<ColId, number>
    for (const c of COLUMNS) o[c.id] = c.defaultWidth
    return o
  })
  const dragRef = useRef<{ id: ColId; startX: number; startW: number } | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_WIDTHS)
      if (raw) {
        const obj = JSON.parse(raw) as Partial<Record<ColId, number>>
        setWidths((prev) => {
          const next = { ...prev }
          for (const c of COLUMNS) {
            const saved = obj[c.id]
            if (typeof saved === 'number') next[c.id] = Math.max(c.minWidth, saved)
          }
          return next
        })
      }
    } catch {}
  }, [])

  const resetTable = () => {
    setHidden(new Set())
    const defaults = {} as Record<ColId, number>
    for (const c of COLUMNS) defaults[c.id] = c.defaultWidth
    setWidths(defaults)
    try { localStorage.removeItem(STORAGE_HIDDEN); localStorage.removeItem(STORAGE_WIDTHS) } catch {}
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const { id, startX, startW } = dragRef.current
      const col = COLUMNS.find((c) => c.id === id)
      if (!col) return
      const w = Math.max(col.minWidth, startW + (e.clientX - startX))
      setWidths((p) => ({ ...p, [id]: w }))
    }
    const onUp = () => {
      if (!dragRef.current) return
      dragRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setWidths((p) => {
        try { localStorage.setItem(STORAGE_WIDTHS, JSON.stringify(p)) } catch {}
        return p
      })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [])

  const startResize = (id: ColId, e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { id, startX: e.clientX, startW: widths[id] }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  // ─── Visible columns ──────────────────────────────────────────────────────
  const visibleCols = COLUMNS.filter((c) => !hidden.has(c.id))
  const tableWidth = visibleCols.reduce((s, c) => s + widths[c.id], 0)

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-end">
        <div ref={columnsMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setColumnsMenuOpen((v) => !v)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5"
            style={{ background: 'rgba(108,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(108,93,211,0.15)' }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="4" height="10" rx="0.5" />
              <rect x="6.5" y="3" width="4" height="10" rx="0.5" />
              <rect x="11" y="3" width="3" height="10" rx="0.5" />
            </svg>
            Columns
          </button>
          {columnsMenuOpen && (
            <div className="absolute right-0 top-full mt-1 z-30 rounded-xl overflow-hidden" style={{ width: 220, background: 'white', border: '1px solid rgba(108,93,211,0.18)', boxShadow: '0 8px 24px rgba(30,21,80,0.12)' }}>
              <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(108,93,211,0.08)', background: 'rgba(108,93,211,0.02)' }}>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6c5dd3' }}>Show columns</span>
                <button type="button" onClick={resetTable} className="text-xs hover:opacity-70" style={{ color: '#5d5285' }} title="Reset to defaults">Reset all</button>
              </div>
              <div className="py-1 max-h-[280px] overflow-y-auto">
                {COLUMNS.filter((c) => c.canHide).map((c) => (
                  <label key={c.id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-[rgba(108,93,211,0.05)]" style={{ color: '#1e1550' }}>
                    <input type="checkbox" checked={!hidden.has(c.id)} onChange={() => toggleColumn(c.id)} className="h-4 w-4 rounded" style={{ accentColor: '#6c5dd3' }} />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white" style={{ boxShadow: '0 2px 12px rgba(109,93,211,0.08)', border: '1px solid rgba(109,93,211,0.1)' }}>
        <table className="text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', width: tableWidth }}>
          <colgroup>
            {visibleCols.map((c) => <col key={c.id} style={{ width: widths[c.id] }} />)}
          </colgroup>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(109,93,211,0.08)', background: 'rgba(109,93,211,0.03)' }}>
              {visibleCols.map((c) => (
                <th
                  key={c.id}
                  className="text-xs font-semibold uppercase tracking-widest relative"
                  style={{
                    color: '#6b5fa8',
                    textAlign: c.align ?? 'left',
                    padding: c.id === 'select' ? '12px 8px' : '12px 16px',
                    borderBottom: '1px solid rgba(109,93,211,0.08)',
                  }}
                >
                  {c.id === 'select' ? (
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={(el) => { if (el) el.indeterminate = someVisibleSelected }}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded"
                      style={{ accentColor: '#6c5dd3' }}
                      aria-label="Select all"
                    />
                  ) : c.label}

                  {c.canResize && (
                    <span onMouseDown={(e) => startResize(c.id, e)} className="absolute top-0 right-0 h-full" style={{ width: 6, cursor: 'col-resize', userSelect: 'none' }} aria-hidden>
                      <span className="block h-full" style={{ width: 1, marginLeft: 'auto', marginRight: 1, background: 'rgba(108,93,211,0.18)' }} />
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => {
              const isSel = selected.has(v.vendor_id)
              return (
                <tr
                  key={v.vendor_id}
                  className="group transition-colors hover:bg-[rgba(109,93,211,0.03)]"
                  style={{
                    borderBottom: '1px solid rgba(109,93,211,0.06)',
                    background: isSel ? 'rgba(108,93,211,0.05)' : undefined,
                  }}
                >
                  {visibleCols.map((c) => (
                    <td
                      key={c.id}
                      style={{
                        padding: c.id === 'select' ? '12px 8px' : '12px 16px',
                        textAlign: c.align ?? 'left',
                        verticalAlign: 'middle',
                        overflow: 'hidden',
                      }}
                    >
                      <Cell column={c.id} v={v} todayStr={todayStr} selected={isSel} onToggle={() => toggleRow(v.vendor_id)} />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selected.size > 0 && (
        <div
          className="sticky bottom-4 z-20 rounded-2xl flex items-center justify-between px-4 py-3"
          style={{ background: 'white', border: '1px solid rgba(108,93,211,0.2)', boxShadow: '0 8px 24px rgba(30,21,80,0.12)' }}
        >
          <span className="text-sm" style={{ color: '#1e1550' }}>
            <strong>{selected.size}</strong> vendor{selected.size === 1 ? '' : 's'} selected
          </span>
          <button
            type="button"
            onClick={clearSelection}
            className="text-xs font-medium px-3 py-1.5 rounded-full hover:opacity-70"
            style={{ color: '#5d5285' }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Cell renderer ───────────────────────────────────────────────────────────

function Cell({ column, v, todayStr, selected, onToggle }: {
  column: ColId
  v: ReviewVendorRow
  todayStr: string
  selected: boolean
  onToggle: () => void
}) {
  switch (column) {
    case 'select':
      return (
        <input type="checkbox" checked={selected} onChange={onToggle} className="h-4 w-4 rounded" style={{ accentColor: '#6c5dd3' }} aria-label={`Select ${v.vendor_name}`} />
      )
    case 'vendor': {
      const isOverdue = v.overdue_count > 0
      return (
        <Link href={`/reviews/${v.vendor_id}`} className="block min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold truncate" style={{ color: '#1e1550' }} title={v.vendor_name}>{v.vendor_name}</span>
            {v.vendor_criticality_tier && (
              <span className="text-xs px-1 rounded font-bold shrink-0" style={v.vendor_criticality_tier <= 2 ? { background: 'rgba(225,29,72,0.1)', color: '#e11d48' } : { background: 'rgba(109,93,211,0.05)', color: '#6c5dd3' }}>
                T{v.vendor_criticality_tier}
              </span>
            )}
            {isOverdue && <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: '#e11d48' }} />}
          </div>
          {v.vendor_code && <div className="text-xs font-mono mt-0.5 truncate" style={{ color: '#6b5fa8' }}>{v.vendor_code}</div>}
        </Link>
      )
    }
    case 'reviews':
      return (
        <div className="flex items-center gap-1.5 flex-wrap">
          {v.active_packs > 0 && <Chip label={`${v.active_packs} active`} bg="rgba(14,165,233,0.1)" color="#0284c7" />}
          {v.upcoming_packs > 0 && <Chip label={`${v.upcoming_packs} upcoming`} bg="rgba(14,165,233,0.06)" color="#0ea5e9" />}
          {v.completed_packs > 0 && <Chip label={`${v.completed_packs} done`} bg="rgba(5,150,105,0.08)" color="#059669" />}
          {v.overdue_count > 0 && <Chip label={`${v.overdue_count} overdue`} bg="rgba(225,29,72,0.1)" color="#e11d48" />}
          {v.active_packs === 0 && v.upcoming_packs === 0 && v.completed_packs === 0 && v.overdue_count === 0 && (
            <span className="text-xs" style={{ color: '#c4bae8' }}>—</span>
          )}
        </div>
      )
    case 'readiness': {
      const color = v.readiness_pct === 100 ? '#059669' : v.readiness_pct >= 50 ? '#6c5dd3' : v.readiness_pct > 0 ? '#d97706' : '#6b5fa8'
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tabular-nums" style={{ color, width: 36 }}>{v.readiness_pct}%</span>
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(109,93,211,0.06)' }}>
            <div className="h-full" style={{ width: `${Math.max(v.readiness_pct, 2)}%`, background: color, borderRadius: 4 }} />
          </div>
        </div>
      )
    }
    case 'risk': {
      const risk = RISK_BAND_STYLE[v.risk_band]
      return (
        <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-bold uppercase whitespace-nowrap" style={{ background: risk.bg, color: risk.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: risk.dot }} />
          {risk.label}
          <span className="font-mono opacity-70">{v.risk_score}</span>
        </span>
      )
    }
    case 'next_due': {
      const dueStr = v.next_due_at
        ? new Date(v.next_due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : '—'
      const duePast = v.next_due_at ? String(v.next_due_at).split('T')[0] < todayStr : false
      return (
        <span className="text-sm whitespace-nowrap" style={{ color: duePast ? '#e11d48' : '#4a4270', fontWeight: duePast ? 600 : 400 }}>
          {dueStr}
          {duePast && <span className="ml-1 text-xs font-bold uppercase">Overdue</span>}
        </span>
      )
    }
    case 'approval': {
      const s = APPROVAL_BADGE[v.vendor_approval_status] ?? { label: v.vendor_approval_status, bg: 'rgba(148,163,184,0.1)', color: '#64748b' }
      return (
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap" style={{ background: s.bg, color: s.color }}>
          {s.label}
        </span>
      )
    }
    case 'actions':
      return (
        <Link
          href={`/reviews/${v.vendor_id}`}
          className="text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap inline-block"
          style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.15)' }}
        >
          View →
        </Link>
      )
  }
}

function Chip({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap" style={{ background: bg, color }}>
      {label}
    </span>
  )
}
