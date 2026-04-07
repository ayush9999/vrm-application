'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { VendorIncident, IncidentSeverity, IncidentStatus } from '@/types/incident'
import type { FormState } from '@/types/common'
import { Spinner } from '@/app/_components/Spinner'

// ─── Config ────────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<IncidentSeverity, { label: string; className: string }> = {
  low:      { label: 'Low',      className: 'bg-slate-100 text-slate-600 ring-1 ring-slate-400/20' },
  medium:   { label: 'Medium',   className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20' },
  high:     { label: 'High',     className: 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20' },
  critical: { label: 'Critical', className: 'bg-rose-600 text-white' },
}

const STATUS_CONFIG: Record<IncidentStatus, { label: string; className: string }> = {
  open:     { label: 'Open',     className: 'bg-slate-100 text-slate-700' },
  resolved: { label: 'Resolved', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' },
}

const inputCls =
  'w-full rounded-lg border border-[rgba(109,93,211,0.2)] bg-white px-3 py-2 text-sm text-[#1e1550] placeholder:text-[#c4bae8] shadow-sm focus:border-[#6c5dd3] focus:outline-none focus:ring-1 focus:ring-[#6c5dd3] transition-colors'
const labelCls = 'block text-xs font-semibold text-[#6b5fa8] mb-1'
const fieldErrorCls = 'mt-1 text-xs text-rose-600'

// ─── Create form ───────────────────────────────────────────────────────────────

function CreateIncidentForm({
  action,
  onClose,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>
  onClose: () => void
}) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(action, {})
  const err = state.errors ?? {}

  useEffect(() => {
    if (state.success) {
      router.refresh()
      onClose()
    }
  }, [state.success, router, onClose])

  return (
    <form action={formAction} className="bg-white rounded-2xl p-5 space-y-4 mb-6" style={{ boxShadow: '0 2px 12px rgba(109,93,211,0.08)', border: '1px solid rgba(109,93,211,0.1)' }}>
      <h3 className="text-sm font-semibold" style={{ color: '#1e1550' }}>New Incident</h3>

      {state.message && (
        <p className="text-xs text-rose-600 font-medium">{state.message}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelCls}>Incident Date <span className="text-rose-500">*</span></label>
          <input
            name="incident_date"
            type="date"
            defaultValue={new Date().toISOString().split('T')[0]}
            className={inputCls}
          />
          {err.incident_date && <p className={fieldErrorCls}>{err.incident_date[0]}</p>}
        </div>

        <div>
          <label className={labelCls}>Severity <span className="text-rose-500">*</span></label>
          <select name="severity" defaultValue="low" className={inputCls}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          {err.severity && <p className={fieldErrorCls}>{err.severity[0]}</p>}
        </div>

        <div>
          <label className={labelCls}>Status <span className="text-rose-500">*</span></label>
          <select name="status" defaultValue="open" className={inputCls}>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
          {err.status && <p className={fieldErrorCls}>{err.status[0]}</p>}
        </div>
      </div>

      <div>
        <label className={labelCls}>Description <span className="text-rose-500">*</span></label>
        <textarea
          name="description"
          rows={3}
          placeholder="Describe what happened…"
          className={inputCls}
        />
        {err.description && <p className={fieldErrorCls}>{err.description[0]}</p>}
      </div>

      <div>
        <label className={labelCls}>
          Notes <span className="text-[#c4bae8] font-normal">(optional)</span>
        </label>
        <textarea
          name="notes"
          rows={2}
          placeholder="Additional context, follow-up actions…"
          className={inputCls}
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 justify-center rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-50 transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
        >
          {isPending && <Spinner />}
          {isPending ? 'Saving…' : 'Raise Incident'}
        </button>
        <button type="button" onClick={onClose} className="text-sm text-[#a99fd8] hover:text-[#6c5dd3] px-2 py-2">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Edit form ─────────────────────────────────────────────────────────────────

function EditIncidentForm({
  incident,
  action,
  onClose,
}: {
  incident: VendorIncident
  action: (prevState: FormState, formData: FormData) => Promise<FormState>
  onClose: () => void
}) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(action, {})
  const err = state.errors ?? {}

  useEffect(() => {
    if (state.success) {
      router.refresh()
      onClose()
    }
  }, [state.success, router, onClose])

  return (
    <form action={formAction} className="mt-3 p-4 rounded-lg space-y-3" style={{ background: 'rgba(109,93,211,0.03)', border: '1px solid rgba(109,93,211,0.1)' }}>
      <input type="hidden" name="incident_id" value={incident.id} />

      {state.message && <p className="text-xs text-rose-600 font-medium">{state.message}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={labelCls}>Date</label>
          <input name="incident_date" type="date" defaultValue={incident.incident_date} className={inputCls} />
          {err.incident_date && <p className={fieldErrorCls}>{err.incident_date[0]}</p>}
        </div>
        <div>
          <label className={labelCls}>Severity</label>
          <select name="severity" defaultValue={incident.severity} className={inputCls}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select name="status" defaultValue={incident.status} className={inputCls}>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <textarea name="description" rows={2} defaultValue={incident.description} className={inputCls} />
        {err.description && <p className={fieldErrorCls}>{err.description[0]}</p>}
      </div>

      <div>
        <label className={labelCls}>Notes</label>
        <textarea name="notes" rows={2} defaultValue={incident.notes ?? ''} placeholder="Additional context…" className={inputCls} />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 justify-center rounded-full px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50 transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
        >
          {isPending && <Spinner />}
          {isPending ? 'Saving…' : 'Save Changes'}
        </button>
        <button type="button" onClick={onClose} className="text-xs text-[#a99fd8] hover:text-[#6c5dd3] px-2 py-2">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Delete button ─────────────────────────────────────────────────────────────

function DeleteIncidentButton({
  incidentId,
  deleteAction,
}: {
  incidentId: string
  deleteAction: (prevState: FormState, formData: FormData) => Promise<FormState>
}) {
  const [state, formAction, isPending] = useActionState(deleteAction, {})

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm('Delete this incident? This cannot be undone.')) e.preventDefault()
      }}
    >
      <input type="hidden" name="incident_id" value={incidentId} />
      {state.message && <span className="text-xs text-rose-600 mr-1">{state.message}</span>}
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-1 text-xs text-[#a99fd8] hover:text-rose-600 font-medium shrink-0 transition-colors disabled:opacity-50"
      >
        {isPending && <Spinner size={11} />}
        {isPending ? 'Deleting…' : 'Delete'}
      </button>
    </form>
  )
}

// ─── Incident card ─────────────────────────────────────────────────────────────

function IncidentCard({
  incident,
  updateAction,
  deleteAction,
}: {
  incident: VendorIncident
  updateAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  deleteAction: (prevState: FormState, formData: FormData) => Promise<FormState>
}) {
  const [editing, setEditing] = useState(false)
  const sev = SEVERITY_CONFIG[incident.severity]
  const sta = STATUS_CONFIG[incident.status]

  return (
    <div className={`rounded-2xl bg-white shadow-[0_2px_12px_rgba(109,93,211,0.08)] overflow-hidden ${
      incident.status === 'resolved' ? 'opacity-60' : ''
    }`}>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${sev.className}`}>
              {sev.label}
            </span>
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${sta.className}`}>
              {sta.label}
            </span>
            <span className="text-xs" style={{ color: '#a99fd8' }}>
              {new Date(incident.incident_date).toLocaleDateString(undefined, {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setEditing((e) => !e)}
              className="text-xs text-[#a99fd8] hover:text-[#6c5dd3] font-medium transition-colors"
            >
              {editing ? 'Close' : 'Edit'}
            </button>
            <span className="text-[#c4bae8]">|</span>
            <DeleteIncidentButton incidentId={incident.id} deleteAction={deleteAction} />
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed" style={{ color: '#1e1550' }}>{incident.description}</p>

        {incident.notes && (
          <p className="mt-2 text-xs leading-relaxed border-l-2 pl-3 italic" style={{ color: '#4a4270', borderColor: 'rgba(109,93,211,0.15)' }}>
            {incident.notes}
          </p>
        )}

        <p className="mt-3 text-xs" style={{ color: '#a99fd8' }}>
          Logged {new Date(incident.created_at).toLocaleString(undefined, {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </div>

      {editing && (
        <div className="px-5 pb-5" style={{ borderTop: '1px solid rgba(109,93,211,0.08)' }}>
          <EditIncidentForm
            incident={incident}
            action={updateAction}
            onClose={() => setEditing(false)}
          />
        </div>
      )}
    </div>
  )
}

// ─── Main tab ──────────────────────────────────────────────────────────────────

export interface IncidentsTabProps {
  incidents: VendorIncident[]
  createIncidentAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  updateIncidentAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  deleteIncidentAction: (prevState: FormState, formData: FormData) => Promise<FormState>
}

export function IncidentsTab({ incidents, createIncidentAction, updateIncidentAction, deleteIncidentAction }: IncidentsTabProps) {
  const [showCreate, setShowCreate] = useState(false)

  const open = incidents.filter((i) => i.status === 'open')
  const resolved = incidents.filter((i) => i.status === 'resolved')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: '#1e1550' }}>Incidents</h3>
          <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>
            {open.length} open · {resolved.length} resolved
          </p>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
          >
            + Raise Incident
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateIncidentForm
          action={createIncidentAction}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Open incidents */}
      {open.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Open</h4>
          {open.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              updateAction={updateIncidentAction}
              deleteAction={deleteIncidentAction}
            />
          ))}
        </section>
      )}

      {/* Resolved incidents */}
      {resolved.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Resolved</h4>
          {resolved.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              updateAction={updateIncidentAction}
              deleteAction={deleteIncidentAction}
            />
          ))}
        </section>
      )}

      {/* Empty state */}
      {incidents.length === 0 && !showCreate && (
        <div className="rounded-2xl px-6 py-14 text-center" style={{ border: '1.5px dashed rgba(109,93,211,0.2)' }}>
          <p className="text-sm font-medium" style={{ color: '#1e1550' }}>No incidents recorded</p>
          <p className="text-xs mt-1" style={{ color: '#a99fd8' }}>
            Raise an incident to start tracking issues with this vendor.
          </p>
        </div>
      )}
    </div>
  )
}
