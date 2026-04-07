'use server'

import { revalidatePath } from 'next/cache'
import { requireCurrentUser } from '@/lib/current-user'
import { saveOrgFrameworkSelections } from '@/lib/db/organizations'
import type { FormState } from '@/types/common'

export async function saveOrgFrameworksAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireCurrentUser()

  const frameworkIds = formData.getAll('framework_ids') as string[]

  try {
    await saveOrgFrameworkSelections(user.orgId, frameworkIds)
    revalidatePath('/settings/frameworks')
    revalidatePath('/vendors')
    revalidatePath('/assessments/new')
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to save settings' }
  }
}
