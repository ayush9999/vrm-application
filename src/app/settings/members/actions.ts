'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireCurrentUser } from '@/lib/current-user'
import { createInvite, revokeInvite } from '@/lib/db/invites'
import type { FormState } from '@/types/common'
import type { OrgRole } from '@/types/org'

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  role: z.enum(['site_admin', 'vendor_admin']),
})

export async function createInviteAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireCurrentUser()
  if (user.role !== 'site_admin') {
    return { message: 'Only owners can invite teammates.' }
  }

  const raw = {
    email: formData.get('email') as string,
    role: (formData.get('role') as string) || 'vendor_admin',
  }
  const parsed = inviteSchema.safeParse(raw)
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  try {
    await createInvite({
      orgId: user.orgId,
      email: parsed.data.email,
      role: parsed.data.role as OrgRole,
      invitedByUserId: user.userId,
    })
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to create invite' }
  }

  revalidatePath('/settings/members')
  return { success: true }
}

export async function revokeInviteAction(inviteId: string): Promise<{ message?: string }> {
  const user = await requireCurrentUser()
  if (user.role !== 'site_admin') {
    return { message: 'Only owners can revoke invites.' }
  }

  try {
    await revokeInvite(inviteId)
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to revoke invite' }
  }

  revalidatePath('/settings/members')
  return {}
}
