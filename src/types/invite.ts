import type { OrgRole } from './org'

export interface OrgInvite {
  id: string
  org_id: string
  email: string
  role: OrgRole
  token: string
  invited_by_user_id: string | null
  created_at: string
  expires_at: string
  accepted_at: string | null
  accepted_by_user_id: string | null
  revoked_at: string | null
}

/** Joined view used in the members page */
export interface OrgInviteWithInviter extends OrgInvite {
  invited_by: { name: string | null; email: string | null } | null
}

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export function getInviteStatus(invite: OrgInvite): InviteStatus {
  if (invite.revoked_at) return 'revoked'
  if (invite.accepted_at) return 'accepted'
  if (new Date(invite.expires_at) < new Date()) return 'expired'
  return 'pending'
}
