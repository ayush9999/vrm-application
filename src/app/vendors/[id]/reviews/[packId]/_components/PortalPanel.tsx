'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { VendorPortalLink } from '@/lib/db/vendor-portal'

interface Props {
  vendorId: string
  vendorReviewPackId: string
  initialLinks: VendorPortalLink[]
  createAction: (
    vendorId: string,
    vendorReviewPackId: string,
    recipientEmail: string | null,
    expiryDays: number,
  ) => Promise<{ url?: string; link?: VendorPortalLink; message?: string }>
  revokeAction: (
    linkId: string,
    vendorId: string,
    vendorReviewPackId: string,
  ) => Promise<{ message?: string; success?: boolean }>
}

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  active:    { label: 'Active',    bg: 'rgba(5,150,105,0.1)',    color: '#059669' },
  submitted: { label: 'Submitted', bg: 'rgba(99,102,241,0.1)',   color: '#6366f1' },
  expired:   { label: 'Expired',   bg: 'rgba(225,29,72,0.1)',    color: '#e11d48' },
  revoked:   { label: 'Revoked',   bg: 'rgba(148,163,184,0.15)', color: '#64748b' },
}

export function PortalPanel({ vendorId, vendorReviewPackId, initialLinks, createAction, revokeAction }: Props) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [expiryDays, setExpiryDays] = useState('14')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCreate = () => {
    setError(null)
    startTransition(async () => {
      const r = await createAction(vendorId, vendorReviewPackId, email.trim() || null, parseInt(expiryDays, 10) || 14)
      if (r.url) {
        await navigator.clipboard.writeText(r.url)
        setCopiedId(r.link!.id)
        setEmail('')
        router.refresh()
      } else {
        setError(r.message ?? 'Failed to create link')
      }
    })
  }

  const handleRevoke = (linkId: string) => {
    if (!confirm('Revoke this link? The vendor will no longer be able to access it.')) return
    startTransition(async () => {
      const r = await revokeAction(linkId, vendorId, vendorReviewPackId)
      if (r.success) router.refresh()
      else setError(r.message ?? 'Failed to revoke')
    })
  }

  const handleCopy = async (link: VendorPortalLink) => {
    const url = `${window.location.origin}/portal/${link.token}`
    await navigator.clipboard.writeText(url)
    setCopiedId(link.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div
      className="rounded-2xl"
      style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div>
          <div className="text-sm font-semibold" style={{ color: '#1e1550' }}>Vendor Questionnaire</div>
          <div className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>
            Send a link the vendor can use to upload evidence and answer questions — no login needed
          </div>
        </div>
        <div className="flex items-center gap-2">
          {initialLinks.length > 0 && (
            <span className="text-[11px] font-bold" style={{ color: '#6c5dd3' }}>
              {initialLinks.filter((l) => l.status === 'active').length} active
            </span>
          )}
          <svg
            width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#a99fd8" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            className="transition-transform"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid rgba(109,93,211,0.06)' }}>
          {/* Create new */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Recipient email (optional)"
              className="rounded-lg px-3 py-2 text-xs focus:outline-none sm:col-span-2"
              style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
            />
            <select
              value={expiryDays}
              onChange={(e) => setExpiryDays(e.target.value)}
              className="rounded-lg px-3 py-2 text-xs focus:outline-none"
              style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
            >
              <option value="7">Expires in 7 days</option>
              <option value="14">Expires in 14 days</option>
              <option value="30">Expires in 30 days</option>
              <option value="90">Expires in 90 days</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending}
            className="text-xs font-semibold px-4 py-2 rounded-full text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
          >
            {isPending ? 'Creating…' : '+ Create Portal Link (auto-copies URL)'}
          </button>
          {error && <p className="text-xs" style={{ color: '#e11d48' }}>{error}</p>}

          {/* Existing links */}
          {initialLinks.length > 0 && (
            <div className="space-y-1.5 pt-3" style={{ borderTop: '1px solid rgba(109,93,211,0.06)' }}>
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
                Existing Links
              </div>
              {initialLinks.map((link) => {
                const sty = STATUS_STYLE[link.status]
                return (
                  <div
                    key={link.id}
                    className="flex items-center gap-2 p-2.5 rounded-lg"
                    style={{ background: 'rgba(108,93,211,0.03)', border: '1px solid rgba(108,93,211,0.08)' }}
                  >
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0" style={{ background: sty.bg, color: sty.color }}>
                      {sty.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs truncate" style={{ color: '#4a4270' }}>
                        {link.recipient_email ?? <span style={{ color: '#a99fd8' }}>No recipient</span>}
                      </div>
                      <div className="text-[10px]" style={{ color: '#a99fd8' }}>
                        Expires {new Date(link.expires_at).toLocaleDateString()} · {link.access_count} access{link.access_count !== 1 ? 'es' : ''}
                      </div>
                    </div>
                    {link.status === 'active' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCopy(link)}
                          className="text-[11px] font-medium px-2 py-1 rounded-md"
                          style={{ background: 'rgba(108,93,211,0.06)', color: '#6c5dd3' }}
                        >
                          {copiedId === link.id ? '✓ Copied' : 'Copy URL'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevoke(link.id)}
                          disabled={isPending}
                          className="text-[11px] font-medium px-2 py-1 rounded-md disabled:opacity-50"
                          style={{ background: 'rgba(225,29,72,0.06)', color: '#e11d48' }}
                        >
                          Revoke
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
