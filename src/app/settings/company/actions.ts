'use server'

import { revalidatePath } from 'next/cache'
import { requireCurrentUser } from '@/lib/current-user'
import { updateCompanyProfile, setComplianceStandards } from '@/lib/db/org-settings'

export async function updateCompanyProfileAction(
  patch: {
    company_type?: string | null
    industry?: string | null
    operating_countries?: string[]
    default_review_cadence?: string | null
    esg_enabled?: boolean
  },
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    if (user.role !== 'site_admin') return { message: 'Only site admins can update company profile.' }
    await updateCompanyProfile(user.orgId, patch)
    revalidatePath('/settings/company')
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to update profile' }
  }
}

export async function updateComplianceStandardsAction(
  standards: string[],
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    if (user.role !== 'site_admin') return { message: 'Only site admins can update compliance standards.' }
    await setComplianceStandards(user.orgId, standards)
    revalidatePath('/settings/company')
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to update standards' }
  }
}
