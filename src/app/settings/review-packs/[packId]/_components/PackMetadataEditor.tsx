'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updatePackMetadataAction } from '../../actions'

type Cadence = 'annual' | 'biannual' | 'on_incident' | 'on_renewal'

interface Props {
  packId: string
  initialName: string
  initialDescription: string | null
  initialCadence: Cadence
  /** True only when both isCustom and site_admin — controls whether edit UI is shown at all. */
  canEdit: boolean
}

const CADENCE_OPTIONS: { value: Cadence; label: string }[] = [
  { value: 'annual',      label: 'Annual' },
  { value: 'biannual',    label: 'Biannual' },
  { value: 'on_incident', label: 'On incident' },
  { value: 'on_renewal',  label: 'On renewal' },
]

export function PackMetadataEditor({ packId, initialName, initialDescription, initialCadence, canEdit }: Props) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription ?? '')
  const [cadence, setCadence] = useState<Cadence>(initialCadence)

  if (!canEdit) return null

  const cancel = () => {
    setName(initialName)
    setDescription(initialDescription ?? '')
    setCadence(initialCadence)
    setError(null)
    setIsEditing(false)
  }

  const save = () => {
    if (!name.trim()) { setError('Name is required'); return }
    setError(null)
    startTransition(async () => {
      const r = await updatePackMetadataAction(packId, {
        name: name.trim(),
        description: description.trim() || null,
        review_cadence: cadence,
      })
      if (r.success) {
        setIsEditing(false)
        router.refresh()
      } else {
        setError(r.message ?? 'Failed to save')
      }
    })
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        style={{ background: 'rgba(108,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(108,93,211,0.15)' }}
      >
        Edit Pack
      </button>
    )
  }

  return (
    <div
      className="w-full rounded-xl p-4 space-y-3"
      style={{ background: 'white', border: '1px solid rgba(108,93,211,0.18)', boxShadow: '0 4px 16px rgba(30,21,80,0.06)' }}
    >
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6c5dd3' }}>
          Pack Name <span style={{ color: '#e11d48' }}>*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm"
          style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6c5dd3' }}>
          Description
        </label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this pack covers and when it applies"
          className="w-full rounded-lg px-3 py-2 text-sm"
          style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6c5dd3' }}>
          Review Cadence
        </label>
        <select
          value={cadence}
          onChange={(e) => setCadence(e.target.value as Cadence)}
          className="rounded-lg px-3 py-2 text-sm"
          style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550', background: 'white' }}
        >
          {CADENCE_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <p className="text-xs mt-1" style={{ color: '#6b5fa8' }}>
          How often the entire pack is re-run for vendors it&apos;s assigned to.
        </p>
      </div>

      {error && <p className="text-xs" style={{ color: '#e11d48' }}>{error}</p>}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={cancel}
          disabled={isPending}
          className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
          style={{ color: '#6b5fa8' }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="text-xs font-semibold px-4 py-1.5 rounded-full text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
