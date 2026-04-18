import sql from '@/lib/db/pool'
import { createServiceClient } from '@/lib/supabase/service'
import { getVendorListMetrics } from '@/lib/db/review-packs'
import type { VendorApprovalStatus } from '@/types/review-pack'
import type { RiskBand } from '@/lib/risk-score'

export type SnapshotTrigger = 'approval_change' | 'manual' | 'pack_completed' | 'cron'

export interface ReadinessSnapshot {
  id: string
  org_id: string
  vendor_id: string
  readiness_pct: number
  applicable: number
  completed: number
  risk_band: RiskBand
  risk_score: number
  approval_status: VendorApprovalStatus
  open_remediations: number
  missing_evidence: number
  trigger: SnapshotTrigger
  trigger_user_id: string | null
  notes: string | null
  created_at: string
}

/**
 * Compute current metrics and persist a snapshot for a vendor.
 * Uses service client so it works from background contexts (auto-snapshot
 * on approval change runs in a server action where the user is known anyway,
 * but using service avoids RLS pitfalls when chaining inserts after writes).
 */
export async function captureReadinessSnapshot(params: {
  orgId: string
  vendorId: string
  approvalStatus: VendorApprovalStatus
  trigger: SnapshotTrigger
  triggerUserId?: string | null
  notes?: string | null
}): Promise<ReadinessSnapshot | null> {
  const metricsMap = await getVendorListMetrics([
    { id: params.vendorId, approval_status: params.approvalStatus },
  ])
  const m = metricsMap.get(params.vendorId)
  if (!m) return null

  const service = createServiceClient()
  const { data, error } = await service
    .from('vendor_readiness_snapshots')
    .insert({
      org_id: params.orgId,
      vendor_id: params.vendorId,
      readiness_pct: m.readinessPct,
      applicable: m.applicable,
      completed: m.completed,
      risk_band: m.risk.band,
      risk_score: m.risk.score,
      approval_status: params.approvalStatus,
      open_remediations: m.openRemediationCount,
      missing_evidence: m.missingEvidenceCount,
      trigger: params.trigger,
      trigger_user_id: params.triggerUserId ?? null,
      notes: params.notes ?? null,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as ReadinessSnapshot
}

/** Fetch all snapshots for a vendor in chronological order. */
export async function getVendorSnapshots(vendorId: string): Promise<ReadinessSnapshot[]> {
  const rows = await sql<ReadinessSnapshot[]>`
    SELECT *
    FROM vendor_readiness_snapshots
    WHERE vendor_id = ${vendorId}
    ORDER BY created_at ASC
  `
  return rows as ReadinessSnapshot[]
}
