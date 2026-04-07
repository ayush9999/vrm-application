'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import type { VendorStatus } from '@/types/vendor'

const STATUS_OPTIONS: { value: VendorStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'suspended', label: 'Suspended' },
]

const inputStyle = {
  border: '1px solid rgba(109,93,211,0.2)',
  borderRadius: '0.75rem',
  background: 'white',
  color: '#1e1550',
  fontSize: '0.875rem',
  padding: '0.5rem 0.875rem',
  outline: 'none',
  boxShadow: '0 1px 4px rgba(109,93,211,0.06)',
}

export function VendorSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const search = searchParams.get('search') ?? ''
  const status = (searchParams.get('status') ?? '') as VendorStatus | ''
  const critical = searchParams.get('critical') === 'true'

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Search by name */}
      <input
        type="search"
        placeholder="Search vendors…"
        defaultValue={search}
        onChange={(e) => updateParams({ search: e.target.value || null })}
        style={{ ...inputStyle, width: '14rem' }}
        onFocus={(e) => {
          e.currentTarget.style.border = '1px solid #6c5dd3'
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(108,93,211,0.12)'
        }}
        onBlur={(e) => {
          e.currentTarget.style.border = '1px solid rgba(109,93,211,0.2)'
          e.currentTarget.style.boxShadow = '0 1px 4px rgba(109,93,211,0.06)'
        }}
      />

      {/* Filter by status */}
      <select
        value={status}
        onChange={(e) => updateParams({ status: e.target.value || null })}
        style={inputStyle}
        onFocus={(e) => {
          e.currentTarget.style.border = '1px solid #6c5dd3'
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(108,93,211,0.12)'
        }}
        onBlur={(e) => {
          e.currentTarget.style.border = '1px solid rgba(109,93,211,0.2)'
          e.currentTarget.style.boxShadow = '0 1px 4px rgba(109,93,211,0.06)'
        }}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Critical vendors toggle */}
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none" style={{ color: '#6b5fa8' }}>
        <input
          type="checkbox"
          checked={critical}
          onChange={(e) => updateParams({ critical: e.target.checked ? 'true' : null })}
          className="h-4 w-4 rounded"
          style={{ accentColor: '#6c5dd3' }}
        />
        Critical only
      </label>
    </div>
  )
}
