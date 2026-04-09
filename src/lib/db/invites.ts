/**
 * invites.ts — DB helpers for org invitations.
 *
 * Two flavours of helper:
 *   - "Org-side" helpers (createInvite, listInvites, revokeInvite) run as the
 *     signed-in user via the cookie-aware client. They respect RLS — only
 *     org members (with the right role) can create or list invites.
 *
 *   - "Public-side" helpers (getInviteByToken, acceptInvite) run via the
 *     service client because the user accepting an invite may not be a
 *     member of the org yet (so RLS would block them).
 */

import { randomBytes } from 'node:crypto'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity } from '@/lib/db/activity-log'
import type { OrgInvite, OrgInviteWithInviter } from '@/types/invite'
import type { OrgRole } from '@/types/org'

const INVITE_VALID_DAYS = 14
const INVITE_TOKEN_BYTES = 24 // → 32 chars when hex-encoded; cryptographically random

function generateToken(): string {
  return randomBytes(INVITE_TOKEN_BYTES).toString('hex')
}

function expiryFromNow(days = INVITE_VALID_DAYS): string {
  return new Date(Date.now() + days * 86_400_000).toISOString()
}

// ─── Org-side: create / list / revoke ─────────────────────────────────────────

export interface CreateInviteInput {
  orgId: string
  email: string
  role: OrgRole
  invitedByUserId: string
}

/**
 * Creates a new invite for an email. Reuses an existing pending invite for the
 * same (org, email) pair instead of creating a duplicate.
 */
