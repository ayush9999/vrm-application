'use server'

import { revalidatePath } from 'next/cache'
import { requireCurrentUser } from '@/lib/current-user'
import { setReminderRules, type ReminderRules } from '@/lib/db/org-settings'

export async function setReminderRulesAction(
  rules: ReminderRules,
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    if (user.role !== 'site_admin') return { message: 'Only site admins can update reminder rules.' }
    await setReminderRules(user.orgId, rules)
    revalidatePath('/settings/reminders')
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to save' }
  }
}
