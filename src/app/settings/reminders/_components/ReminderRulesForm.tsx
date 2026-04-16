'use client'

import { useState, useTransition } from 'react'
import type { ReminderRules } from '@/lib/db/org-settings'

const ALERTS: { key: keyof ReminderRules; label: string; description: string }[] = [
  { key: 'evidence_expiring_30d',        label: 'Evidence expiring in 30 days', description: 'Sent when an Approved evidence document is 30 days from expiry.' },
  { key: 'evidence_expiring_7d',         label: 'Evidence expiring in 7 days',  description: 'Sent when an Approved evidence document is 7 days from expiry.' },
  { key: 'evidence_expiring_1d',         label: 'Evidence expiring tomorrow',   description: 'Sent the day before evidence expires.' },
  { key: 'review_overdue',               label: 'Review overdue',               description: 'Sent when a vendor review pack passes its due date without being completed.' },
  { key: 'remediation_assigned',         label: 'New remediation assigned',     description: 'Sent to the assigned owner when a remediation is created or re-assigned.' },
  { key: 'remediation_overdue',          label: 'Remediation overdue',          description: 'Sent when an open remediation passes its due date.' },
  { key: 'approval_decision',            label: 'Approval decision made',       description: 'Sent to the vendor owner when approval status changes to Approved or Blocked.' },
  { key: 'vendor_questionnaire_submitted', label: 'Vendor questionnaire submitted', description: 'Sent when a vendor finalizes their portal submission.' },
]

interface Props {
  rules: ReminderRules
  canEdit: boolean
  saveAction: (rules: ReminderRules) => Promise<{ success?: boolean; message?: string }>
}

export function ReminderRulesForm({ rules: initial, canEdit, saveAction }: Props) {
  const [rules, setRules] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const toggle = (key: keyof ReminderRules) => {
    setRules((r) => ({ ...r, [key]: !r[key] }))
  }

  const handleSave = () => {
    setMessage(null)
    startTransition(async () => {
      const r = await saveAction(rules)
      if (r.success) setMessage('Saved')
      else setMessage(r.message ?? 'Failed')
    })
  }

  return (
    <div
      className={`rounded-2xl overflow-hidden ${canEdit ? '' : 'opacity-60'}`}
      style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}
    >
      {ALERTS.map((a, i) => (
        <label
          key={a.key}
          className="flex items-start gap-3 px-5 py-3 cursor-pointer hover:bg-[rgba(109,93,211,0.02)] transition-colors"
          style={{ borderBottom: i === ALERTS.length - 1 ? undefined : '1px solid rgba(109,93,211,0.06)' }}
        >
          <input
            type="checkbox"
            checked={rules[a.key]}
            onChange={() => toggle(a.key)}
            disabled={!canEdit}
            className="mt-1 h-4 w-4 rounded shrink-0"
            style={{ accentColor: '#6c5dd3' }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium" style={{ color: '#1e1550' }}>{a.label}</div>
            <div className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>{a.description}</div>
          </div>
        </label>
      ))}
      <div className="px-5 py-3 flex items-center gap-3" style={{ background: 'rgba(108,93,211,0.02)' }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canEdit || isPending}
          className="text-sm font-semibold px-5 py-2 rounded-full text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
        >
          {isPending ? 'Saving…' : 'Save Preferences'}
        </button>
        {message && <p className="text-xs" style={{ color: message === 'Saved' ? '#059669' : '#e11d48' }}>{message}</p>}
      </div>
    </div>
  )
}