export async function createInvite(input: CreateInviteInput): Promise<OrgInvite> {
  const supabase = await createServerClient()
  const email = input.email.trim().toLowerCase()

  // Reuse an existing pending invite for the same email if present
  const { data: existing } = await supabase
    .from('org_invites')
    .select('*')
    .eq('org_id', input.orgId)
    .eq('email', email)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (existing) return existing as OrgInvite

  const { data, error } = await supabase
    .from('org_invites')
    .insert({
      org_id: input.orgId,
      email,
      role: input.role,
      token: generateToken(),
      invited_by_user_id: input.invitedByUserId,
      expires_at: expiryFromNow(),
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as OrgInvite
}

/**
 * Lists all invites for an org (any status). Used by the members settings page.
 * Joined with the inviter's user record for display.
 */
export async function listOrgInvites(orgId: string): Promise<OrgInviteWithInviter[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('org_invites')
    .select(
      `*, invited_by:users!org_invites_invited_by_user_id_fkey(name, email)`,
    )
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as OrgInviteWithInviter[]
}

/**
 * Revokes a pending invite. Only the issuing org's members (with site_admin role)
 * can revoke; this is enforced by RLS, not by app code.
 */
export async function revokeInvite(inviteId: string): Promise<void> {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('org_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', inviteId)
    .is('accepted_at', null)
    .is('revoked_at', null)
  if (error) throw new Error(error.message)
}

// ─── Public-side: lookup / accept (service client, bypasses RLS) ──────────────

/**
 * Returns the invite for a token if it's pending and not expired.
 * Returns null in any other case (revoked, accepted, expired, not found).
 *
 * Uses the service client because the lookup happens before the user has any
 * session, and even afterwards they're not yet a member of the inviting org.
 */
export async function getInviteByToken(token: string): Promise<OrgInvite | null> {
  const service = createServiceClient()
  const { data } = await service
    .from('org_invites')
    .select('*')
    .eq('token', token)
    .maybeSingle()
  if (!data) return null
  if (data.accepted_at || data.revoked_at) return null
  if (new Date(data.expires_at) < new Date()) return null
  return data as OrgInvite
}

/**
 * Returns the invite for a token AND the org name, used by the accept page
 * to display "You've been invited to {org}".
 */
export async function getInviteWithOrgByToken(
  token: string,
): Promise<{ invite: OrgInvite; orgName: string } | null> {
  const invite = await getInviteByToken(token)
  if (!invite) return null
  const service = createServiceClient()
  const { data: org } = await service
    .from('organizations')
    .select('name')
    .eq('id', invite.org_id)
    .maybeSingle()
  if (!org) return null
  return { invite, orgName: org.name }
}

interface AcceptInviteParams {
  token: string
  authUserId: string
  email: string
  fullName: string
}

/**
 * Accepts an invite for an authenticated user.
 *
 * Two cases:
 *   1. Brand new user — public.users row doesn't exist. Creates it
 *      (id = authUserId, org_id = inviting org), then creates the
 *      org_memberships row.
 *   2. Existing user — public.users row exists with their own org_id.
 *      Adds an additional org_memberships row joining the new org.
 *      users.org_id is NOT changed (their "home org" stays the same).
 *
 * Marks the invite accepted regardless. Throws if the invite is invalid.
 */
export async function acceptInvite(params: AcceptInviteParams): Promise<{ orgId: string }> {
  const service = createServiceClient()

  // Re-validate the invite (defence in depth — getInviteByToken may have been
  // called earlier in the flow but state could have changed)
  const { data: invite } = await service
    .from('org_invites')
    .select('*')
    .eq('token', params.token)
    .maybeSingle()
  if (!invite) throw new Error('Invite not found')
  if (invite.accepted_at) throw new Error('Invite has already been accepted')
  if (invite.revoked_at) throw new Error('Invite has been revoked')
  if (new Date(invite.expires_at) < new Date()) throw new Error('Invite has expired')
  if (invite.email.toLowerCase() !== params.email.toLowerCase()) {
    throw new Error('This invite is for a different email address')
  }

  // Check if a public.users row already exists for this auth user
  const { data: existingUser } = await service
    .from('users')
    .select('id, org_id')
    .eq('id', params.authUserId)
    .maybeSingle()

  if (!existingUser) {
    // Brand new user — create the public.users row pointing at the inviting org
    const { error: userErr } = await service.from('users').insert({
      id: params.authUserId,
      org_id: invite.org_id,
      name: params.fullName,
      email: params.email,
    })
    if (userErr) throw new Error(userErr.message)
  }

  // Idempotency: don't create duplicate membership
  const { data: existingMembership } = await service
    .from('org_memberships')
    .select('id')
    .eq('org_id', invite.org_id)
    .eq('user_id', params.authUserId)
    .maybeSingle()

  if (!existingMembership) {
    const { error: memErr } = await service.from('org_memberships').insert({
      org_id: invite.org_id,
      user_id: params.authUserId,
      role: invite.role,
    })
    if (memErr) throw new Error(memErr.message)
  }

  // Mark invite accepted
  const { error: updateErr } = await service
    .from('org_invites')
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by_user_id: params.authUserId,
    })
    .eq('id', invite.id)
  if (updateErr) throw new Error(updateErr.message)

  // Activity log
  try {
    await logActivity({
      orgId: invite.org_id,
      actorUserId: params.authUserId,
      entityType: 'org_membership',
      entityId: params.authUserId,
      action: 'created',
      title: `${params.fullName} joined via invite`,
      description: `Role: ${invite.role}`,
    })
  } catch {
    // never fail acceptance over a log row
  }

  return { orgId: invite.org_id }
}

// ─── Org members listing ─────────────────────────────────────────────────────

export interface OrgMember {
  user_id: string
  name: string | null
  email: string | null
  role: OrgRole
  joined_at: string
}

/**
 * Lists all members of an org with their role and join date.
 * Used by the settings/members page.
 */
export async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('org_memberships')
    .select(`role, created_at, users:users!org_memberships_user_id_fkey(id, name, email)`)
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  // Supabase joins typed-as-array even when the relation is one-to-one,
  // so we type the row with an array and pick the first element.
  type Row = {
    role: OrgRole
    created_at: string
    users: { id: string; name: string | null; email: string | null }[] | null
  }

  return ((data ?? []) as unknown as Row[])
    .map((row) => {
      const u = Array.isArray(row.users) ? row.users[0] : row.users
      if (!u) return null
      return {
        user_id: u.id,
        name: u.name,
        email: u.email,
        role: row.role,
        joined_at: row.created_at,
      }
    })
    .filter((m): m is OrgMember => m !== null)
}
