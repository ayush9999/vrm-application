'use client'

import { useState, useTransition } from 'react'
import type { AssessmentFramework } from '@/types/assessment'

interface Props {
  assessmentId: string
  activeFrameworks: AssessmentFramework[]
  availableFrameworks: AssessmentFramework[]
  addAction: (assessmentId: string, frameworkId: string) => Promise<{ message?: string }>
  removeAction: (assessmentId: string, frameworkId: string) => Promise<{ message?: string }>
}

export function AssessmentFrameworksEditor({
  assessmentId,
  activeFrameworks,
  availableFrameworks,
  addAction,
  removeAction,
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Local draft state — what the user has toggled in the modal
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set(activeFrameworks.map(f => f.id)))

  const allFrameworks = [
    ...activeFrameworks,
    ...availableFrameworks.filter(f => !activeFrameworks.find(a => a.id === f.id)),
  ].sort((a, b) => a.name.localeCompare(b.name))

  function openModal() {
    setDraftIds(new Set(activeFrameworks.map(f => f.id)))
    setSearch('')
    setError(null)
    setOpen(true)
  }

  function toggle(id: string) {
    setDraftIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleApply() {
    setError(null)
    const currentIds = new Set(activeFrameworks.map(f => f.id))
    const toAdd    = [...draftIds].filter(id => !currentIds.has(id))
    const toRemove = [...currentIds].filter(id => !draftIds.has(id))

    startTransition(async () => {
      const results = await Promise.all([
        ...toAdd.map(id => addAction(assessmentId, id)),
        ...toRemove.map(id => removeAction(assessmentId, id)),
      ])
      const err = results.find(r => r.message)
      if (err?.message) {
        setError(err.message)
      } else {
        setOpen(false)
      }
    })
  }

  const hasChanges = (() => {
    const currentIds = new Set(activeFrameworks.map(f => f.id))
    if (draftIds.size !== currentIds.size) return true
    for (const id of draftIds) if (!currentIds.has(id)) return true
    return false
  })()

  return (
    <>
      {/* Trigger row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
          Frameworks
        </span>

        {activeFrameworks.length === 0 ? (
          <span className="text-xs" style={{ color: '#c4bae8' }}>None assigned</span>
        ) : (
          activeFrameworks.map(fw => (
            <span
              key={fw.id}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.18)' }}
            >
              {fw.name}
            </span>
          ))
        )}

        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 2px 6px rgba(108,93,211,0.25)' }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.5 1.5a1.414 1.414 0 012 2L4 11H1.5v-2.5L9.5 1.5z"/>
          </svg>
          Manage
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(30,21,80,0.35)', backdropFilter: 'blur(2px)' }}
            onClick={() => !isPending && setOpen(false)}
          />

          {/* Panel */}
          <div
            className="relative w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: '#fff', boxShadow: '0 16px 48px rgba(109,93,211,0.2)' }}
          >
            {/* Header */}
            <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(109,93,211,0.1)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: '#1e1550' }}>Manage Frameworks</h3>
                  <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>
                    Select the risk frameworks to evaluate in this assessment.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[rgba(109,93,211,0.06)]" style={{ color: '#a99fd8' }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-6 py-3" style={{ borderBottom: '1px solid rgba(109,93,211,0.08)' }}>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 shrink-0" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#a99fd8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6.5" cy="6.5" r="5" />
                  <path d="M10.5 10.5l3.5 3.5" />
                </svg>
                <input
                  type="text"
                  placeholder="Search frameworks…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg outline-none"
                  style={{ background: 'rgba(109,93,211,0.04)', border: '1px solid rgba(109,93,211,0.12)', color: '#1e1550' }}
                />
              </div>
            </div>

            {/* Framework list */}
            <div className="px-6 py-4 space-y-2 max-h-72 overflow-y-auto">
              {(() => {
                const filtered = search.trim()
                  ? allFrameworks.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
                  : allFrameworks
                if (filtered.length === 0) return (
                  <p className="text-sm text-center py-6" style={{ color: '#a99fd8' }}>
                    {search ? 'No frameworks match your search.' : 'No frameworks available.'}
                  </p>
                )
                return filtered.map(fw => {
                  const checked = draftIds.has(fw.id)
                  return (
                    <label
                      key={fw.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors"
                      style={{
                        border: `1px solid ${checked ? 'rgba(109,93,211,0.3)' : 'rgba(109,93,211,0.1)'}`,
                        background: checked ? 'rgba(109,93,211,0.04)' : '#fff',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(fw.id)}
                        className="h-4 w-4 rounded shrink-0"
                        style={{ accentColor: '#6c5dd3' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: '#1e1550' }}>{fw.name}</p>
                        {fw.description && (
                          <p className="text-xs mt-0.5 line-clamp-1" style={{ color: '#a99fd8' }}>{fw.description}</p>
                        )}
                      </div>
                    </label>
                  )
                })
              })()}
            </div>

            {/* Footer */}
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderTop: '1px solid rgba(109,93,211,0.1)', background: 'rgba(109,93,211,0.02)' }}
            >
              <div>
                {error && <p className="text-xs text-rose-600">{error}</p>}
                {!error && (
                  <p className="text-xs" style={{ color: '#a99fd8' }}>
                    {draftIds.size} framework{draftIds.size !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-violet-50 disabled:opacity-50"
                  style={{ color: '#a99fd8' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={isPending || !hasChanges}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
                >
                  {isPending ? 'Applying…' : 'Apply Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
