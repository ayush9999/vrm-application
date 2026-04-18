'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
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
  detected:      { label: 'Detected',      className: 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20' },
  investigating: { label: 'Investigating', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20' },
  contained:     { label: 'Contained',     className: 'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20' },
  resolved:      { label: 'Resolved',      className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' },
  closed:        { label: 'Closed',        className: 'bg-slate-100 text-slate-600 ring-1 ring-slate-400/20' },
}

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  data_breach: 'Data Breach',
  service_outage: 'Service Outage',
  compliance_violation: 'Compliance Violation',
  security_incident: 'Security Incident',
  quality_defect: 'Quality Defect',
  financial_issue: 'Financial Issue',
  contractual_breach: 'Contractual Breach',
  other: 'Other',
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

      {/* Row 1: Date, Type, Severity, Status */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className={labelCls}>Date <span className="text-rose-500">*</span></label>
          <input name="incident_date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className={inputCls} />
          {err.incident_date && <p className={fieldErrorCls}>{err.incident_date[0]}</p>}
        </div>
        <div>
          <label className={labelCls}>Type <span className="text-rose-500">*</span></label>
          <select name="incident_type" defaultValue="other" className={inputCls}>
            {Object.entries(INCIDENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
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
          <label className={labelCls}>Status</label>
          <select name="status" defaultValue="detected" className={inputCls}>
            <option value="detected">Detected</option>
            <option value="investigating">Investigating</option>
            <option value="contained">Contained</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Row 2: Description */}
      <div>
        <label className={labelCls}>Description <span className="text-rose-500">*</span></label>
        <textarea name="description" rows={3} placeholder="Describe what happened…" className={inputCls} />
        {err.description && <p className={fieldErrorCls}>{err.description[0]}</p>}
      </div>

      {/* Row 3: Impact */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className={labelCls}>Impact Scope</label>
          <select name="impact_scope" defaultValue="none" className={inputCls}>
            <option value="none">None</option>
            <option value="limited">Limited</option>
            <option value="moderate">Moderate</option>
            <option value="significant">Significant</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Records Affected</label>
          <input name="records_affected" type="number" min="0" placeholder="0" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Users Affected</label>
          <input name="users_affected" type="number" min="0" placeholder="0" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Data Types Involved</label>
          <input name="data_types_involved" type="text" placeholder="personal, financial…" className={inputCls} />
        </div>
      </div>

      {/* Row 4: Timeline */}
      <details className="text-xs">
        <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8b7fd4' }}>
          Response Timeline + Root Cause (optional)
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className={labelCls}>Detected At</label>
            <input name="detected_at" type="datetime-local" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Vendor Reported At</label>
            <input name="reported_by_vendor_at" type="datetime-local" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Root Cause</label>
            <select name="root_cause" className={inputCls}>
              <option value="">— Unknown —</option>
              <option value="human_error">Human Error</option>
              <option value="system_failure">System Failure</option>
              <option value="third_party">Third Party</option>
              <option value="malicious_actor">Malicious Actor</option>
              <option value="process_gap">Process Gap</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>SLA (hours)</label>
            <input name="sla_notification_hours" type="number" min="0" placeholder="e.g. 72" className={inputCls} />
          </div>
        </div>
        <div className="mt-3">
          <label className={labelCls}>Root Cause Detail</label>
          <textarea name="root_cause_detail" rows={2} placeholder="What caused this incident?" className={inputCls} />
        </div>
      </details>

      {/* Row 5: Regulatory */}
      <details className="text-xs">
        <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8b7fd4' }}>
          Regulatory Reporting (optional)
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-2 pt-5">
            <input name="is_reportable" type="checkbox" value="true" className="h-4 w-4 rounded" style={{ accentColor: '#6c5dd3' }} />
            <label className="text-xs font-medium" style={{ color: '#4a4270' }}>Reportable to regulator</label>
          </div>
          <div>
            <label className={labelCls}>Applicable Regulation</label>
            <input name="applicable_regulation" type="text" placeholder="GDPR, HIPAA…" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Reporting Deadline</label>
            <input name="reporting_deadline" type="datetime-local" className={inputCls} />
          </div>
        </div>
      </details>

      <div>
        <label className={labelCls}>Notes <span className="text-[#c4bae8] font-normal">(optional)</span></label>
        <textarea name="notes" rows={2} placeholder="Additional context, follow-up actions…" className={inputCls} />
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
            <option value="detected">Detected</option>
            <option value="investigating">Investigating</option>
            <option value="contained">Contained</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
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
  recurrenceCount,
  updateAction,
  deleteAction,
}: {
  incident: VendorIncident
  recurrenceCount: number  // how many past incidents of the same type
  updateAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  deleteAction: (prevState: FormState, formData: FormData) => Promise<FormState>
}) {
  const [editing, setEditing] = useState(false)
  const sev = SEVERITY_CONFIG[incident.severity]
  const sta = STATUS_CONFIG[incident.status]

  const incType = incident.incident_type ? INCIDENT_TYPE_LABELS[incident.incident_type] ?? incident.incident_type : null
  const isClosed = incident.status === 'closed' || incident.status === 'resolved'

  // SLA check
  const slaBreached = (() => {
    if (!incident.sla_notification_hours || !incident.detected_at || !incident.reported_by_vendor_at) return null
    const detectMs = new Date(incident.detected_at).getTime()
    const reportMs = new Date(incident.reported_by_vendor_at).getTime()
    const diffHours = (reportMs - detectMs) / (1000 * 60 * 60)
    return diffHours > incident.sla_notification_hours
  })()

  return (
    <div className={`rounded-2xl bg-white shadow-[0_2px_12px_rgba(109,93,211,0.08)] overflow-hidden ${isClosed ? 'opacity-70' : ''}`}>
      <div className="px-5 py-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {incType && (
              <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase" style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3' }}>
                {incType}
              </span>
            )}
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${sev.className}`}>{sev.label}</span>
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${sta.className}`}>{sta.label}</span>
            {slaBreached === true && (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: 'rgba(225,29,72,0.1)', color: '#e11d48' }}>SLA Breached</span>
            )}
            {incident.is_reportable && !incident.reported_to_regulator && (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706' }}>Reporting Required</span>
            )}
            {recurrenceCount > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: 'rgba(225,29,72,0.08)', color: '#e11d48' }}>
                {recurrenceCount + 1}x recurrence
              </span>
            )}
            <span className="text-xs" style={{ color: '#a99fd8' }}>
              {new Date(incident.incident_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={() => setEditing((e) => !e)} className="text-xs text-[#a99fd8] hover:text-[#6c5dd3] font-medium transition-colors">
              {editing ? 'Close' : 'Edit'}
            </button>
            <span className="text-[#c4bae8]">|</span>
            <DeleteIncidentButton incidentId={incident.id} deleteAction={deleteAction} />
          </div>
        </div>

        {/* Description */}
        <p className="mt-3 text-sm leading-relaxed" style={{ color: '#1e1550' }}>{incident.description}</p>

        {/* Impact summary */}
        {(incident.records_affected || incident.users_affected || incident.impact_scope) && (
          <div className="flex items-center gap-3 mt-2 text-[11px]" style={{ color: '#4a4270' }}>
            {incident.impact_scope && incident.impact_scope !== 'none' && (
              <span>Impact: <span className="font-semibold">{incident.impact_scope}</span></span>
            )}
            {incident.records_affected != null && incident.records_affected > 0 && (
              <span>{incident.records_affected.toLocaleString()} records</span>
            )}
            {incident.users_affected != null && incident.users_affected > 0 && (
              <span>{incident.users_affected.toLocaleString()} users</span>
            )}
          </div>
        )}

        {/* Response timeline mini */}
        {(incident.detected_at || incident.reported_by_vendor_at || incident.contained_at || incident.resolved_at) && (
          <div className="flex items-center gap-4 mt-3 text-[10px] flex-wrap" style={{ color: '#8b7fd4' }}>
            {incident.detected_at && <span>Detected: <span className="font-medium">{new Date(incident.detected_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></span>}
            {incident.reported_by_vendor_at && <span>Reported: <span className="font-medium">{new Date(incident.reported_by_vendor_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></span>}
            {incident.contained_at && <span>Contained: <span className="font-medium">{new Date(incident.contained_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></span>}
            {incident.resolved_at && <span>Resolved: <span className="font-medium">{new Date(incident.resolved_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></span>}
          </div>
        )}

        {/* Root cause */}
        {incident.root_cause && (
          <div className="mt-2 text-xs" style={{ color: '#4a4270' }}>
            Root cause: <span className="font-medium">{incident.root_cause.replace(/_/g, ' ')}</span>
            {incident.root_cause_detail && <span> — {incident.root_cause_detail}</span>}
          </div>
        )}

        {/* Corrective action */}
        {incident.corrective_action && (
          <div className="mt-2 text-xs border-l-2 pl-3" style={{ color: '#4a4270', borderColor: incident.corrective_verified ? '#059669' : 'rgba(109,93,211,0.15)' }}>
            <span className="font-semibold">Corrective action:</span> {incident.corrective_action}
            {incident.corrective_verified && <span style={{ color: '#059669' }}> ✓ Verified</span>}
          </div>
        )}

        {incident.notes && (
          <p className="mt-2 text-xs leading-relaxed border-l-2 pl-3 italic" style={{ color: '#4a4270', borderColor: 'rgba(109,93,211,0.15)' }}>
            {incident.notes}
          </p>
        )}

        {/* Lifecycle timeline */}
        <IncidentLifecycle status={incident.status} />

        {/* Linked remediation */}
        {incident.created_remediation_id && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#e11d48' }} />
            <span style={{ color: '#4a4270' }}>Remediation auto-created</span>
            <a href={`/issues/${incident.created_remediation_id}`} className="font-medium hover:underline" style={{ color: '#6c5dd3' }}>View →</a>
          </div>
        )}

        <p className="mt-3 text-xs" style={{ color: '#a99fd8' }}>
          Logged {new Date(incident.created_at).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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

  const active = incidents.filter((i) => i.status === 'detected' || i.status === 'investigating' || i.status === 'contained')
  const resolved = incidents.filter((i) => i.status === 'resolved' || i.status === 'closed')

  // Recurrence counts: for each incident, count how many OTHER incidents of the same type exist
  const recurrenceMap = new Map<string, number>()
  incidents.forEach((inc) => {
    if (!inc.incident_type) return
    const count = incidents.filter((other) => other.id !== inc.id && other.incident_type === inc.incident_type).length
    recurrenceMap.set(inc.id, count)
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: '#1e1550' }}>Incidents</h3>
          <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>
            {active.length} active · {resolved.length} resolved
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

      {/* Active incidents */}
      {active.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#e11d48' }}>Active ({active.length})</h4>
          {active.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              recurrenceCount={recurrenceMap.get(incident.id) ?? 0}
              updateAction={updateIncidentAction}
              deleteAction={deleteIncidentAction}
            />
          ))}
        </section>
      )}

      {/* Resolved / Closed incidents */}
      {resolved.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#059669' }}>Resolved / Closed ({resolved.length})</h4>
          {resolved.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              recurrenceCount={recurrenceMap.get(incident.id) ?? 0}
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

// ─── Incident lifecycle timeline ────────────────────────────────────────────

const LIFECYCLE_STEPS = [
  { key: 'detected',      label: 'Detected' },
  { key: 'investigating', label: 'Investigating' },
  { key: 'contained',     label: 'Contained' },
  { key: 'resolved',      label: 'Resolved' },
  { key: 'closed',        label: 'Closed' },
]

function IncidentLifecycle({ status }: { status: IncidentStatus }) {
  const currentIdx = LIFECYCLE_STEPS.findIndex((s) => s.key === status)
  return (
    <div className="flex items-center mt-3 mb-1">
      {LIFECYCLE_STEPS.map((step, i) => {
        const isDone = i < currentIdx
        const isCurrent = i === currentIdx
        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold"
                style={
                  isDone
                    ? { background: '#059669', color: 'white' }
                    : isCurrent
                    ? { background: '#6c5dd3', color: 'white', boxShadow: '0 0 0 2px rgba(108,93,211,0.2)' }
                    : { background: 'rgba(148,163,184,0.15)', color: '#94a3b8' }
                }
              >
                {isDone ? '✓' : i + 1}
              </span>
              <span className="text-[8px] mt-0.5 font-medium" style={{ color: isDone ? '#059669' : isCurrent ? '#6c5dd3' : '#a99fd8' }}>
                {step.label}
              </span>
            </div>
            {i < LIFECYCLE_STEPS.length - 1 && (
              <div className="flex-1 mx-1 h-px" style={{ background: isDone ? '#059669' : 'rgba(148,163,184,0.2)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
