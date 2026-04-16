'use server'

import { revalidatePath } from 'next/cache'
import { requireCurrentUser } from '@/lib/current-user'
import { createCustomField, deleteCustomField, type CustomFieldType } from '@/lib/db/custom-fields'

export async function createCustomFieldAction(input: {
  name: string
  code: string
  description?: string | null
  field_type: CustomFieldType
  required: boolean
  options?: string[] | null
}): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    if (user.role !== 'site_admin') return { message: 'Only site admins can create custom fields.' }
    if (!input.name?.trim()) return { message: 'Name is required' }
    if (!input.code?.trim() || !/^[a-z0-9_]+$/.test(input.code)) {
      return { message: 'Code must be lowercase letters, numbers and underscores only' }
    }
    if ((input.field_type === 'select' || input.field_type === 'multi_select') && (!input.options || input.options.length === 0)) {
      return { message: 'Select / Multi-select fields must have at least one option' }
    }

    await createCustomField({
      orgId: user.orgId,
      name: input.name.trim(),
      code: input.code.trim(),
      description: input.description ?? null,
      fieldType: input.field_type,
      required: input.required,
      options: input.options ?? null,
      createdByUserId: user.userId,
    })

    revalidatePath('/settings/custom-fields')
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to create field' }
  }
}

export async function deleteCustomFieldAction(fieldId: string): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    if (user.role !== 'site_admin') return { message: 'Only site admins can delete custom fields.' }
    await deleteCustomField(user.orgId, fieldId)
    revalidatePath('/settings/custom-fields')
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to delete' }
  }
}
