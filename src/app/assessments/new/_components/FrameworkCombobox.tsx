'use client'

import React, { useState, useRef, useEffect, useId } from 'react'
import type { AssessmentFramework } from '@/types/assessment'

interface Props {
  frameworks: AssessmentFramework[]
  name?: string
  defaultValue?: string
}

export function FrameworkCombobox({ frameworks, name = 'framework_id', defaultValue }: Props) {
  const initialFramework = defaultValue ? (frameworks.find((f) => f.id === defaultValue) ?? null) : null
  const [query, setQuery] = useState(initialFramework?.name ?? '')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<AssessmentFramework | null>(initialFramework)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const filtered = query.trim()
    ? frameworks.filter((f) =>
        f.name.toLowerCase().includes(query.toLowerCase()) ||
        (f.description ?? '').toLowerCase().includes(query.toLowerCase()),
      )
    : frameworks

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function pick(f: AssessmentFramework | null) {
    setSelected(f)
    setQuery(f ? f.name : '')
    setOpen(false)
    inputRef.current?.blur()
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    setSelected(null)
    setOpen(true)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
    if (e.key === 'ArrowDown' && !open) setOpen(true)
  }

  const displayLabel = selected
    ? `${selected.name}${selected.version ? ` v${selected.version}` : ''}`
    : query

  return (
    <div ref={containerRef} className="relative">
      {/* Hidden input carries the value for form submission */}
      <input type="hidden" name={name} value={selected?.id ?? ''} />

      {/* Visible search input */}
      <div
        className="flex items-center w-full rounded-xl px-3.5 py-2.5 text-sm transition-colors"
        style={{
          border: open ? '1px solid #6c5dd3' : '1px solid rgba(109,93,211,0.2)',
          background: 'white',
          boxShadow: open ? '0 0 0 3px rgba(108,93,211,0.08)' : 'none',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          autoComplete="off"
          placeholder="Search frameworks (ISO 27001, SOC 2, NIST…)"
          value={displayLabel}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: '#1e1550' }}
        />
        {/* Clear / chevron */}
        {selected ? (
          <button
            type="button"
            onClick={() => { setSelected(null); setQuery(''); setOpen(true); inputRef.current?.focus() }}
            className="ml-2 shrink-0 transition-opacity hover:opacity-60"
            style={{ color: '#a99fd8' }}
            aria-label="Clear selection"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => { setOpen((o) => !o); inputRef.current?.focus() }}
            className="ml-2 shrink-0 transition-transform"
            style={{ color: '#a99fd8', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
            aria-label="Toggle dropdown"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 5l4.5 4.5L11.5 5" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown list */}
      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-50 w-full mt-1.5 rounded-xl overflow-hidden"
          style={{
            background: 'white',
            border: '1px solid rgba(109,93,211,0.18)',
            boxShadow: '0 8px 24px rgba(109,93,211,0.14)',
            maxHeight: '280px',
            overflowY: 'auto',
          }}
        >
          {/* "No framework" option */}
          <button
            type="button"
            role="option"
            aria-selected={selected === null && query === ''}
            onClick={() => pick(null)}
            className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[rgba(109,93,211,0.06)]"
            style={{ color: '#a99fd8', borderBottom: '1px solid rgba(109,93,211,0.08)' }}
          >
            — No framework (manual) —
          </button>

          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm" style={{ color: '#a99fd8' }}>
              No frameworks match &quot;{query}&quot;
            </p>
          ) : (
            filtered.map((f) => (
              <button
                key={f.id}
                type="button"
                role="option"
                aria-selected={selected?.id === f.id}
                onClick={() => pick(f)}
                className="w-full text-left px-4 py-2.5 transition-colors hover:bg-[rgba(109,93,211,0.06)]"
                style={{
                  background: selected?.id === f.id ? 'rgba(109,93,211,0.08)' : undefined,
                  borderBottom: '1px solid rgba(109,93,211,0.06)',
                }}
              >
                <span className="block text-sm font-medium" style={{ color: '#1e1550' }}>
                  {f.name}{f.version ? ` v${f.version}` : ''}
                  {f.org_id === null && (
                    <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: 'rgba(109,93,211,0.1)', color: '#6c5dd3' }}>Standard</span>
                  )}
                </span>
                {f.description && (
                  <span className="block text-xs mt-0.5 line-clamp-1" style={{ color: '#a99fd8' }}>
                    {f.description}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
