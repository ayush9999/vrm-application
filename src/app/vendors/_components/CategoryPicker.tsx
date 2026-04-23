'use client'

import { useMemo, useState } from 'react'

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
  placeholder = 'Search categories…',
  emptyHint,
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const selectedSet = useMemo(() => new Set(selected), [selected])
  const selectedOptions = useMemo(
    () => selected.map((id) => options.find((o) => o.value === id)).filter(Boolean) as Option[],
    [selected, options],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return options
      .filter((o) => !selectedSet.has(o.value))
      .filter((o) => (q ? o.label.toLowerCase().includes(q) : true))
      .slice(0, 60)
  }, [options, selectedSet, query])

  if (options.length === 0 && emptyHint) {
    return <p className="text-xs italic" style={{ color: '#a99fd8' }}>{emptyHint}</p>
  }

  const add = (id: string) => {
    if (selectedSet.has(id)) return
    onChange([...selected, id])
    setQuery('')
  }
  const remove = (id: string) => {
    onChange(selected.filter((v) => v !== id))
  }

  return (
    <div
      className="relative rounded-xl"
      style={{ background: 'rgba(108,93,211,0.04)', border: '1px solid rgba(108,93,211,0.12)' }}
    >
      {/* Selected chips */}
      <div className="flex flex-wrap gap-1.5 p-2 min-h-[40px]">
        {selectedOptions.length === 0 && !open && (
          <span className="text-xs self-center" style={{ color: '#a99fd8' }}>
            None selected — click to add
          </span>
        )}
        {selectedOptions.map((o) => (
          <span
            key={o.value}
            className="inline-flex items-center gap-1.5 text-xs rounded-full pl-2.5 pr-1.5 py-1"
            style={{ background: 'white', border: '1px solid rgba(108,93,211,0.2)', color: '#1e1550' }}
          >
            {o.label}
            <button
              type="button"
              onClick={() => remove(o.value)}
              className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:opacity-70"
              style={{ background: 'rgba(108,93,211,0.1)', color: '#6c5dd3' }}
              aria-label={`Remove ${o.label}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={selectedOptions.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[140px] text-sm bg-transparent outline-none px-1"
          style={{ color: '#1e1550' }}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 right-0 z-20 mt-1 rounded-xl max-h-[260px] overflow-y-auto"
            style={{
              top: '100%',
              background: 'white',
              border: '1px solid rgba(108,93,211,0.18)',
              boxShadow: '0 8px 24px rgba(30,21,80,0.12)',
            }}
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs" style={{ color: '#a99fd8' }}>
                {query ? 'No matches' : 'All categories selected'}
              </div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => add(o.value)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[rgba(108,93,211,0.06)] transition-colors"
                  style={{ color: '#1e1550' }}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </>
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
