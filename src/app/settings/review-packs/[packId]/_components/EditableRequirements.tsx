'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addEvidenceReqAction,
  updateEvidenceReqAction,
  deleteEvidenceReqAction,
  addReviewReqAction,
  updateReviewReqAction,
  deleteReviewReqAction,
} from '../../actions'
import type { EvidenceRequirement, ReviewRequirement } from '@/types/review-pack'

interface Props {
  packId: string
  evidence: EvidenceRequirement[]
  reviews: ReviewRequirement[]
  isCustom: boolean
  canEdit: boolean
}

export function EditableRequirements({ packId, evidence, reviews, isCustom, canEdit }: Props) {
  const editable = isCustom && canEdit

  return (
    <div className="space-y-6">
      <EvidenceList packId={packId} items={evidence} editable={editable} />
      <ReviewList packId={packId} items={reviews} evidence={evidence} editable={editable} />
    </div>
  )
}

// ─── Evidence list ──────────────────────────────────────────────────────────

function EvidenceList({ packId, items, editable }: { packId: string; items: EvidenceRequirement[]; editable: boolean }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
          Evidence Requirements ({items.length})
        </h3>
        {editable && !showAdd && (
          <button type="button" onClick={() => setShowAdd(true)} className="text-xs font-medium px-3 py-1 rounded-full" style={{ background: 'rgba(108,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(108,93,211,0.15)' }}>
            + Add
          </button>
        )}
      </div>

      {items.length === 0 && !showAdd ? (
        <p className="text-sm" style={{ color: '#a99fd8' }}>No evidence requirements defined.</p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)' }}>
          {items.map((er, idx) => (
            <div
              key={er.id}
              className="px-4 py-3"
              style={{ borderBottom: idx === items.length - 1 && !showAdd ? undefined : '1px solid rgba(109,93,211,0.06)' }}
            >
              {editingId === er.id ? (
                <EvidenceEditForm
                  initial={er}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => setEditingId(null)}
                />
              ) : (
                <EvidenceDisplay er={er} idx={idx} editable={editable} onEdit={() => setEditingId(er.id)} />
              )}
            </div>
          ))}
          {showAdd && (
            <div className="px-4 py-3" style={{ background: 'rgba(108,93,211,0.03)' }}>
              <EvidenceEditForm
                packId={packId}
                onCancel={() => setShowAdd(false)}
                onSaved={() => setShowAdd(false)}
              />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function EvidenceDisplay({ er, idx, editable, onEdit }: { er: EvidenceRequirement; idx: number; editable: boolean; onEdit: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (!confirm(`Delete "${er.name}"?`)) return
    startTransition(async () => {
      await deleteEvidenceReqAction(er.id)
      router.refresh()
    })
  }

  return (
    <div className="flex items-start gap-3">
      <span className="text-xs font-mono pt-0.5 shrink-0" style={{ color: '#a99fd8' }}>{idx + 1}.</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium" style={{ color: '#1e1550' }}>{er.name}</span>
          {er.required && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: 'rgba(225,29,72,0.08)', color: '#e11d48' }}>
              Required
            </span>
          )}
          {er.expiry_applies && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: 'rgba(245,158,11,0.08)', color: '#d97706' }}>
              Has Expiry
            </span>
          )}
        </div>
        {er.description && <p className="text-xs mt-1" style={{ color: '#4a4270' }}>{er.description}</p>}
      </div>
      {editable && (
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={onEdit} className="text-[11px] font-medium px-2 py-1 rounded" style={{ color: '#6c5dd3' }}>
            Edit
          </button>
          <button type="button" onClick={handleDelete} disabled={isPending} className="text-[11px] font-medium px-2 py-1 rounded disabled:opacity-50" style={{ color: '#e11d48' }}>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

function EvidenceEditForm({
  packId,
  initial,
  onCancel,
  onSaved,
}: {
  packId?: string
  initial?: EvidenceRequirement
  onCancel: () => void
  onSaved: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [required, setRequired] = useState(initial?.required ?? true)
  const [expiryApplies, setExpiryApplies] = useState(initial?.expiry_applies ?? false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    if (!name.trim()) { setError('Name is required'); return }
    setError(null)
    startTransition(async () => {
      let result
      if (initial) {
        result = await updateEvidenceReqAction(initial.id, { name: name.trim(), description: description || null, required, expiry_applies: expiryApplies })
      } else if (packId) {
        result = await addEvidenceReqAction(packId, { name: name.trim(), description: description || null, required, expiry_applies: expiryApplies })
      }
      if (result?.success) {
        router.refresh()
        onSaved()
      } else {
        setError(result?.message ?? 'Failed')
      }
    })
  }

  return (
    <div className="space-y-2">
      <input className="w-full rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Evidence name (e.g. Signed Contract)" />
      <textarea rows={2} className="w-full rounded-lg px-3 py-2 text-xs" style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" />
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="h-3.5 w-3.5 rounded" style={{ accentColor: '#6c5dd3' }} />
          <span style={{ color: '#4a4270' }}>Required</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={expiryApplies} onChange={(e) => setExpiryApplies(e.target.checked)} className="h-3.5 w-3.5 rounded" style={{ accentColor: '#6c5dd3' }} />
          <span style={{ color: '#4a4270' }}>Has expiry</span>
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onCancel} className="text-xs px-3 py-1" style={{ color: '#a99fd8' }}>Cancel</button>
          <button type="button" onClick={handleSave} disabled={isPending} className="text-xs font-semibold px-3 py-1.5 rounded-full text-white disabled:opacity-50" style={{ background: '#6c5dd3' }}>
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {error && <p className="text-xs" style={{ color: '#e11d48' }}>{error}</p>}
    </div>
  )
}

// ─── Review list ────────────────────────────────────────────────────────────

function ReviewList({ packId, items, evidence, editable }: { packId: string; items: ReviewRequirement[]; evidence: EvidenceRequirement[]; editable: boolean }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
          Review Items ({items.length})
        </h3>
        {editable && !showAdd && (
          <button type="button" onClick={() => setShowAdd(true)} className="text-xs font-medium px-3 py-1 rounded-full" style={{ background: 'rgba(108,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(108,93,211,0.15)' }}>
            + Add
          </button>
        )}
      </div>

      {items.length === 0 && !showAdd ? (
        <p className="text-sm" style={{ color: '#a99fd8' }}>No review items defined.</p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)' }}>
          {items.map((rr, idx) => (
            <div
              key={rr.id}
              className="px-4 py-3"
              style={{ borderBottom: idx === items.length - 1 && !showAdd ? undefined : '1px solid rgba(109,93,211,0.06)' }}
            >
              {editingId === rr.id ? (
                <ReviewEditForm
                  initial={rr}
                  evidence={evidence}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => setEditingId(null)}
                />
              ) : (
                <ReviewDisplay rr={rr} idx={idx} editable={editable} onEdit={() => setEditingId(rr.id)} />
              )}
            </div>
          ))}
          {showAdd && (
            <div className="px-4 py-3" style={{ background: 'rgba(108,93,211,0.03)' }}>
              <ReviewEditForm
                packId={packId}
                evidence={evidence}
                onCancel={() => setShowAdd(false)}
                onSaved={() => setShowAdd(false)}
              />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function ReviewDisplay({ rr, idx, editable, onEdit }: { rr: ReviewRequirement; idx: number; editable: boolean; onEdit: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (!confirm(`Delete "${rr.name}"?`)) return
    startTransition(async () => {
      await deleteReviewReqAction(rr.id)
      router.refresh()
    })
  }

  return (
    <div className="flex items-start gap-3">
      <span className="text-xs font-mono pt-0.5 shrink-0" style={{ color: '#a99fd8' }}>{idx + 1}.</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium" style={{ color: '#1e1550' }}>{rr.name}</span>
          {rr.required && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: 'rgba(225,29,72,0.08)', color: '#e11d48' }}>
              Required
            </span>
          )}
          {rr.creates_remediation_on_fail && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: 'rgba(108,93,211,0.08)', color: '#6c5dd3' }}>
              Auto-Remediation
            </span>
          )}
        </div>
        {rr.description && <p className="text-xs mt-1" style={{ color: '#4a4270' }}>{rr.description}</p>}
        {rr.compliance_references && rr.compliance_references.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {rr.compliance_references.map((ref, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'rgba(109,93,211,0.05)', color: '#8b7fd4' }}>
                {ref.standard} {ref.reference}
              </span>
            ))}
          </div>
        )}
      </div>
      {editable && (
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={onEdit} className="text-[11px] font-medium px-2 py-1 rounded" style={{ color: '#6c5dd3' }}>
            Edit
          </button>
          <button type="button" onClick={handleDelete} disabled={isPending} className="text-[11px] font-medium px-2 py-1 rounded disabled:opacity-50" style={{ color: '#e11d48' }}>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

function ReviewEditForm({
  packId,
  initial,
  evidence,
  onCancel,
  onSaved,
}: {
  packId?: string
  initial?: ReviewRequirement
  evidence: EvidenceRequirement[]
  onCancel: () => void
  onSaved: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [required, setRequired] = useState(initial?.required ?? true)
  const [createsRemediation, setCreatesRemediation] = useState(initial?.creates_remediation_on_fail ?? false)
  const [linkedEvidenceId, setLinkedEvidenceId] = useState<string | null>(initial?.linked_evidence_requirement_id ?? null)
  const [refs, setRefs] = useState<{ standard: string; reference: string }[]>(initial?.compliance_references ?? [])
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    if (!name.trim()) { setError('Name is required'); return }
    setError(null)
    const cleanRefs = refs.filter((r) => r.standard.trim() && r.reference.trim())
    startTransition(async () => {
      let result
      if (initial) {
        result = await updateReviewReqAction(initial.id, {
          name: name.trim(),
          description: description || null,
          required,
          creates_remediation_on_fail: createsRemediation,
          linked_evidence_requirement_id: linkedEvidenceId,
          compliance_references: cleanRefs,
        })
      } else if (packId) {
        result = await addReviewReqAction(packId, {
          name: name.trim(),
          description: description || null,
          required,
          creates_remediation_on_fail: createsRemediation,
          linked_evidence_requirement_id: linkedEvidenceId,
          compliance_references: cleanRefs,
        })
      }
      if (result?.success) {
        router.refresh()
        onSaved()
      } else {
        setError(result?.message ?? 'Failed')
      }
    })
  }

  return (
    <div className="space-y-2">
      <input className="w-full rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Review item name" />
      <textarea rows={2} className="w-full rounded-lg px-3 py-2 text-xs" style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description / what passing looks like" />
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="h-3.5 w-3.5 rounded" style={{ accentColor: '#6c5dd3' }} />
          <span style={{ color: '#4a4270' }}>Required</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={createsRemediation} onChange={(e) => setCreatesRemediation(e.target.checked)} className="h-3.5 w-3.5 rounded" style={{ accentColor: '#6c5dd3' }} />
          <span style={{ color: '#4a4270' }}>Auto-Remediation on Fail</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <span style={{ color: '#4a4270' }}>Linked evidence:</span>
          <select className="rounded px-2 py-0.5 text-xs" style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }} value={linkedEvidenceId ?? ''} onChange={(e) => setLinkedEvidenceId(e.target.value || null)}>
            <option value="">— None —</option>
            {evidence.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
      </div>

      <div className="pt-2">
        <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#a99fd8' }}>Compliance References</label>
        {refs.map((cr, ci) => (
          <div key={ci} className="flex items-center gap-2 mb-1">
            <input className="rounded px-2 py-1 text-xs flex-1" style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }} placeholder="Standard" value={cr.standard} onChange={(e) => setRefs((rs) => rs.map((r, i) => i === ci ? { ...r, standard: e.target.value } : r))} />
            <input className="rounded px-2 py-1 text-xs flex-1" style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }} placeholder="Reference" value={cr.reference} onChange={(e) => setRefs((rs) => rs.map((r, i) => i === ci ? { ...r, reference: e.target.value } : r))} />
            <button type="button" onClick={() => setRefs((rs) => rs.filter((_, i) => i !== ci))} className="text-xs px-1.5" style={{ color: '#e11d48' }}>×</button>
          </div>
        ))}
        <button type="button" onClick={() => setRefs((rs) => [...rs, { standard: '', reference: '' }])} className="text-[11px] font-medium" style={{ color: '#6c5dd3' }}>
          + Add reference
        </button>
      </div>

      <div className="flex items-center gap-2 pt-2 justify-end">
        <button type="button" onClick={onCancel} className="text-xs px-3 py-1" style={{ color: '#a99fd8' }}>Cancel</button>
        <button type="button" onClick={handleSave} disabled={isPending} className="text-xs font-semibold px-3 py-1.5 rounded-full text-white disabled:opacity-50" style={{ background: '#6c5dd3' }}>
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error && <p className="text-xs" style={{ color: '#e11d48' }}>{error}</p>}
    </div>
  )
}
