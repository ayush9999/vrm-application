'use server'

import { requireCurrentUser } from '@/lib/current-user'
import { createServerClient } from '@/lib/supabase/server'
import type { ReviewItemDecision } from '@/types/review-pack'

export interface CompareItem {
  requirement_name: string
  requirement_id: string
  olderDecision: ReviewItemDecision
  olderComment: string | null
  newerDecision: ReviewItemDecision
  newerComment: string | null
  changeType: 'improved' | 'regressed' | 'changed' | 'unchanged'
}

export interface CompareResult {
  olderPct: number
  newerPct: number
  deltaPct: number
  items: CompareItem[]
}

const POSITIVE: ReviewItemDecision[] = ['pass', 'exception_approved']

export async function loadComparisonAction(
  olderVrpId: string,
  newerVrpId: string,
): Promise<{ result?: CompareResult; message?: string }> {
  try {
    await requireCurrentUser()
    const supabase = await createServerClient()

    const [olderRes, newerRes] = await Promise.all([
      supabase
        .from('vendor_review_items')
        .select(`
          review_requirement_id, decision, reviewer_comment,
          review_requirements!inner ( name )
        `)
        .eq('vendor_review_pack_id', olderVrpId),
      supabase
        .from('vendor_review_items')
        .select('review_requirement_id, decision, reviewer_comment')
        .eq('vendor_review_pack_id', newerVrpId),
    ])

    if (olderRes.error) throw new Error(olderRes.error.message)
    if (newerRes.error) throw new Error(newerRes.error.message)

    type OlderRow = {
      review_requirement_id: string
      decision: ReviewItemDecision
      reviewer_comment: string | null
      review_requirements: { name: string } | { name: string }[] | null
    }
    type NewerRow = {
      review_requirement_id: string
      decision: ReviewItemDecision
      reviewer_comment: string | null
    }

    const olderMap = new Map<string, OlderRow>()
    for (const r of (olderRes.data ?? []) as unknown as OlderRow[]) {
      olderMap.set(r.review_requirement_id, r)
    }
    const newerMap = new Map<string, NewerRow>()
    for (const r of (newerRes.data ?? []) as unknown as NewerRow[]) {
      newerMap.set(r.review_requirement_id, r)
    }

    // Build comparison items
    const allReqIds = new Set([...olderMap.keys(), ...newerMap.keys()])
    const items: CompareItem[] = []
    let olderPassed = 0, olderApplicable = 0, newerPassed = 0, newerApplicable = 0

    for (const reqId of allReqIds) {
      const older = olderMap.get(reqId)
      const newer = newerMap.get(reqId)
      const oDecision = older?.decision ?? 'not_started'
      const nDecision = newer?.decision ?? 'not_started'

      const reqRaw = older?.review_requirements
      const reqObj = Array.isArray(reqRaw) ? reqRaw[0] : reqRaw

      if (oDecision !== 'na') {
        olderApplicable++
        if (POSITIVE.includes(oDecision)) olderPassed++
      }
      if (nDecision !== 'na') {
        newerApplicable++
        if (POSITIVE.includes(nDecision)) newerPassed++
      }

      let changeType: CompareItem['changeType'] = 'unchanged'
      if (oDecision === nDecision) changeType = 'unchanged'
      else if (!POSITIVE.includes(oDecision) && POSITIVE.includes(nDecision)) changeType = 'improved'
      else if (POSITIVE.includes(oDecision) && !POSITIVE.includes(nDecision)) changeType = 'regressed'
      else changeType = 'changed'

      items.push({
        requirement_name: reqObj?.name ?? 'Unknown item',
        requirement_id: reqId,
        olderDecision: oDecision,
        olderComment: older?.reviewer_comment ?? null,
        newerDecision: nDecision,
        newerComment: newer?.reviewer_comment ?? null,
        changeType,
      })
    }

    const olderPct = olderApplicable > 0 ? Math.round((olderPassed / olderApplicable) * 100) : 0
    const newerPct = newerApplicable > 0 ? Math.round((newerPassed / newerApplicable) * 100) : 0

    return { result: { olderPct, newerPct, deltaPct: newerPct - olderPct, items } }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to load comparison' }
  }
}
