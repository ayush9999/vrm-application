'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity } from '@/lib/db/activity-log'
import { initOrgDefaults } from '@/lib/db/organizations'
import { acceptInvite, getInviteByToken } from '@/lib/db/invites'
import type { FormState } from '@/types/common'

// ─── Schemas ───────────────────────────────────────────────────────────────────

const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email')
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')

const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  org_name: z.string().trim().min(2, 'Organisation name must be at least 2 characters').max(120),
  full_name: z.string().trim().min(1, 'Your name is required').max(120),
})

const signUpWithInviteSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: z.string().trim().min(1, 'Your name is required').max(120),
  invite_token: z.string().min(8),
})

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

const magicLinkSchema = z.object({
  email: emailSchema,
})

const forgotPasswordSchema = z.object({
  email: emailSchema,
})

const resetPasswordSchema = z.object({
  password: passwordSchema,
})

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the canonical site URL from the current request, used for auth callbacks. */
async function getSiteUrl(): Promise<string> {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  return `${proto}://${host}`
}

// ─── Sign up (email + password) ────────────────────────────────────────────────

/**
 * Creates a pending auth.users row and sends a confirmation email.
 * The org / public.users / org_memberships rows are created later in
 * /auth/callback after the user confirms their email — this prevents
 * unconfirmed signups from creating empty orgs.
 *
 * The org_name and full_name are stored in user_metadata so /auth/callback
 * can read them after confirmation.
 */
export async function signUpAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    org_name: formData.get('org_name') as string,
    full_name: formData.get('full_name') as string,
  }
  const parsed = signUpSchema.safeParse(raw)
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createServerClient()
  const siteUrl = await getSiteUrl()

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      data: {
        org_name: parsed.data.org_name,
        full_name: parsed.data.full_name,
      },
    },
  })

  if (error) {
    return { message: error.message }
  }

  // If email confirmation is enabled, user.identities will be empty until confirmed.
  // If confirmation is disabled, the session is returned immediately.
  if (data.session) {
    // Email confirmation is OFF in Supabase settings — provision the org now.
    await provisionUserOrg({
      authUserId: data.user!.id,
      email: parsed.data.email,
      orgName: parsed.data.org_name,
      fullName: parsed.data.full_name,
    })
    redirect('/')
  }

  // Email confirmation is ON — show "check your email" state on the form.
  return {
    success: true,
    message: 'Check your email for a confirmation link to complete sign-up.',
  }
}

// ─── Sign in (email + password) ────────────────────────────────────────────────

export async function signInAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }
  const parsed = signInSchema.safeParse(raw)
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { message: error.message }
  }

  redirect('/')
}

// ─── Magic link ────────────────────────────────────────────────────────────────

export async function magicLinkAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = { email: formData.get('email') as string }
  const parsed = magicLinkSchema.safeParse(raw)
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createServerClient()
  const siteUrl = await getSiteUrl()

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      // shouldCreateUser=false means a magic link CANNOT create a new account
      // — only existing users (or invited users) can use this flow.
      shouldCreateUser: false,
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  })

  if (error) {
    return { message: error.message }
  }

  return {
    success: true,
    message: 'Check your email for a sign-in link.',
  }
}

// ─── Forgot password ───────────────────────────────────────────────────────────

