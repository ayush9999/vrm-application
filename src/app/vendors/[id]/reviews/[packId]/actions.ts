'use server'

import { revalidatePath } from 'next/cache'
import { requireCurrentUser } from '@/lib/current-user'
import { updateReviewItemDecision } from '@/lib/db/review-packs'
import type { ReviewItemDecision } from '@/types/review-pack'

export async function setReviewItemDecisionAction(
  vendorId: string,
  packId: string,
  itemId: string,
  decision: ReviewItemDecision,
  comment: string | null,
): Promise<{ message?: string; success?: boolean }> {
  try {
    const user = await requireCurrentUser()
    await updateReviewItemDecision(itemId, decision, comment, user.userId)
    revalidatePath(`/vendors/${vendorId}/reviews/${packId}`)
    revalidatePath(`/vendors/${vendorId}`)
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to update review item' }
  }
}

/**
 * AI Assist placeholder — returns a fake suggestion.
 * Real implementation will read uploaded evidence files and call an LLM.
 */
export async function aiAssistReviewItemAction(
  _itemId: string,
): Promise<{ suggestion?: ReviewItemDecision; rationale?: string; message?: string }> {
  await requireCurrentUser()
  // Simulate brief processing
  await new Promise((r) => setTimeout(r, 600))
  return {
    suggestion: 'pass',
    rationale: 'AI Assist is a placeholder. Real implementation will analyze uploaded evidence files and propose a Pass/Fail with citations from the document.',
  }
}
