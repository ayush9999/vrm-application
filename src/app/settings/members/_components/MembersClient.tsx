'use client'

import { useState, useActionState, useTransition } from 'react'
import { createInviteAction, revokeInviteAction } from '@/app/settings/members/actions'
import { Spinner } from '@/app/_components/Spinner'
import type { OrgMember } from '@/lib/db/invites'
import type { OrgInviteWithInviter, InviteStatus } from '@/types/invite'
import type { FormState } from '@/types/common'

const INITIAL: FormState = {}

interface InviteWithStatusAndUrl extends OrgInviteWithInviter {
  status: InviteStatus
  invite_url: string
}

interface MembersClientProps {
  members: OrgMember[]
  invites: InviteWithStatusAndUrl[]
  currentUserId: string
  isOwner: boolean
}

const ROLE_LABELS: Record<string, string> = {
  site_admin: 'Owner',
  vendor_admin: 'Member',
}

export function MembersClient({ members, invites, currentUserId, isOwner }: MembersClientProps) {
  const [showInviteForm, setShowInviteForm] = useState(false)

  const pending = invites.filter((i) => i.status === 'pending')
  const past = invites.filter((i) => i.status !== 'pending')

  return (
    <div className="space-y-6">
      {/* Members card */}
      <section
        className="bg-white rounded-2xl"
        style={{
          border: '1px solid rgba(109,93,211,0.1)',
          boxShadow: '0 2px 12px rgba(109,93,211,0.08)',
        }}
      >
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(109,93,211,0.06)' }}>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#1e1550' }}>
              Members ({members.length})
            </h3>
            <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>
              People with access to this organisation
            </p>
          </div>
          {isOwner && !showInviteForm && (
            <button
              type="button"
              onClick={() => setShowInviteForm(true)}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
            >
              + Invite teammate
            </button>
          )}
        </div>

        {showInviteForm && isOwner && (
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(109,93,211,0.06)' }}>
            <InviteForm onClose={() => setShowInviteForm(false)} />
          </div>
        )}

        <ul className="divide-y" style={{ borderColor: 'rgba(109,93,211,0.06)' }}>
          {members.map((m) => (
            <li key={m.user_id} className="px-5 py-3 flex items-center gap-3">
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
              >
                {(m.name?.[0] ?? m.email?.[0] ?? '?').toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#1e1550' }}>
                  {m.name ?? m.email ?? 'Unknown'}
                  {m.user_id === currentUserId && (
                    <span className="ml-1.5 text-[10px] font-normal" style={{ color: '#a99fd8' }}>
                      (you)
                    </span>
                  )}
                </p>
                {m.email && (
                  <p className="text-xs truncate" style={{ color: '#a99fd8' }}>
                    {m.email}
                  </p>
                )}
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
                style={{
                  background: m.role === 'site_admin' ? 'rgba(108,93,211,0.12)' : 'rgba(169,159,216,0.15)',
                  color: m.role === 'site_admin' ? '#6c5dd3' : '#6b5fa8',
                }}
              >
                {ROLE_LABELS[m.role] ?? m.role}
              </span>
              <span className="text-[10px] shrink-0" style={{ color: '#a99fd8' }}>
                Joined {new Date(m.joined_at).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Pending invites */}
      {pending.length > 0 && (
        <section
          className="bg-white rounded-2xl"
          style={{
            border: '1px solid rgba(109,93,211,0.1)',
            boxShadow: '0 2px 12px rgba(109,93,211,0.08)',
          }}
        >
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(109,93,211,0.06)' }}>
            <h3 className="text-sm font-semibold" style={{ color: '#1e1550' }}>
              Pending invites ({pending.length})
            </h3>
            <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>
              Copy a link to share with the invitee
            </p>
          </div>
          <ul className="divide-y" style={{ borderColor: 'rgba(109,93,211,0.06)' }}>
            {pending.map((inv) => (
              <PendingInviteRow key={inv.id} invite={inv} canRevoke={isOwner} />
            ))}
          </ul>
        </section>
      )}

      {/* Past invites */}
      {past.length > 0 && (
        <section
          className="bg-white rounded-2xl"
          style={{
            border: '1px solid rgba(109,93,211,0.1)',
            boxShadow: '0 2px 12px rgba(109,93,211,0.08)',
          }}
        >
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(109,93,211,0.06)' }}>
            <h3 className="text-sm font-semibold" style={{ color: '#1e1550' }}>
              Past invites ({past.length})
            </h3>
          </div>
          <ul className="divide-y" style={{ borderColor: 'rgba(109,93,211,0.06)' }}>
            {past.map((inv) => (
              <li key={inv.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#1e1550' }}>
                    {inv.email}
                  </p>
                  <p className="text-xs" style={{ color: '#a99fd8' }}>
                    {inv.status === 'accepted' && inv.accepted_at
                      ? `Accepted ${new Date(inv.accepted_at).toLocaleDateString()}`
                      : inv.status === 'expired'
                        ? 'Expired'
                        : 'Revoked'}
                  </p>
                </div>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    background:
                      inv.status === 'accepted'
                        ? 'rgba(5,150,105,0.1)'
                        : 'rgba(148,163,184,0.15)',
                    color: inv.status === 'accepted' ? '#059669' : '#64748b',
                  }}
                >
                  {inv.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ─── Invite form ──────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-[rgba(109,93,211,0.2)] bg-white px-3 py-2 text-sm text-[#1e1550] placeholder:text-[#c4bae8] shadow-sm focus:border-[#6c5dd3] focus:outline-none focus:ring-1 focus:ring-[#6c5dd3] transition-colors'
const labelCls = 'block text-xs font-semibold text-[#6b5fa8] mb-1'

function InviteForm({ onClose }: { onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(createInviteAction, INITIAL)
  const err = state.errors ?? {}

  // Auto-close on success
  if (state.success) {
    onClose()
  }

  return (
    <form action={formAction} className="space-y-3">
      {state.message && (
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{
            background: 'rgba(225,29,72,0.06)',
            border: '1px solid rgba(225,29,72,0.2)',
            color: '#e11d48',
          }}
        >
          {state.message}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className={labelCls}>
            Email <span className="text-rose-500">*</span>
          </label>
          <input
            name="email"
            type="email"
            autoFocus
            placeholder="teammate@acme.com"
            className={inputCls}
          />
          {err.email && <p className="mt-1 text-xs text-rose-600">{err.email[0]}</p>}
        </div>
        <div>
          <label className={labelCls}>Role</label>
          <select name="role" defaultValue="vendor_admin" className={inputCls}>
            <option value="vendor_admin">Member</option>
            <option value="site_admin">Owner</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
        >
          {isPending && <Spinner />}
          {isPending ? 'Creating…' : 'Create invite'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-[#a99fd8] hover:text-[#6c5dd3] px-2 py-2"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Pending invite row with copy + revoke ────────────────────────────────────

function PendingInviteRow({
  invite,
  canRevoke,
}: {
  invite: InviteWithStatusAndUrl
  canRevoke: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleCopy() {
    navigator.clipboard.writeText(invite.invite_url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function handleRevoke() {
    if (!confirm('Revoke this invite? The link will stop working.')) return
    startTransition(async () => {
      await revokeInviteAction(invite.id)
    })
  }

  return (
    <li className="px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: '#1e1550' }}>
            {invite.email}
          </p>
          <p className="text-xs" style={{ color: '#a99fd8' }}>
            {ROLE_LABELS[invite.role] ?? invite.role} ·{' '}
            Expires {new Date(invite.expires_at).toLocaleDateString()}
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
          style={{
            background: copied ? 'rgba(5,150,105,0.1)' : 'rgba(109,93,211,0.08)',
            color: copied ? '#059669' : '#6c5dd3',
            border: `1px solid ${copied ? 'rgba(5,150,105,0.2)' : 'rgba(109,93,211,0.15)'}`,
          }}
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        {canRevoke && (
          <button
            type="button"
            onClick={handleRevoke}
            disabled={isPending}
            className="text-xs font-medium hover:text-rose-600 disabled:opacity-50 transition-colors"
            style={{ color: '#a99fd8' }}
          >
            Revoke
          </button>
        )}
      </div>
    </li>
  )
}
