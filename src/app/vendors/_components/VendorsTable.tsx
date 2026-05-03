'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams, usePathname } from 'next/navigation'
import type { Vendor, VendorApprovalStatus } from '@/types/vendor'
import type { RiskBand, RiskScoreOutput } from '@/lib/risk-score'
import { RISK_BAND_STYLE } from '@/lib/risk-score'
import { QuickApprovalMenu } from './QuickApprovalMenu'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VendorRowMetrics {
  readinessPct: number
  applicable: number
  completed: number
  missingEvidenceCount: number
  openRemediationCount: number
  risk: RiskScoreOutput
}

export interface VendorsTableProps {
  vendors: Vendor[]
  metrics: Record<string, VendorRowMetrics>
}

const APPROVAL_BADGE: Record<VendorApprovalStatus, { label: string; bg: string; color: string }> = {
  draft:                   { label: 'Draft',          bg: 'rgba(148,163,184,0.15)', color: '#64748b' },
  waiting_on_vendor:       { label: 'Waiting Vendor', bg: 'rgba(245,158,11,0.1)',   color: '#d97706' },
  in_internal_review:      { label: 'In Review',      bg: 'rgba(14,165,233,0.1)',   color: '#0284c7' },
  approved:                { label: 'Approved',       bg: 'rgba(5,150,105,0.1)',    color: '#059669' },
  approved_with_exception: { label: 'Approved (Exc)', bg: 'rgba(124,58,237,0.1)',   color: '#7c3aed' },
  blocked:                 { label: 'Blocked',        bg: 'rgba(225,29,72,0.1)',    color: '#e11d48' },
  suspended:               { label: 'Suspended',      bg: 'rgba(225,29,72,0.1)',    color: '#e11d48' },
  offboarded:              { label: 'Offboarded',     bg: 'rgba(148,163,184,0.15)', color: '#64748b' },
}

// ─── Column definitions ──────────────────────────────────────────────────────

type ColId =
  | 'select' | 'name' | 'type' | 'owner' | 'criticality' | 'approval'
  | 'readiness' | 'risk' | 'missing' | 'remediations' | 'actions'

interface ColumnDef {
  id: ColId
  label: string
  sortField?: 'name' | 'criticality_tier' | 'approval_status'
  defaultWidth: number
  minWidth: number
  align?: 'left' | 'center' | 'right'
  /** select + actions can't be hidden */
  canHide: boolean
  /** select + actions can't be resized */
  canResize: boolean
}

const COLUMNS: ColumnDef[] = [
  { id: 'select',       label: '',           defaultWidth: 52,  minWidth: 52,  canHide: false, canResize: false, align: 'center' },
  { id: 'name',         label: 'Name',       sortField: 'name',              defaultWidth: 230, minWidth: 160, canHide: false, canResize: true },
  { id: 'type',         label: 'Type',       defaultWidth: 130, minWidth: 90,  canHide: true,  canResize: true },
  { id: 'owner',        label: 'Owner',      defaultWidth: 140, minWidth: 110, canHide: true,  canResize: true },
  { id: 'criticality',  label: 'Criticality', sortField: 'criticality_tier', defaultWidth: 110, minWidth: 80, canHide: true, canResize: true, align: 'center' },
  { id: 'approval',     label: 'Approval',   sortField: 'approval_status', defaultWidth: 130, minWidth: 110, canHide: true, canResize: true },
  { id: 'readiness',    label: 'Readiness',  defaultWidth: 160, minWidth: 120, canHide: true, canResize: true },
  { id: 'risk',         label: 'Risk',       defaultWidth: 130, minWidth: 100, canHide: true, canResize: true, align: 'left' },
  { id: 'missing',      label: 'Missing',    defaultWidth: 80,  minWidth: 60,  canHide: true, canResize: true, align: 'center' },
  { id: 'remediations', label: 'Open Rem.',  defaultWidth: 90,  minWidth: 70,  canHide: true, canResize: true, align: 'center' },
  { id: 'actions',      label: '',           defaultWidth: 100, minWidth: 80,  canHide: false, canResize: false, align: 'right' },
]

const STORAGE_WIDTHS = 'vrm.vendorsTable.widths'
const STORAGE_HIDDEN = 'vrm.vendorsTable.hidden'

// ─── Component ────────────────────────────────────────────────────────────────