export async function forgotPasswordAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = { email: formData.get('email') as string }
  const parsed = forgotPasswordSchema.safeParse(raw)
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createServerClient()
  const siteUrl = await getSiteUrl()

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/reset-password`,
  })

  if (error) {
    return { message: error.message }
  }

  return {
    success: true,
    message: 'If that email is registered, a password reset link has been sent.',
  }
}

// ─── Reset password ────────────────────────────────────────────────────────────

export async function resetPasswordAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = { password: formData.get('password') as string }
  const parsed = resetPasswordSchema.safeParse(raw)
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createServerClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error) {
    return { message: error.message }
  }

  redirect('/')
}

// ─── Sign out ──────────────────────────────────────────────────────────────────

export async function signOutAction(): Promise<void> {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  redirect('/sign-in')
}

// ─── Org provisioning (called from sign-up callback) ──────────────────────────

interface ProvisionParams {
  authUserId: string
  email: string
  orgName: string
  fullName: string
}

/**
 * Atomically provisions a fresh user's org context after email confirmation:
 *   1. Creates the organization
 *   2. Creates a public.users row with id = authUserId (links app user → auth user)
 *   3. Creates an org_memberships row with role=site_admin (owner)
 *   4. Seeds default doc types, vendor categories, and category-doc mappings
 *
 * Uses the SERVICE client because:
 *   - org/user/membership inserts must succeed regardless of RLS
 *   - this is the first time the user exists, so no session-bound queries can work yet
 *
 * Idempotent: if a public.users row with this id already exists (e.g. retry after
 * partial failure), the function returns early without error.
 */
export async function provisionUserOrg(params: ProvisionParams): Promise<{ orgId: string; userId: string }> {
  const service = createServiceClient()

  // Idempotency check — already provisioned?
  const { data: existing } = await service
    .from('users')
    .select('id, org_id')
    .eq('id', params.authUserId)
    .maybeSingle()
  if (existing) {
    return { orgId: existing.org_id, userId: existing.id }
  }

  // 1. Create organization
  const { data: org, error: orgErr } = await service
    .from('organizations')
    .insert({ name: params.orgName })
    .select('id')
    .single()
  if (orgErr || !org) throw new Error(orgErr?.message ?? 'Failed to create organization')

  // 2. Create public.users row keyed by the auth.users id
  const { error: userErr } = await service.from('users').insert({
    id: params.authUserId,
    org_id: org.id,
    name: params.fullName,
    email: params.email,
  })
  if (userErr) throw new Error(userErr.message)

  // 3. Owner membership
  const { error: membershipErr } = await service.from('org_memberships').insert({
    org_id: org.id,
    user_id: params.authUserId,
    role: 'site_admin',
  })
  if (membershipErr) throw new Error(membershipErr.message)

  // 4. Seed defaults (idempotent inside the helper)
  await initOrgDefaults(org.id)

  // 5. Activity log entry
  try {
    await logActivity({
      orgId: org.id,
      actorUserId: params.authUserId,
      entityType: 'organization',
      entityId: org.id,
      action: 'created',
      title: `Organisation "${params.orgName}" created`,
    })
  } catch {
    // logActivity already swallows errors but be defensive — never fail signup over a log row.
  }

  return { orgId: org.id, userId: params.authUserId }
}

// ─── Sign up via invite (joins existing org instead of creating one) ──────────

/**
 * Sign-up flow when the user clicked an invite link. Validates the invite,
 * creates a pending auth.users row, and stores the invite_token in user_metadata
 * so /auth/callback can call acceptInvite() after email confirmation.
 *
 * The email field is validated against the invite — the user can't change it
 * (the form should lock the field anyway).
 */
export async function signUpWithInviteAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    full_name: formData.get('full_name') as string,
    invite_token: formData.get('invite_token') as string,
  }
  const parsed = signUpWithInviteSchema.safeParse(raw)
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  // Validate invite is still good and matches the email
  const invite = await getInviteByToken(parsed.data.invite_token)
  if (!invite) {
    return { message: 'This invite is no longer valid (expired, revoked, or already accepted).' }
  }
  if (invite.email.toLowerCase() !== parsed.data.email.toLowerCase()) {
    return { message: 'Email does not match the invite.' }
  }

  const supabase = await createServerClient()
  const siteUrl = await getSiteUrl()

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      data: {
        invite_token: parsed.data.invite_token,
        full_name: parsed.data.full_name,
      },
    },
  })

  if (error) {
    return { message: error.message }
  }

  if (data.session) {
    // Email confirmation OFF — accept the invite immediately
    try {
      await acceptInvite({
        token: parsed.data.invite_token,
        authUserId: data.user!.id,
        email: parsed.data.email,
        fullName: parsed.data.full_name,
      })
    } catch (err) {
      return { message: err instanceof Error ? err.message : 'Failed to accept invite' }
    }
    redirect('/')
  }

  return {
    success: true,
    message: 'Check your email for a confirmation link to complete sign-up.',
  }
}

/**
 * Accept an invite for a user who is ALREADY signed in (existing account).
 * Adds an additional org membership without creating a new public.users row.
 */
export async function acceptInviteAction(token: string): Promise<{ message?: string }> {
  const supabase = await createServerClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    return { message: 'You must be signed in to accept an invite.' }
  }

  // Look up the existing public.users row to get the user's name
  const service = createServiceClient()
  const { data: existingUser } = await service
    .from('users')
    .select('name, email')
    .eq('id', authUser.id)
    .maybeSingle()

  if (!existingUser) {
    return { message: 'Your account is incomplete. Please complete signup first.' }
  }

  try {
    await acceptInvite({
      token,
      authUserId: authUser.id,
      email: existingUser.email ?? authUser.email ?? '',
      fullName: existingUser.name ?? '',
    })
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to accept invite' }
  }

  redirect('/')
}
