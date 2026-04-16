import { createServerClient } from '@/lib/supabase/server'

export type CustomFieldType = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multi_select'

export interface CustomField {
  id: string
  org_id: string
  entity_type: string  // 'vendor' for now
  name: string
  code: string
  description: string | null
  field_type: CustomFieldType
  required: boolean
  options: string[] | null
  sort_order: number
  created_at: string
  deleted_at: string | null
}

export async function listCustomFields(orgId: string, entityType: string = 'vendor'): Promise<CustomField[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('org_custom_fields')
    .select('*')
    .eq('org_id', orgId)
    .eq('entity_type', entityType)
    .is('deleted_at', null)
    .order('sort_order')
    .order('created_at')
  if (error) throw new Error(error.message)
  return (data ?? []) as CustomField[]
}

export async function createCustomField(input: {
  orgId: string
  entityType?: string
  name: string
  code: string
  description?: string | null
  fieldType: CustomFieldType
  required: boolean
  options?: string[] | null
  createdByUserId: string
}): Promise<CustomField> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('org_custom_fields')
    .insert({
      org_id: input.orgId,
      entity_type: input.entityType ?? 'vendor',
      name: input.name,
      code: input.code,
      description: input.description ?? null,
      field_type: input.fieldType,
      required: input.required,
      options: input.options ?? null,
      created_by_user_id: input.createdByUserId,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as CustomField
}

export async function deleteCustomField(orgId: string, fieldId: string): Promise<void> {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('org_custom_fields')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', fieldId)
    .eq('org_id', orgId)
  if (error) throw new Error(error.message)
}
