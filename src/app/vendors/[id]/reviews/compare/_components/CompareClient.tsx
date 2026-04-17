'use client'

import { useState, useTransition } from 'react'
import { loadComparisonAction, type CompareResult, type CompareItem } from '../actions'

const DECISION_LABEL: Record<string, string> = {
  not_started: 'Not Started',
  pass: 'Pass',
  fail: 'Fail',
  na: 'N/A',
  needs_follow_up: 'Follow-up',
  exception_approved: 'Exception',
}

const CHANGE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  improved:  { bg: 'rgba(5,150,105,0.08)',    color: '#059669', label: 'Improved' },
  regressed: { bg: 'rgba(225,29,72,0.08)',    color: '#e11d48', label: 'Regressed' },
  changed:   { bg: 'rgba(245,158,11,0.08)',   color: '#d97706', label: 'Changed' },
  unchanged: { bg: 'rgba(148,163,184,0.06)',  color: '#94a3b8', label: 'Unchanged' },
}

interface VrpOption {
  id: string
  status: string
  completed_at: string | null
  pack_name: string
  pack_code: string | null
  pack_id: string
}

interface Props {
  vendorId: string
  completedVrps: VrpOption[]
}

export function CompareClient({ vendorId, completedVrps }: Props) {
  const [olderId, setOlderId] = useState('')
  const [newerId, setNewerId] = useState('')
  const [result, setResult] = useState<CompareResult | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleCompare = () => {
    if (!olderId || !newerId) { setError('Select two reviews'); return }
    if (olderId === newerId) { setError('Pick two different reviews'); return }
    setError(null)
    startTransition(async () => {
      const r = await loadComparisonAction(olderId, newerId)
      if (r.result) setResult(r.result)
      else setError(r.message ?? 'Failed')
    })
  }

  const handleExportCsv = () => {
    if (!result) return
    const lines = ['Requirement,Older Decision,Newer Decision,Change']
    for (const item of result.items) {
      lines.push(`"${item.requirement_name}","${item.olderDecision}","${item.newerDecision}","${item.changeType}"`)
    }
    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `review-comparison-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  return (
    <div className="space-y-5">
      {/* Selectors */}
      <div
        className="rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end"
        style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}
      >
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6c5dd3' }}>Older Review</label>
          <select
            value={olderId}
            onChange={(e) => setOlderId(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
          >
            <option value="">Select…</option>
            {completedVrps.map((v) => (
              <option key={v.id} value={v.id}>
                {v.pack_name} — {formatDate(v.completed_at)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6c5dd3' }}>Newer Review</label>
          <select
            value={newerId}
            onChange={(e) => setNewerId(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
          >
            <option value="">Select…</option>
            {completedVrps.map((v) => (
              <option key={v.id} value={v.id}>
                {v.pack_name} — {formatDate(v.completed_at)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCompare}
            disabled={isPending || !olderId || !newerId}
            className="text-sm font-semibold px-5 py-2 rounded-full text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
          >
            {isPending ? 'Loading…' : 'Compare'}
          </button>
          {result && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="text-xs font-medium px-3 py-2 rounded-lg"
              style={{ background: 'rgba(108,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(108,93,211,0.15)' }}
            >
              ↓ CSV
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs" style={{ color: '#e11d48' }}>{error}</p>}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Delta summary */}
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Older Readiness</div>
              <div className="text-2xl font-bold tabular-nums" style={{ color: '#4a4270' }}>{result.olderPct}%</div>
            </div>
            <div className="text-xl font-bold" style={{ color: '#a99fd8' }}>→</div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Newer Readiness</div>
              <div className="text-2xl font-bold tabular-nums" style={{ color: '#1e1550' }}>{result.newerPct}%</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Delta</div>
              <div
                className="text-2xl font-bold tabular-nums"
                style={{ color: result.deltaPct > 0 ? '#059669' : result.deltaPct < 0 ? '#e11d48' : '#94a3b8' }}
              >
                {result.deltaPct > 0 ? '↑' : result.deltaPct < 0 ? '↓' : '—'} {Math.abs(result.deltaPct)} pts
              </div>
            </div>

            {/* Change summary chips */}
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {(['improved', 'regressed', 'changed', 'unchanged'] as const).map((type) => {
                const count = result.items.filter((i) => i.changeType === type).length
                const style = CHANGE_STYLE[type]
                return (
                  <span
                    key={type}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: style.bg, color: style.color }}
                  >
                    {count} {style.label}
                  </span>
                )
              })}
            </div>
          </div>

          {/* Diff table */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)' }}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(109,93,211,0.08)', background: 'rgba(109,93,211,0.03)' }}>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Requirement</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Older</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Newer</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((item) => (
                    <DiffRow key={item.requirement_id} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DiffRow({ item }: { item: CompareItem }) {
  const cs = CHANGE_STYLE[item.changeType]
  return (
    <tr style={{ borderBottom: '1px solid rgba(109,93,211,0.04)', background: cs.bg }}>
      <td className="px-4 py-2.5 text-sm font-medium" style={{ color: '#1e1550' }}>{item.requirement_name}</td>
      <td className="px-4 py-2.5 text-xs" style={{ color: '#4a4270' }}>
        {DECISION_LABEL[item.olderDecision] ?? item.olderDecision}
      </td>
      <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: '#1e1550' }}>
        {DECISION_LABEL[item.newerDecision] ?? item.newerDecision}
      </td>
      <td className="px-4 py-2.5">
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: cs.bg, color: cs.color }}>
          {cs.label}
        </span>
      </td>
    </tr>
  )
}
