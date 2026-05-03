'use client'

import { useMemo, useState } from 'react'

interface VendorLite {
  id: string
  name: string
  vendor_code: string | null
  is_critical: boolean
}

interface Props {
  vendors: VendorLite[]
}

type Format = 'csv' | 'pdf'
type Scope = 'all' | 'filter' | 'specific'
type CriticalFilter = 'any' | 'critical' | 'non_critical'

const SERVICE_TYPES: { value: string; label: string }[] = [
  { value: 'saas', label: 'SaaS' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'other', label: 'Other' },
]

const APPROVAL_STATUSES: { value: string; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'waiting_on_vendor', label: 'Waiting on Vendor' },
  { value: 'in_internal_review', label: 'In Internal Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'approved_with_exception', label: 'Approved with Exception' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'offboarded', label: 'Offboarded' },
]

export function ExportDialog({ vendors }: Props) {
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<Format>('csv')
  const [scope, setScope] = useState<Scope>('all')

  // Filter mode controls
  const [criticalFilter, setCriticalFilter] = useState<CriticalFilter>('any')
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>([])
  const [selectedApprovalStatuses, setSelectedApprovalStatuses] = useState<string[]>([])

  // Specific mode controls
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const filteredVendors = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return vendors
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.vendor_code ?? '').toLowerCase().includes(q),
    )
  }, [vendors, search])

  const exportCount = useMemo(() => {
    if (scope === 'specific') return selectedIds.size
    if (scope === 'all') return vendors.length
    // Filter mode — approximate by re-filtering the lite list locally for the
    // critical flag (we can't filter by service_types/approval here without DB);
    // server still applies the full filter.
    if (criticalFilter === 'critical') return vendors.filter((v) => v.is_critical).length
    if (criticalFilter === 'non_critical') return vendors.filter((v) => !v.is_critical).length
    return vendors.length
  }, [scope, vendors, selectedIds, criticalFilter])

  const buildHref = (): string => {
    const sp = new URLSearchParams()
    sp.set('format', format)
    if (scope === 'specific') {
      sp.set('ids', Array.from(selectedIds).join(','))
    } else if (scope === 'filter') {
      if (criticalFilter === 'critical') sp.set('critical', 'true')
      else if (criticalFilter === 'non_critical') sp.set('critical', 'false')
      if (selectedServiceTypes.length > 0) sp.set('service_types', selectedServiceTypes.join(','))
      if (selectedApprovalStatuses.length > 0) sp.set('approval_statuses', selectedApprovalStatuses.join(','))
    }
    return `/vendors/export?${sp.toString()}`
  }

  const canExport =
    scope !== 'specific' || selectedIds.size > 0

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllVisible = () => {
    setSelectedIds(new Set(filteredVendors.map((v) => v.id)))
  }
  const clearSelection = () => setSelectedIds(new Set())

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all hover:opacity-90"
        style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.15)' }}
      >
        ↓ Export
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(30,21,80,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
            style={{ background: 'white', boxShadow: '0 12px 48px rgba(30,21,80,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(109,93,211,0.1)' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1e1550' }}>Export vendors</div>
                <div style={{ fontSize: 12, color: '#5d5285', marginTop: 2 }}>
                  Choose format and which vendors to include
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-base hover:opacity-70"
                style={{ color: '#6b5fa8' }}
              >
                ✕
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Format */}
              <Section title="Format">
                <div className="flex gap-2">
                  <FormatTile selected={format === 'csv'} onClick={() => setFormat('csv')} label="CSV" hint="Spreadsheet-friendly · all fields" />
                  <FormatTile selected={format === 'pdf'} onClick={() => setFormat('pdf')} label="PDF" hint="Printable summary · key fields" />
                </div>
              </Section>

              {/* Scope */}
              <Section title="What to export">
                <div className="space-y-1.5">
                  <ScopeRow
                    selected={scope === 'all'}
                    onClick={() => setScope('all')}
                    label="All vendors"
                    hint={`${vendors.length} total`}
                  />
                  <ScopeRow
                    selected={scope === 'filter'}
                    onClick={() => setScope('filter')}
                    label="By filter"
                    hint="Critical only, by service type, etc."
                  />
                  <ScopeRow
                    selected={scope === 'specific'}
                    onClick={() => setScope('specific')}
                    label="Pick specific vendors"
                    hint={selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Choose individually'}
                  />
                </div>
              </Section>

              {/* Filter controls */}
              {scope === 'filter' && (
                <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(108,93,211,0.04)', border: '1px solid rgba(108,93,211,0.1)' }}>
                  <FilterRow label="Criticality">
                    <div className="flex gap-1.5">
                      {(['any', 'critical', 'non_critical'] as CriticalFilter[]).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setCriticalFilter(v)}
                          className="text-xs px-3 py-1.5 rounded-full transition-colors"
                          style={
                            criticalFilter === v
                              ? { background: '#6c5dd3', color: 'white', fontWeight: 500 }
                              : { background: 'white', color: '#6c5dd3', border: '1px solid rgba(108,93,211,0.2)' }
                          }
                        >
                          {v === 'any' ? 'Any' : v === 'critical' ? 'Critical only' : 'Non-critical only'}
                        </button>
                      ))}
                    </div>
                  </FilterRow>

                  <FilterRow label="Service Types">
                    <ChipPicker
                      options={SERVICE_TYPES}
                      selected={selectedServiceTypes}
                      onToggle={(v) => setSelectedServiceTypes((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v])}
                    />
                  </FilterRow>

                  <FilterRow label="Approval Status">
                    <ChipPicker
                      options={APPROVAL_STATUSES}
                      selected={selectedApprovalStatuses}
                      onToggle={(v) => setSelectedApprovalStatuses((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v])}
                    />
                  </FilterRow>
                </div>
              )}

              {/* Specific picker */}
              {scope === 'specific' && (
                <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(108,93,211,0.04)', border: '1px solid rgba(108,93,211,0.1)' }}>
                  <div className="flex items-center gap-2 p-2.5" style={{ borderBottom: '1px solid rgba(108,93,211,0.08)' }}>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search vendors…"
                      className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none"
                      style={{ background: 'white', border: '1px solid rgba(108,93,211,0.15)', color: '#1e1550' }}
                    />
                    <button
                      type="button"
                      onClick={selectAllVisible}
                      className="text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap"
                      style={{ color: '#6c5dd3', background: 'white', border: '1px solid rgba(108,93,211,0.15)' }}
                    >
                      Select all{search ? ' (visible)' : ''}
                    </button>
                    {selectedIds.size > 0 && (
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap"
                        style={{ color: '#5d5285' }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="max-h-[260px] overflow-y-auto">
                    {filteredVendors.length === 0 ? (
                      <div className="px-3 py-6 text-center text-sm" style={{ color: '#6b5fa8' }}>
                        {search ? 'No matching vendors' : 'No vendors available'}
                      </div>
                    ) : (
                      filteredVendors.map((v) => (
                        <label
                          key={v.id}
                          className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-[rgba(108,93,211,0.05)]"
                          style={{ borderBottom: '1px solid rgba(108,93,211,0.04)' }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(v.id)}
                            onChange={() => toggleId(v.id)}
                            className="h-4 w-4 rounded"
                            style={{ accentColor: '#6c5dd3' }}
                          />
                          <span className="flex-1 truncate" style={{ color: '#1e1550' }}>{v.name}</span>
                          {v.is_critical && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded font-bold uppercase"
                              style={{ background: 'rgba(225,29,72,0.08)', color: '#e11d48' }}
                            >
                              Critical
                            </span>
                          )}
                          {v.vendor_code && (
                            <span className="text-xs font-mono" style={{ color: '#6b5fa8' }}>{v.vendor_code}</span>
                          )}
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between px-6 py-3.5"
              style={{ borderTop: '1px solid rgba(109,93,211,0.1)', background: 'rgba(108,93,211,0.02)' }}
            >
              <div className="text-xs" style={{ color: '#5d5285' }}>
                {scope === 'filter' ? (
                  <>Server-side filter will apply</>
                ) : (
                  <>{exportCount} vendor{exportCount === 1 ? '' : 's'} will be exported</>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-sm px-4 py-1.5 rounded-full"
                  style={{ color: '#5d5285' }}
                >
                  Cancel
                </button>
                <a
                  href={canExport ? buildHref() : undefined}
                  onClick={() => { if (canExport) setOpen(false) }}
                  aria-disabled={!canExport}
                  className="text-sm font-medium px-5 py-2 rounded-full text-white transition-all"
                  style={{
                    background: canExport ? 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' : 'rgba(108,93,211,0.3)',
                    boxShadow: canExport ? '0 4px 12px rgba(108,93,211,0.3)' : undefined,
                    pointerEvents: canExport ? 'auto' : 'none',
                  }}
                >
                  Export {format.toUpperCase()}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: '#6c5dd3' }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function FormatTile({ selected, onClick, label, hint }: { selected: boolean; onClick: () => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-xl p-3 text-left transition-all"
      style={
        selected
          ? { background: 'rgba(108,93,211,0.08)', border: '2px solid #6c5dd3' }
          : { background: 'white', border: '2px solid rgba(108,93,211,0.12)' }
      }
    >
      <div className="text-sm font-semibold" style={{ color: selected ? '#1e1550' : '#4a4270' }}>{label}</div>
      <div className="text-xs mt-0.5" style={{ color: '#5d5285' }}>{hint}</div>
    </button>
  )
}

function ScopeRow({ selected, onClick, label, hint }: { selected: boolean; onClick: () => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
      style={
        selected
          ? { background: 'rgba(108,93,211,0.08)', border: '1px solid rgba(108,93,211,0.2)' }
          : { background: 'white', border: '1px solid rgba(108,93,211,0.1)' }
      }
    >
      <span
        className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
        style={{ background: selected ? '#6c5dd3' : 'transparent', border: selected ? 'none' : '1.5px solid rgba(108,93,211,0.3)' }}
      >
        {selected && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'white' }} />}
      </span>
      <span className="flex-1">
        <span className="text-sm font-medium" style={{ color: '#1e1550' }}>{label}</span>
        <span className="block text-xs" style={{ color: '#5d5285' }}>{hint}</span>
      </span>
    </button>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold mb-1.5" style={{ color: '#4a4270' }}>{label}</div>
      {children}
    </div>
  )
}

function ChipPicker({
  options,
  selected,
  onToggle,
}: {
  options: { value: string; label: string }[]
  selected: string[]
  onToggle: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const isSel = selected.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className="text-xs px-2.5 py-1 rounded-full transition-colors"
            style={
              isSel
                ? { background: '#6c5dd3', color: 'white', fontWeight: 500 }
                : { background: 'white', color: '#6c5dd3', border: '1px solid rgba(108,93,211,0.2)' }
            }
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
