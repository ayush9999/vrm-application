'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { Issue } from '@/types/issue'

interface Props {
  issues: Issue[]
  today: string
}

type ColId =
  | 'select' | 'issue' | 'severity' | 'status' | 'vendor' | 'owner' | 'due' | 'actions'

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
  { id: 'select',   label: '',        defaultWidth: 52,  minWidth: 52,  canHide: false, canResize: false, align: 'center' },
  { id: 'issue',    label: 'Issue',   defaultWidth: 320, minWidth: 200, canHide: false, canResize: true },
  { id: 'severity', label: 'Severity', defaultWidth: 110, minWidth: 90, canHide: true, canResize: true, align: 'center' },
  { id: 'status',   label: 'Status',  defaultWidth: 130, minWidth: 100, canHide: true, canResize: true },
  { id: 'vendor',   label: 'Vendor',  defaultWidth: 180, minWidth: 120, canHide: true, canResize: true },
  { id: 'owner',    label: 'Owner',   defaultWidth: 140, minWidth: 100, canHide: true, canResize: true },
  { id: 'due',      label: 'Due',     defaultWidth: 110, minWidth: 90,  canHide: true, canResize: true, align: 'left' },
  { id: 'actions',  label: '',        defaultWidth: 90,  minWidth: 70,  canHide: false, canResize: false, align: 'right' },
]

const STORAGE_WIDTHS = 'vrm.issuesTable.widths'
const STORAGE_HIDDEN = 'vrm.issuesTable.hidden'

const SEVERITY_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  critical: { bg: 'rgba(225,29,72,0.1)',   color: '#e11d48', label: 'Critical' },
  high:     { bg: 'rgba(239,68,68,0.1)',   color: '#dc2626', label: 'High' },
  medium:   { bg: 'rgba(245,158,11,0.1)',  color: '#d97706', label: 'Medium' },
  low:      { bg: 'rgba(148,163,184,0.15)', color: '#64748b', label: 'Low' },
}

const STATUS_STYLE: Record<string, { dot: string; color: string; label: string }> = {
  open:                    { dot: '#d97706', color: '#d97706', label: 'Open' },
  in_progress:             { dot: '#0ea5e9', color: '#0ea5e9', label: 'In Progress' },
  blocked:                 { dot: '#e11d48', color: '#e11d48', label: 'Blocked' },
  deferred:                { dot: '#64748b', color: '#64748b', label: 'Deferred' },
  waiting_on_vendor:       { dot: '#d97706', color: '#d97706', label: 'Waiting Vendor' },
  waiting_internal_review: { dot: '#0ea5e9', color: '#0ea5e9', label: 'Waiting Review' },
  resolved:                { dot: '#059669', color: '#059669', label: 'Resolved' },
  verified:                { dot: '#059669', color: '#059669', label: 'Verified' },
  closed:                  { dot: '#64748b', color: '#64748b', label: 'Closed' },
}

export function IssuesTable({ issues, today }: Props) {
  // ─── Selection ────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const visibleIds = useMemo(() => issues.map((i) => i.id), [issues])
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
            {issues.map((issue) => {
              const isSel = selected.has(issue.id)
              const isOverdue = !!issue.due_date && issue.due_date < today &&
                (issue.status === 'open' || issue.status === 'in_progress' || issue.status === 'blocked')
              return (
                <tr
                  key={issue.id}
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
                      <Cell column={c.id} issue={issue} isOverdue={isOverdue} selected={isSel} onToggle={() => toggleRow(issue.id)} />
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
            <strong>{selected.size}</strong> issue{selected.size === 1 ? '' : 's'} selected
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

function Cell({ column, issue, isOverdue, selected, onToggle }: {
  column: ColId
  issue: Issue
  isOverdue: boolean
  selected: boolean
  onToggle: () => void
}) {
  switch (column) {
    case 'select':
      return (
        <input type="checkbox" checked={selected} onChange={onToggle} className="h-4 w-4 rounded" style={{ accentColor: '#6c5dd3' }} aria-label={`Select ${issue.title}`} />
      )
    case 'issue':
      return (
        <Link href={`/issues/${issue.id}`} className="block min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: '#1e1550' }} title={issue.title}>
            {issue.title}
          </div>
          {issue.description && (
            <div className="text-xs truncate mt-0.5" style={{ color: '#5d5285' }} title={issue.description}>
              {issue.description}
            </div>
          )}
        </Link>
      )
    case 'severity': {
      const s = SEVERITY_STYLE[issue.severity] ?? SEVERITY_STYLE.low
      return (
        <span className="text-xs px-2 py-0.5 rounded-full font-bold uppercase whitespace-nowrap" style={{ background: s.bg, color: s.color }}>
          {s.label}
        </span>
      )
    }
    case 'status': {
      const s = STATUS_STYLE[issue.status] ?? { dot: '#64748b', color: '#64748b', label: issue.status }
      return (
        <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap" style={{ color: s.color, fontWeight: 500 }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
          {s.label}
        </span>
      )
    }
    case 'vendor':
      return issue.vendor_name ? (
        <Link
          href={`/vendors/${issue.vendor_id}`}
          className="text-sm truncate block hover:text-[#6c5dd3] transition-colors"
          style={{ color: '#4a4270' }}
          title={issue.vendor_name}
        >
          {issue.vendor_name}
        </Link>
      ) : (
        <span style={{ color: '#c4bae8' }}>—</span>
      )
    case 'owner':
      return issue.owner_name ? (
        <span className="text-sm truncate block" style={{ color: '#4a4270' }} title={issue.owner_name}>
          {issue.owner_name}
        </span>
      ) : (
        <span style={{ color: '#c4bae8' }}>Unassigned</span>
      )
    case 'due':
      return issue.due_date ? (
        <span
          className="text-sm whitespace-nowrap"
          style={{ color: isOverdue ? '#e11d48' : '#4a4270', fontWeight: isOverdue ? 600 : 400 }}
        >
          {new Date(issue.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          {isOverdue && <span className="ml-1 text-xs font-bold uppercase">Overdue</span>}
        </span>
      ) : (
        <span style={{ color: '#c4bae8' }}>—</span>
      )
    case 'actions':
      return (
        <Link
          href={`/issues/${issue.id}`}
          className="text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap inline-block"
          style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.15)' }}
        >
          Open →
        </Link>
      )
  }
}
