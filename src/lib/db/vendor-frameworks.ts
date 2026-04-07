import { createServerClient } from '@/lib/supabase/server'
import type { AssessmentFramework } from '@/types/assessment'

/**
 * Returns global + org-level suggested VRFs for a given vendor category,
 * ordered by display_order.
 */
export async function getCategoryFrameworkSuggestions(
  orgId: string,
  categoryId: string | null,
): Promise<AssessmentFramework[]> {
  if (!categoryId) return []

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('category_framework_suggestions')
    .select('framework_id, display_order')
    .eq('category_id', categoryId)
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .order('display_order')

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as { framework_id: string; display_order: number }[]
  if (rows.length === 0) return []

  // Deduplicate framework_ids (global + org suggestions may overlap)
  const uniqueFrameworkIds = [...new Set(rows.map((r) => r.framework_id))]

  const { data: frameworks, error: fwErr } = await supabase
    .from('assessment_frameworks')
    .select('*')
    .in('id', uniqueFrameworkIds)
    .is('deleted_at', null)
    .eq('is_active', true)

  if (fwErr) throw new Error(fwErr.message)

  const frameworkById = new Map(
    ((frameworks ?? []) as AssessmentFramework[]).map((f) => [f.id, f]),
  )

  // Return in suggestion display_order
  return uniqueFrameworkIds
    .filter((id) => frameworkById.has(id))
    .map((id) => frameworkById.get(id)!)
}

/**
 * Returns a map of categoryId → frameworkId[] for all category suggestions
 * visible to this org (global + org-level).
 */
export async function getAllCategoryFrameworkSuggestions(
  orgId: string,
): Promise<Record<string, string[]>> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('category_framework_suggestions')
    .select('category_id, framework_id')
    .or(`org_id.eq.${orgId},org_id.is.null`)

  if (error) throw new Error(error.message)

  const result: Record<string, string[]> = {}
  for (const row of (data ?? []) as { category_id: string; framework_id: string }[]) {
    if (!result[row.category_id]) result[row.category_id] = []
    result[row.category_id].push(row.framework_id)
  }
  return result
}

