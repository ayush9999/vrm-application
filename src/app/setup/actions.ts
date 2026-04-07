'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { setupOrganization } from '@/lib/db/organizations'
import type { FormState } from '@/types/common'

const setupSchema = z.object({
  org_name: z.string().min(2, 'Organisation name must be at least 2 characters'),
  admin_name: z.string().min(1, 'Your name is required'),
  admin_email: z.string().email('Valid email required'),
})

export async function setupOrgAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = {
    org_name: formData.get('org_name') as string,
    admin_name: formData.get('admin_name') as string,
    admin_email: formData.get('admin_email') as string,
  }

  const parsed = setupSchema.safeParse(raw)
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  let orgId: string
  let userId: string

  try {
    const result = await setupOrganization(
      parsed.data.org_name,
      parsed.data.admin_name,
      parsed.data.admin_email,
    )
    orgId = result.orgId
    userId = result.userId
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Setup failed. Please try again.' }
  }

  // Persist org and user context in cookies (dev-mode resolver)
  // TODO: Replace with real session/JWT once authentication is implemented
  const cookieStore = await cookies()
  cookieStore.set('org_id', orgId, { httpOnly: true, path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })
  cookieStore.set('user_id', userId, { httpOnly: true, path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })

  redirect('/vendors')
}