export function VendorsTable({ vendors, metrics }: VendorsTableProps) {
  const params = useSearchParams()
  const pathname = usePathname()

  // ─── Selection (session only) ──────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const visibleIds = useMemo(() => vendors.map((v) => v.id), [vendors])
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const someVisibleSelected = !allVisibleSelected && visibleIds.some((id) => selected.has(id))

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id)
      } else {
        for (const id of visibleIds) next.add(id)
      }
      return next
    })
  }
  const clearSelection = () => setSelected(new Set())

  // ─── Column visibility (persisted) ─────────────────────────────────────────
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

  const toggleColumn = (id: ColId) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try { localStorage.setItem(STORAGE_HIDDEN, JSON.stringify(Array.from(next))) } catch {}
      return next
    })
  }

  // ─── Column widths (persisted) ─────────────────────────────────────────────
  const [widths, setWidths] = useState<Record<ColId, number>>(() => {
    const out = {} as Record<ColId, number>
    for (const c of COLUMNS) out[c.id] = c.defaultWidth
    return out
  })
  const dragRef = useRef<{ id: ColId; startX: number; startW: number } | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_WIDTHS)
      if (raw) {
        const obj = JSON.parse(raw) as Partial<Record<ColId, number>>
        setWidths((prev) => {
          const next = { ...prev }
          // Apply saved widths but clamp to current min so old narrow values can't override new mins
          for (const c of COLUMNS) {
            const saved = obj[c.id]
            if (typeof saved === 'number') {
              next[c.id] = Math.max(c.minWidth, saved)
            }
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
    try {
      localStorage.removeItem(STORAGE_HIDDEN)
      localStorage.removeItem(STORAGE_WIDTHS)
    } catch {}
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const { id, startX, startW } = dragRef.current
      const col = COLUMNS.find((c) => c.id === id)
      if (!col) return
      const w = Math.max(col.minWidth, startW + (e.clientX - startX))
      setWidths((prev) => ({ ...prev, [id]: w }))
    }
    const onUp = () => {
      if (!dragRef.current) return
      dragRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      try {
        // Persist with a fresh read so we don't clobber other state writes mid-drag
        setWidths((prev) => {
          try { localStorage.setItem(STORAGE_WIDTHS, JSON.stringify(prev)) } catch {}
          return prev
        })
      } catch {}
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  const startResize = (id: ColId, e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { id, startX: e.clientX, startW: widths[id] }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  // ─── Sorting (URL-driven, server pages) ────────────────────────────────────
  const sort = (params.get('sort') ?? 'name') as 'name' | 'criticality_tier' | 'approval_status'
  const sortDir = (params.get('dir') === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc'

  const buildSortHref = (field: NonNullable<ColumnDef['sortField']>) => {
    const sp = new URLSearchParams(params.toString())
    const isActive = sort === field
    const nextDir = isActive && sortDir === 'asc' ? 'desc' : 'asc'
    sp.set('sort', field)
    sp.set('dir', nextDir)
    sp.set('page', '1')
    return `${pathname}?${sp.toString()}`
  }

  // ─── Visible columns ───────────────────────────────────────────────────────
  const visibleCols = COLUMNS.filter((c) => !hidden.has(c.id))
  const tableWidth = visibleCols.reduce((sum, c) => sum + widths[c.id], 0)

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Toolbar: column visibility menu */}
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
            {hidden.size > 0 && (
              <span className="text-xs ml-0.5" style={{ color: '#5d5285' }}>({COLUMNS.filter((c) => c.canHide).length - hidden.size}/{COLUMNS.filter((c) => c.canHide).length})</span>
            )}
          </button>
          {columnsMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1 z-30 rounded-xl overflow-hidden"
              style={{
                width: 220,
                background: 'white',
                border: '1px solid rgba(108,93,211,0.18)',
                boxShadow: '0 8px 24px rgba(30,21,80,0.12)',
              }}
            >
              <div
                className="px-3 py-2 flex items-center justify-between"
                style={{ borderBottom: '1px solid rgba(108,93,211,0.08)', background: 'rgba(108,93,211,0.02)' }}
              >
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6c5dd3' }}>
                  Show columns
                </span>
                <button
                  type="button"
                  onClick={resetTable}
                  className="text-xs hover:opacity-70"
                  style={{ color: '#5d5285' }}
                  title="Reset visibility and widths to defaults"
                >
                  Reset all
                </button>
              </div>
              <div className="py-1 max-h-[280px] overflow-y-auto">
                {COLUMNS.filter((c) => c.canHide).map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-[rgba(108,93,211,0.05)]"
                    style={{ color: '#1e1550' }}
                  >
                    <input
                      type="checkbox"
                      checked={!hidden.has(c.id)}
                      onChange={() => toggleColumn(c.id)}
                      className="h-4 w-4 rounded"
                      style={{ accentColor: '#6c5dd3' }}
                    />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div
        className="overflow-x-auto rounded-2xl bg-white"
        style={{ boxShadow: '0 2px 12px rgba(109,93,211,0.08)', border: '1px solid rgba(109,93,211,0.1)' }}
      >
        <table className="text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', width: tableWidth }}>
          <colgroup>
            {visibleCols.map((c) => (
              <col key={c.id} style={{ width: widths[c.id] }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(109,93,211,0.08)', background: 'rgba(109,93,211,0.03)' }}>
              {visibleCols.map((c) => (
                <th
                  key={c.id}
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-widest relative"
                  style={{
                    color: '#6b5fa8',
                    textAlign: c.align ?? 'left',
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
                      aria-label="Select all visible vendors"
                    />
                  ) : c.sortField ? (
                    <Link
                      href={buildSortHref(c.sortField)}
                      className="inline-flex items-center gap-1 hover:text-[#6c5dd3] transition-colors"
                      style={{ color: 'inherit' }}
                    >
                      {c.label}
                      {sort === c.sortField && (
                        <span className="text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </Link>
                  ) : (
                    c.label
                  )}

                  {/* Resize handle */}
                  {c.canResize && (
                    <span
                      onMouseDown={(e) => startResize(c.id, e)}
                      className="absolute top-0 right-0 h-full"
                      style={{
                        width: 6,
                        cursor: 'col-resize',
                        userSelect: 'none',
                      }}
                      aria-hidden
                    >
                      <span
                        className="block h-full"
                        style={{
                          width: 1,
                          marginLeft: 'auto',
                          marginRight: 1,
                          background: 'rgba(108,93,211,0.18)',
                        }}
                      />
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => {
              const m = metrics[v.id] ?? {
                readinessPct: 0, applicable: 0, completed: 0, missingEvidenceCount: 0, openRemediationCount: 0,
                risk: { score: 0, band: 'critical' as RiskBand, rawScore: 0, remediationPenalty: 0, isApprovalOverride: false, formula: 'No data' },
              }
              const isSel = selected.has(v.id)
              const approvalBadge = APPROVAL_BADGE[v.approval_status]
              return (
                <tr
                  key={v.id}
                  className="group transition-colors hover:bg-[rgba(109,93,211,0.03)]"
                  style={{
                    borderBottom: '1px solid rgba(109,93,211,0.06)',
                    background: isSel ? 'rgba(108,93,211,0.05)' : undefined,
                  }}
                >
                  {visibleCols.map((c) => {
                    const isPaddingCompact = c.id === 'select'
                    return (
                      <td
                        key={c.id}
                        style={{
                          padding: isPaddingCompact ? '12px 8px' : '12px 16px',
                          textAlign: c.align ?? 'left',
                          verticalAlign: 'middle',
                          overflow: 'hidden',
                        }}
                      >
                        <Cell column={c.id} vendor={v} metrics={m} approvalBadge={approvalBadge} selected={isSel} onToggle={() => toggleRow(v.id)} />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Selection action bar */}
      {selected.size > 0 && (
        <div
          className="sticky bottom-4 z-20 rounded-2xl flex items-center justify-between px-4 py-3"
          style={{
            background: 'white',
            border: '1px solid rgba(108,93,211,0.2)',
            boxShadow: '0 8px 24px rgba(30,21,80,0.12)',
          }}
        >
          <span className="text-sm" style={{ color: '#1e1550' }}>
            <strong>{selected.size}</strong> vendor{selected.size === 1 ? '' : 's'} selected
          </span>
          <div className="flex items-center gap-2">
            <a
              href={`/vendors/export?format=csv&ids=${Array.from(selected).join(',')}`}
              className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
              style={{ background: 'rgba(108,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(108,93,211,0.15)' }}
            >
              ↓ Export CSV
            </a>
            <a
              href={`/vendors/export?format=pdf&ids=${Array.from(selected).join(',')}`}
              className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
              style={{ background: 'rgba(108,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(108,93,211,0.15)' }}
            >
              ↓ Export PDF
            </a>
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs font-medium px-3 py-1.5 rounded-full hover:opacity-70"
              style={{ color: '#5d5285' }}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Cell renderer ────────────────────────────────────────────────────────────

function Cell({
  column,
  vendor,
  metrics,
  approvalBadge,
  selected,
  onToggle,
}: {
  column: ColId
  vendor: Vendor
  metrics: VendorRowMetrics
  approvalBadge: { label: string; bg: string; color: string }
  selected: boolean
  onToggle: () => void
}) {
  switch (column) {
    case 'select':
      return (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="h-4 w-4 rounded"
          style={{ accentColor: '#6c5dd3' }}
          aria-label={`Select ${vendor.name}`}
        />
      )
    case 'name':
      return (
        <div title={vendor.name} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <Link
            href={`/vendors/${vendor.id}`}
            className="transition-colors hover:text-[#6c5dd3] inline-flex items-center gap-2 font-medium"
            style={{ color: '#1e1550' }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vendor.name}</span>
            {vendor.is_critical && <span className="text-amber-500 text-xs shrink-0" title="Critical">★</span>}
          </Link>
          {vendor.vendor_code && (
            <div className="text-xs font-mono mt-0.5" style={{ color: '#6b5fa8' }}>{vendor.vendor_code}</div>
          )}
        </div>
      )
    case 'type': {
      const types = vendor.service_types?.length ? vendor.service_types.join(', ') : '—'
      const cats = vendor.vendor_categories?.length ? vendor.vendor_categories.map((c) => c.name).join(', ') : ''
      return (
        <div title={cats ? `${types}\n${cats}` : types}>
          <div className="text-xs truncate" style={{ color: '#1e1550' }}>{types}</div>
          {cats && <div className="text-xs mt-0.5 truncate" style={{ color: '#6b5fa8' }}>{cats}</div>}
        </div>
      )
    }
    case 'owner':
      return (
        <div title={vendor.internal_owner?.email ?? ''} className="truncate" style={{ color: '#6b5fa8' }}>
          {vendor.internal_owner?.name ?? vendor.internal_owner?.email ?? <span style={{ color: '#c4bae8' }}>—</span>}
        </div>
      )
    case 'criticality':
      return vendor.criticality_tier ? (
        <span
          className="text-xs px-2 py-0.5 rounded-full font-bold"
          style={
            vendor.criticality_tier === 1
              ? { background: 'rgba(225,29,72,0.1)', color: '#e11d48' }
              : vendor.criticality_tier === 2
              ? { background: 'rgba(245,158,11,0.1)', color: '#d97706' }
              : { background: 'rgba(109,93,211,0.05)', color: '#6c5dd3' }
          }
        >
          T{vendor.criticality_tier}
        </span>
      ) : (
        <span style={{ color: '#c4bae8' }}>—</span>
      )
    case 'approval':
      return (
        <span
          className="text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap"
          style={{ background: approvalBadge.bg, color: approvalBadge.color }}
        >
          {approvalBadge.label}
        </span>
      )
    case 'readiness':
      return <ReadinessCell pct={metrics.readinessPct} applicable={metrics.applicable} completed={metrics.completed} />
    case 'risk':
      return <RiskBadgeCell band={metrics.risk.band} score={metrics.risk.score} formula={metrics.risk.formula} />
    case 'missing':
      return metrics.missingEvidenceCount > 0 ? (
        <span className="text-xs font-bold" style={{ color: '#d97706' }}>{metrics.missingEvidenceCount}</span>
      ) : (
        <span className="text-xs" style={{ color: '#c4bae8' }}>—</span>
      )
    case 'remediations':
      return metrics.openRemediationCount > 0 ? (
        <span className="text-xs font-bold" style={{ color: '#e11d48' }}>{metrics.openRemediationCount}</span>
      ) : (
        <span className="text-xs" style={{ color: '#c4bae8' }}>—</span>
      )
    case 'actions':
      return (
        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
          <QuickApprovalMenu vendorId={vendor.id} current={vendor.approval_status} />
          <Link
            href={`/vendors/${vendor.id}/edit`}
            className="text-xs font-medium transition-all opacity-0 group-hover:opacity-100 hover:opacity-80"
            style={{ color: '#6c5dd3' }}
          >
            Edit
          </Link>
        </div>
      )
  }
}

// ─── Cells ────────────────────────────────────────────────────────────────────

function ReadinessCell({ pct, applicable, completed }: { pct: number; applicable: number; completed: number }) {
  if (applicable === 0) {
    return <span className="text-xs" style={{ color: '#c4bae8' }}>No packs</span>
  }
  const color = pct === 100 ? '#059669' : pct >= 50 ? '#6c5dd3' : pct > 0 ? '#d97706' : '#6b5fa8'
  return (
    <div title={`${completed} / ${applicable} complete`} className="flex items-center gap-2 min-w-0">
      <span style={{ fontSize: 13, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
      <div className="flex-1 min-w-[40px]" style={{ height: 4, background: '#f1efe8', borderRadius: 2 }}>
        <div style={{ width: `${Math.max(pct, 2)}%`, height: '100%', borderRadius: 2, background: color }} />
      </div>
    </div>
  )
}

function RiskBadgeCell({ band, score, formula }: { band: RiskBand; score: number; formula: string }) {
  const style = RISK_BAND_STYLE[band]
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-bold uppercase whitespace-nowrap"
      style={{ background: style.bg, color: style.color }}
      title={formula}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.dot }} />
      {style.label}
      <span className="font-mono opacity-70">{score}</span>
    </span>
  )
}
