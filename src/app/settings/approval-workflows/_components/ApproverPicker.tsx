'use client'

import { useState, useTransition } from 'react'
import type { OrgUser } from '@/lib/db/organizations'

interface Props {
  tier: number
  currentApproverId: string | null
  users: OrgUser[]
  canEdit: boolean
  setAction: (tier: number, approverUserId: string | null) => Promise<{ success?: boolean; message?: string }>
}

export function ApproverPicker({ tier, currentApproverId, users, canEdit, setAction }: Props) {
  const [value, setValue] = useState(currentApproverId ?? '')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const handleChange = (newId: string) => {
    setValue(newId)
    setMessage(null)
    startTransition(async () => {
      const r = await setAction(tier, newId || null)
      if (r.success) setMessage('Saved')
      else setMessage(r.message ?? 'Failed')
    })
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={!canEdit || isPending}
        className="rounded-lg px-3 py-1.5 text-sm focus:outline-none disabled:opacity-50"
        style={{ border: '1px solid rgba(109,93,211,0.2)', background: 'white', color: '#1e1550' }}
      >
        <option value="">— No default —</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.name ?? u.email ?? u.id}</option>
        ))}
      </select>
      {message && (
        <span className="text-[11px]" style={{ color: message === 'Saved' ? '#059669' : '#e11d48' }}>{message}</span>
      )}
    </div>
  )
}
