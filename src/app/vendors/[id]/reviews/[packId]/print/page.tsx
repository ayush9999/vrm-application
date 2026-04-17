import { notFound } from 'next/navigation'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendorById } from '@/lib/db/vendors'
import { getVendorReviewItems } from '@/lib/db/review-packs'
import { createServerClient } from '@/lib/supabase/server'
import type { VendorReviewItem } from '@/types/review-pack'

interface PageProps {
  params: Promise<{ id: string; packId: string }>
  searchParams: Promise<{ include?: string | string[] }>
}

const DECISION_LABEL: Record<string, { label: string; color: string }> = {
  not_started: { label: 'Pending', color: '#94a3b8' },
  pass: { label: 'PASS', color: '#059669' },
  fail: { label: 'FAIL', color: '#e11d48' },
  na: { label: 'N/A', color: '#64748b' },
  needs_follow_up: { label: 'FOLLOW-UP', color: '#d97706' },
  exception_approved: { label: 'EXCEPTION', color: '#7c3aed' },
}

export default async function PrintReviewPage({ params, searchParams }: PageProps) {
  const { id: vendorId, packId } = await params
  const sp = await searchParams
  const user = await requireCurrentUser()

  const vendor = await getVendorById(user.orgId, vendorId)
  if (!vendor) notFound()

  const supabase = await createServerClient()
  const { data: vrp } = await supabase
    .from('vendor_review_packs')
    .select(`
      *, review_packs!inner ( name, code, description )
    `)
    .eq('id', packId)
    .eq('vendor_id', vendorId)
    .maybeSingle()
  if (!vrp) notFound()

  const items = await getVendorReviewItems(packId)

  const raw = vrp as unknown as {
    status: string; completed_at: string | null; review_type: string
    review_packs: { name: string; code: string | null; description: string | null } | { name: string; code: string | null; description: string | null }[]
  }
  const rp = Array.isArray(raw.review_packs) ? raw.review_packs[0] : raw.review_packs

  // Determine which sections to show
  const includeParam = sp.include
  const includes = new Set(
    Array.isArray(includeParam) ? includeParam : includeParam ? [includeParam] : ['items', 'compliance', 'comments'],
  )

  const applicable = items.filter((i) => i.decision !== 'na').length
  const passed = items.filter((i) => i.decision === 'pass' || i.decision === 'exception_approved').length
  const pct = applicable > 0 ? Math.round((passed / applicable) * 100) : 0

  // Fetch approvals if requested
  let approvals: Array<{ level: number; decision: string; comment: string | null; decided_at: string; user_name: string }> = []
  if (includes.has('approvals')) {
    const { data } = await supabase
      .from('review_approvals')
      .select('level, decision, comment, decided_at, users!inner(name, email)')
      .eq('vendor_review_pack_id', packId)
      .order('decided_at')
    approvals = ((data ?? []) as unknown as Array<{
      level: number; decision: string; comment: string | null; decided_at: string
      users: { name: string | null; email: string | null } | { name: string | null; email: string | null }[]
    }>).map((a) => {
      const u = Array.isArray(a.users) ? a.users[0] : a.users
      return { ...a, user_name: u?.name ?? u?.email ?? 'Unknown' }
    })
  }

  return (
    <html lang="en">
      <head>
        <title>Review — {vendor.name} — {rp?.name}</title>
        <style>{`
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
          }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 24px; color: #1e1550; font-size: 12px; line-height: 1.5; }
          h1 { font-size: 20px; margin: 0 0 4px; }
          h2 { font-size: 14px; margin: 20px 0 8px; color: #6c5dd3; text-transform: uppercase; letter-spacing: 1px; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          th { text-align: left; padding: 6px 8px; background: #f8f7fc; color: #6c5dd3; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e2f0; }
          td { padding: 6px 8px; border-bottom: 1px solid #f0eef5; vertical-align: top; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
          .meta { color: #8b7fd4; font-size: 11px; }
          .ref { display: inline-block; padding: 1px 6px; margin: 1px 2px; border-radius: 3px; background: #f0eef5; color: #6c5dd3; font-family: monospace; font-size: 10px; }
          .summary-grid { display: flex; gap: 24px; margin: 12px 0; }
          .summary-item { text-align: center; }
          .summary-value { font-size: 24px; font-weight: 700; }
          .summary-label { font-size: 10px; color: #8b7fd4; text-transform: uppercase; letter-spacing: 0.5px; }
          .print-btn { position: fixed; top: 16px; right: 16px; background: #6c5dd3; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; z-index: 100; }
        `}</style>
      </head>
      <body>
        <button className="print-btn no-print" onClick="window.print()">🖨 Print / Save PDF</button>

        {/* Header */}
        <div style={{ borderBottom: '2px solid #6c5dd3', paddingBottom: 12, marginBottom: 16 }}>
          <h1>{rp?.name}</h1>
          <div className="meta">
            Vendor: <strong>{vendor.name}</strong> ({vendor.vendor_code ?? '—'})
            {' · '}Status: <strong>{raw.status.replace(/_/g, ' ')}</strong>
            {' · '}Type: <strong>{raw.review_type}</strong>
            {raw.completed_at && <>{' · '}Completed: {new Date(raw.completed_at).toLocaleDateString()}</>}
          </div>
          {rp?.description && <div className="meta" style={{ marginTop: 4 }}>{rp.description}</div>}
        </div>

        {/* Summary */}
        <div className="summary-grid">
          <div className="summary-item">
            <div className="summary-value" style={{ color: pct === 100 ? '#059669' : '#6c5dd3' }}>{pct}%</div>
            <div className="summary-label">Readiness</div>
          </div>
          <div className="summary-item">
            <div className="summary-value">{items.length}</div>
            <div className="summary-label">Total Items</div>
          </div>
          <div className="summary-item">
            <div className="summary-value" style={{ color: '#059669' }}>{passed}</div>
            <div className="summary-label">Passed</div>
          </div>
          <div className="summary-item">
            <div className="summary-value" style={{ color: '#e11d48' }}>{items.filter((i) => i.decision === 'fail').length}</div>
            <div className="summary-label">Failed</div>
          </div>
        </div>

        {/* Review items */}
        {includes.has('items') && (
          <>
            <h2>Review Items</h2>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Requirement</th>
                  <th>Decision</th>
                  {includes.has('comments') && <th>Comment</th>}
                  {includes.has('compliance') && <th>Compliance Refs</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const dec = DECISION_LABEL[item.decision] ?? { label: item.decision, color: '#94a3b8' }
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.requirement_name}</strong>
                        {item.requirement_description && (
                          <div className="meta">{item.requirement_description}</div>
                        )}
                      </td>
                      <td>
                        <span className="badge" style={{ background: `${dec.color}18`, color: dec.color }}>
                          {dec.label}
                        </span>
                      </td>
                      {includes.has('comments') && (
                        <td className="meta">{item.reviewer_comment ?? '—'}</td>
                      )}
                      {includes.has('compliance') && (
                        <td>
                          {item.compliance_references?.map((ref, i) => (
                            <span key={i} className="ref">{ref.standard} {ref.reference}</span>
                          ))}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}

        {/* Approval chain */}
        {includes.has('approvals') && approvals.length > 0 && (
          <>
            <h2>Approval History</h2>
            <table>
              <thead>
                <tr>
                  <th>Level</th>
                  <th>User</th>
                  <th>Decision</th>
                  <th>Comment</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {approvals.map((a, i) => (
                  <tr key={i}>
                    <td>Step {a.level}</td>
                    <td>{a.user_name}</td>
                    <td>
                      <span className="badge" style={{ background: '#f0eef5', color: '#6c5dd3' }}>
                        {a.decision.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="meta">{a.comment ?? '—'}</td>
                    <td className="meta">{new Date(a.decided_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Footer */}
        <div style={{ marginTop: 32, paddingTop: 12, borderTop: '1px solid #e5e2f0', color: '#a99fd8', fontSize: 10 }}>
          Exported from VRM · {new Date().toLocaleString()} · Confidential
        </div>
      </body>
    </html>
  )
}
