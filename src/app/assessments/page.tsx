import Link from 'next/link'
import { requireCurrentUser } from '@/lib/current-user'
import { getAssessments } from '@/lib/db/assessments'
import { DeleteAssessmentButton } from './[id]/_components/DeleteAssessmentButton'
import { deleteAssessmentAction } from './actions'
import type { AssessmentStatus, AssessmentRiskLevel } from '@/types/assessment'

const STATUS_BADGE: Record<AssessmentStatus, { label: string; color: string; bg: string }> = {
  draft:                { label: 'Draft',        color: '#71717a', bg: 'rgba(113,113,122,0.08)' },
  in_review:            { label: 'In Review',    color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
  pending_ai_review:    { label: 'AI Review',    color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)' },
  pending_human_review: { label: 'Human Review', color: '#d97706', bg: 'rgba(217,119,6,0.08)' },
  submitted:            { label: 'Submitted',    color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
  completed:            { label: 'Completed',    color: '#059669', bg: 'rgba(5,150,105,0.08)' },
  archived:             { label: 'Archived',     color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
}

const RISK_BADGE: Record<AssessmentRiskLevel, { label: string; color: string }> = {
  critical:      { label: 'Critical', color: '#e11d48' },
  high:          { label: 'High',     color: '#dc2626' },
  medium:        { label: 'Medium',   color: '#d97706' },
  low:           { label: 'Low',      color: '#059669' },
  informational: { label: 'Info',     color: '#0ea5e9' },
}

export default async function AssessmentsPage() {
  const user = await requireCurrentUser()
  const assessments = await getAssessments(user.orgId)

  const active = assessments.filter(a => !['archived', 'completed'].includes(a.status))
  const completed = assessments.filter(a => ['completed', 'archived'].includes(a.status))

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>Risk Assessments</h1>
          <p className="text-sm mt-0.5" style={{ color: '#a99fd8' }}>
            Holistic vendor risk assessments across your organization
          </p>
        </div>
        <Link
          href="/assessments/new"
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 4px 12px rgba(108,93,211,0.3)' }}
        >
          + New Assessment
        </Link>
      </div>

      {/* Stats + counts inline bar */}
      {assessments.length > 0 && (
        <div
          className="flex items-center gap-5 px-5 py-3 rounded-2xl"
          style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.07)' }}
        >
          {[
            { label: 'Total',     value: assessments.length, color: '#6c5dd3' },
            { label: 'Active',    value: active.length,      color: '#6c5dd3' },
            { label: 'High Risk', value: assessments.filter(a => a.risk_level === 'high' || a.risk_level === 'critical').length, color: '#e11d48' },
            { label: 'Completed', value: completed.length,   color: '#059669' },
          ].map(s => (
            <div key={s.label} className="text-center min-w-[52px]">
              <p className="text-lg font-bold leading-tight" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#a99fd8' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {assessments.length === 0 ? (
        <div
          className="text-center py-20 rounded-2xl bg-white"
          style={{ border: '1.5px dashed rgba(109,93,211,0.2)' }}
        >
          <p className="font-semibold text-sm" style={{ color: '#1e1550' }}>No risk assessments yet</p>
          <p className="text-xs mt-1 mb-5" style={{ color: '#a99fd8' }}>
            Start your first assessment to evaluate vendors holistically.
          </p>
          <Link
            href="/assessments/new"
            className="inline-flex items-center px-5 py-2 rounded-full text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
          >
            + New Assessment
          </Link>
        </div>
      ) : (
        <>
          <AssessmentTable assessments={active} title="Active" />
          {completed.length > 0 && (
            <AssessmentTable assessments={completed} title="Completed & Archived" muted />
          )}
        </>
      )}
    </div>
  )
}

function AssessmentTable({
  assessments,
  title,
  muted = false,
}: {
  assessments: Awaited<ReturnType<typeof getAssessments>>
  title: string
  muted?: boolean
}) {
  if (assessments.length === 0) return null
  return (
    <div>
      <h2
        className="text-[10px] font-semibold uppercase tracking-widest mb-2"
        style={{ color: muted ? '#c4bae8' : '#a99fd8' }}
      >
        {title}
      </h2>
      <div
        className="rounded-2xl overflow-hidden bg-white"
        style={{ boxShadow: '0 2px 8px rgba(109,93,211,0.07)', border: '1px solid rgba(109,93,211,0.1)' }}
      >
        {/* Column header */}
        <div
          className="grid items-center px-4 py-2 text-[10px] font-semibold uppercase tracking-widest"
          style={{
            gridTemplateColumns: '1fr 100px 80px 70px 50px 56px 80px',
            background: 'rgba(109,93,211,0.03)',
            borderBottom: '1px solid rgba(109,93,211,0.06)',
            color: '#a99fd8',
          }}
        >
          <span>Assessment</span>
          <span>Vendor</span>
          <span>Status</span>
          <span>Risk</span>
          <span>Score</span>
          <span>Period</span>
          <span />
        </div>

        {/* Rows */}
        {assessments.map((a, idx) => {
          const statusBadge = STATUS_BADGE[a.status]
          const riskBadge = a.risk_level ? RISK_BADGE[a.risk_level] : null
          const dateStr = a.period_start
            ? new Date(a.period_start).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
            : new Date(a.created_at).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })

          return (
            <Link
              key={a.id}
              href={`/assessments/${a.id}`}
              className="grid items-center px-4 py-2.5 transition-colors hover:bg-[rgba(109,93,211,0.02)] group"
              style={{
                gridTemplateColumns: '1fr 100px 80px 70px 50px 56px 80px',
                borderBottom: idx < assessments.length - 1 ? '1px solid rgba(109,93,211,0.05)' : undefined,
              }}
            >
              {/* Assessment: code + title */}
              <div className="flex items-center gap-2 min-w-0">
                {a.assessment_code && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono shrink-0"
                    style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3' }}
                  >
                    {a.assessment_code}
                  </span>
                )}
                <span
                  className="text-[13px] font-medium truncate"
                  style={{ color: '#1e1550' }}
                  title={a.title ?? 'Untitled Assessment'}
                >
                  {a.title ?? 'Untitled Assessment'}
                </span>
                {a.frameworks?.length > 0 && (
                  <span className="text-[10px] shrink-0" style={{ color: '#a99fd8' }}>
                    {a.frameworks.length} fw
                  </span>
                )}
              </div>

              {/* Vendor */}
              <span className="text-[11px] truncate" style={{ color: '#6b5fa8' }}>
                {a.vendor?.name ?? '—'}
              </span>

              {/* Status */}
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded inline-flex w-fit"
                style={{ background: statusBadge.bg, color: statusBadge.color }}
              >
                {statusBadge.label}
              </span>

              {/* Risk */}
              <span className="text-[11px] font-medium" style={{ color: riskBadge?.color ?? '#c4bae8' }}>
                {riskBadge?.label ?? '—'}
              </span>

              {/* Score */}
              <span className="text-[11px] font-medium" style={{ color: '#6b5fa8' }}>
                {a.overall_score !== null && a.overall_score !== undefined ? `${a.overall_score}%` : '—'}
              </span>

              {/* Period */}
              <span className="text-[11px]" style={{ color: '#a99fd8' }}>
                {dateStr}
              </span>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[11px] font-medium" style={{ color: '#6c5dd3' }}>
                  Open →
                </span>
                <DeleteAssessmentButton
                  assessmentId={a.id}
                  assessmentTitle={a.title ?? 'Untitled Assessment'}
                  deleteAction={deleteAssessmentAction}
                />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
