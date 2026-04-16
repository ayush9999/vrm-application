import { createServerClient } from '@/lib/supabase/server'

// ─── Company Profile (lives on the organizations row) ──────────────────────

export interface CompanyProfile {
  id: string
  name: string
  company_type: string | null
  industry: string | null
  operating_countries: string[]
  default_review_cadence: string | null
  esg_enabled: boolean
}

export async function getCompanyProfile(orgId: string): Promise<CompanyProfile | null> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, company_type, industry, operating_countries, default_review_cadence, esg_enabled')
    .eq('id', orgId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    ...(data as Omit<CompanyProfile, 'operating_countries'>),
    operating_countries: ((data as { operating_countries: string[] | null }).operating_countries ?? []),
  } as CompanyProfile
}

export async function updateCompanyProfile(
  orgId: string,
  patch: Partial<Omit<CompanyProfile, 'id' | 'name'>>,
): Promise<void> {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('organizations')
    .update(patch)
    .eq('id', orgId)
  if (error) throw new Error(error.message)
}

// ─── Default approvers per criticality tier ─────────────────────────────────

export interface DefaultApprover {
  criticality_tier: number
  approver_user_id: string
  approver_name?: string | null
}

export async function getDefaultApprovers(orgId: string): Promise<DefaultApprover[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('org_default_approvers')
    .select(`
      criticality_tier, approver_user_id,
      users!inner ( name, email )
    `)
    .eq('org_id', orgId)
    .order('criticality_tier')
  if (error) throw new Error(error.message)

  type Row = { criticality_tier: number; approver_user_id: string; users: { name: string | null; email: string | null } | null }
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    criticality_tier: r.criticality_tier,
    approver_user_id: r.approver_user_id,
    approver_name: r.users?.name ?? r.users?.email ?? null,
  }))
}

export async function setDefaultApprover(
  orgId: string,
  tier: number,
  approverUserId: string | null,
): Promise<void> {
  const supabase = await createServerClient()
  if (!approverUserId) {
    await supabase
      .from('org_default_approvers')
      .delete()
      .eq('org_id', orgId)
      .eq('criticality_tier', tier)
    return
  }
  const { error } = await supabase
    .from('org_default_approvers')
    .upsert(
      { org_id: orgId, criticality_tier: tier, approver_user_id: approverUserId },
      { onConflict: 'org_id,criticality_tier' },
    )
  if (error) throw new Error(error.message)
}

// ─── Reminder Rules (KV in org_settings) ────────────────────────────────────

export type ReminderRules = {
  evidence_expiring_30d: boolean
  evidence_expiring_7d: boolean
  evidence_expiring_1d: boolean
  review_overdue: boolean
  remediation_assigned: boolean
  remediation_overdue: boolean
  approval_decision: boolean
  vendor_questionnaire_submitted: boolean
}

const DEFAULT_REMINDER_RULES: ReminderRules = {
  evidence_expiring_30d: true,
  evidence_expiring_7d: true,
  evidence_expiring_1d: true,
  review_overdue: true,
  remediation_assigned: true,
  remediation_overdue: true,
  approval_decision: true,
  vendor_questionnaire_submitted: true,
}

export async function getReminderRules(orgId: string): Promise<ReminderRules> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('org_settings')
    .select('value')
    .eq('org_id', orgId)
    .eq('key', 'reminder_rules')
    .maybeSingle()
  if (!data) return DEFAULT_REMINDER_RULES
  return { ...DEFAULT_REMINDER_RULES, ...((data as { value: Partial<ReminderRules> }).value) }
}

export async function setReminderRules(orgId: string, rules: ReminderRules): Promise<void> {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('org_settings')
    .upsert(
      { org_id: orgId, key: 'reminder_rules', value: rules, updated_at: new Date().toISOString() },
      { onConflict: 'org_id,key' },
    )
  if (error) throw new Error(error.message)
}
