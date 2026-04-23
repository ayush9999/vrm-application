'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

interface Option {
  value: string
  label: string
}

interface Props {
  options: Option[]
  selected: string[]
  onChange: (next: string[]) => void
  /** If provided, hidden inputs with this name emit one entry per selected value (for FormData). */
  name?: string
  placeholder?: string
  emptyHint?: string
}

export function CategoryPicker({
  options,
  selected,
  onChange,
  name,
  placeholder = 'Select categories…',
  emptyHint,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const selectedSet = useMemo(() => new Set(selected), [selected])
  const selectedOptions = useMemo(
    () => selected.map((id) => options.find((o) => o.value === id)).filter(Boolean) as Option[],
    [selected, options],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
  }, [options, query])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (options.length === 0 && emptyHint) {
    return <p className="text-xs italic" style={{ color: '#a99fd8' }}>{emptyHint}</p>
  }

  const toggle = (id: string) => {
    if (selectedSet.has(id)) onChange(selected.filter((v) => v !== id))
    else onChange([...selected, id])
  }

  const clearAll = () => onChange([])

  const triggerLabel =
    selectedOptions.length === 0
      ? placeholder
      : selectedOptions.length === 1
      ? selectedOptions[0].label
      : `${selectedOptions.length} selected`

  return (
    <div ref={rootRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-sm transition-colors"
        style={{
          background: 'white',
          border: '1px solid rgba(109,93,211,0.2)',
          color: selectedOptions.length === 0 ? '#a99fd8' : '#1e1550',
        }}
      >
        <span className="truncate text-left">{triggerLabel}</span>
        <svg
          width="12" height="12" viewBox="0 0 12 12"
          style={{ color: '#6c5dd3', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}
          fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </button>

      {/* Chips (rendered below the trigger, always visible when any selection exists) */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedOptions.map((o) => (
            <span
              key={o.value}
              className="inline-flex items-center gap-1.5 text-xs rounded-full pl-2.5 pr-1.5 py-1"
              style={{ background: 'rgba(108,93,211,0.06)', border: '1px solid rgba(108,93,211,0.18)', color: '#1e1550' }}
            >
              {o.label}
              <button
                type="button"
                onClick={() => toggle(o.value)}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:opacity-70"
                style={{ background: 'rgba(108,93,211,0.12)', color: '#6c5dd3' }}
                aria-label={`Remove ${o.label}`}
              >
                ×
              </button>
            </span>
          ))}
          {selectedOptions.length > 1 && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center text-[11px] px-2 py-1 rounded-full hover:opacity-70"
              style={{ color: '#8b7fd4' }}
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 right-0 z-30 mt-1 rounded-xl overflow-hidden"
          style={{
            top: '100%',
            background: 'white',
            border: '1px solid rgba(108,93,211,0.18)',
            boxShadow: '0 8px 24px rgba(30,21,80,0.12)',
          }}
        >
          {/* Search */}
          <div className="p-2" style={{ borderBottom: '1px solid rgba(108,93,211,0.08)' }}>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full text-sm px-2.5 py-1.5 rounded-lg outline-none"
              style={{ background: 'rgba(108,93,211,0.04)', border: '1px solid rgba(108,93,211,0.1)', color: '#1e1550' }}
            />
          </div>

          {/* Options list */}
          <div className="max-h-[260px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs" style={{ color: '#a99fd8' }}>No matches</div>
            ) : (
              filtered.map((o) => {
                const isSel = selectedSet.has(o.value)
                return (
                  <label
                    key={o.value}
                    className="flex items-center gap-2.5 px-3 py-1.5 text-sm cursor-pointer hover:bg-[rgba(108,93,211,0.05)] transition-colors"
                    style={{ color: '#1e1550' }}
                  >
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggle(o.value)}
                      className="h-4 w-4 rounded"
                      style={{ accentColor: '#6c5dd3' }}
                    />
                    <span className="truncate">{o.label}</span>
                  </label>
                )
              })
            )}
          </div>

          {/* Footer */}
          {selectedOptions.length > 0 && (
            <div
              className="flex items-center justify-between px-3 py-2 text-xs"
              style={{ borderTop: '1px solid rgba(108,93,211,0.08)', background: 'rgba(108,93,211,0.02)' }}
            >
              <span style={{ color: '#8b7fd4' }}>{selectedOptions.length} selected</span>
              <button
                type="button"
                onClick={clearAll}
                className="hover:opacity-70"
                style={{ color: '#6c5dd3' }}
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      {/* Hidden inputs for FormData submission */}
      {name && selected.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
    </div>
  )
}

/**
 * Uncontrolled wrapper: manages its own state and emits hidden inputs for form submission.
 * Use this inside a <form> when you don't want to wire state up manually.
 */
export function CategoryPickerField({
  name,
  options,
  defaultSelected,
  placeholder,
  emptyHint,
}: {
  name: string
  options: Option[]
  defaultSelected: string[]
  placeholder?: string
  emptyHint?: string
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected)
  return (
    <CategoryPicker
      options={options}
      selected={selected}
      onChange={setSelected}
      name={name}
      placeholder={placeholder}
      emptyHint={emptyHint}
    />
  )
}
