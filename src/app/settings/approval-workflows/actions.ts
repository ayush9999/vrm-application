'use server'

import { revalidatePath } from 'next/cache'
import { requireCurrentUser } from '@/lib/current-user'
import { setDefaultApprover } from '@/lib/db/org-settings'

export async function setDefaultApproverAction(
  tier: number,
  approverUserId: string | null,
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    if (user.role !== 'site_admin') return { message: 'Only site admins can configure approvers.' }
    await setDefaultApprover(user.orgId, tier, approverUserId)
    revalidatePath('/settings/approval-workflows')
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to update approver' }
  }
}
