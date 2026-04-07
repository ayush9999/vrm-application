/** Generic server-action response shape used across all forms */
export interface FormState {
  errors?: Record<string, string[] | undefined>
  message?: string
  success?: boolean
}
