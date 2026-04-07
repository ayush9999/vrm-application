export type OrgRole = 'site_admin' | 'vendor_admin'

export interface Organization {
  id: string
  name: string
  created_at: string
}

export interface AppUser {
  id: string
  org_id: string
  name: string | null
  email: string | null
  created_at: string
}

export interface OrgMembership {
  id: string
  org_id: string
  user_id: string
  role: OrgRole
  created_at: string
}

/** Resolved context available after cookie-based auth lookup */
export interface CurrentUser {
  userId: string
  orgId: string
  role: OrgRole
}
