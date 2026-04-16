'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { CustomField, CustomFieldType } from '@/lib/db/custom-fields'

interface Props {
  fields: CustomField[]
  canEdit: boolean
  createAction: (input: {
    name: string
    code: string
    description?: string | null
    field_type: CustomFieldType
    required: boolean
    options?: string[] | null
  }) => Promise<{ success?: boolean; message?: string }>
  deleteAction: (fieldId: string) => Promise<{ success?: boolean; message?: string }>
}

export function CustomFieldsClient({ fields, canEdit, createAction, deleteAction }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [fieldType, setFieldType] = useState<CustomFieldType>('text')
  const [required, setRequired] = useState(false)
  const [optionsText, setOptionsText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const reset = () => {
    setName('')
    setCode('')
    setDescription('')
    setFieldType('text')
    setRequired(false)
    setOptionsText('')
    setError(null)
    setShowForm(false)
  }

  const handleCreate = () => {
    setError(null)
    const options = (fieldType === 'select' || fieldType === 'multi_select')
      ? optionsText.split('\n').map((o) => o.trim()).filter(Boolean)
      : null
    startTransition(async () => {
      const r = await createAction({
        name,
        code: code || name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        description: description || null,
        field_type: fieldType,
        required,
        options,
      })
      if (r.success) {
        reset()
        router.refresh()
      } else {
        setError(r.message ?? 'Failed')
      }
    })
  }

  const handleDelete = (fieldId: string) => {
    if (!confirm('Delete this field? Existing values on vendors will be preserved but the field won\'t appear on the form.')) return
    startTransition(async () => {
      const r = await deleteAction(fieldId)
      if (r.success) router.refresh()
      else setError(r.message ?? 'Failed')
    })
  }

  return (
    <div className="space-y-4">
      {/* Existing fields */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}
      >
        {fields.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm" style={{ color: '#a99fd8' }}>
            No custom fields defined yet.
          </p>
        ) : (
          fields.map((f, i) => (
            <div
              key={f.id}
              className="px-5 py-3 flex items-start gap-3"
              style={{ borderBottom: i === fields.length - 1 ? undefined : '1px solid rgba(109,93,211,0.06)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium" style={{ color: '#1e1550' }}>{f.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(108,93,211,0.08)', color: '#6b5fa8' }}>{f.code}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: 'rgba(108,93,211,0.06)', color: '#6c5dd3' }}>
                    {f.field_type}
                  </span>
                  {f.required && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: 'rgba(225,29,72,0.08)', color: '#e11d48' }}>
                      Required
                    </span>
                  )}
                </div>
                {f.description && <p className="text-xs mt-1" style={{ color: '#4a4270' }}>{f.description}</p>}
                {f.options && f.options.length > 0 && (
                  <p className="text-[10px] mt-1" style={{ color: '#a99fd8' }}>
                    Options: {f.options.join(', ')}
                  </p>
                )}
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(f.id)}
                  disabled={isPending}
                  className="text-xs font-medium px-2 py-1 rounded-md disabled:opacity-50"
                  style={{ background: 'rgba(225,29,72,0.06)', color: '#e11d48' }}
                >
                  Delete
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add new */}
      {canEdit && !showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-sm font-medium px-4 py-2 rounded-full"
          style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', color: 'white' }}
        >
          + Add Custom Field
        </button>
      )}

      {showForm && (
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}
        >
          <h3 className="text-sm font-semibold" style={{ color: '#1e1550' }}>New custom field</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: '#6c5dd3' }}>Display Name *</label>
              <input className="w-full rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cost Center" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: '#6c5dd3' }}>Code (snake_case)</label>
              <input className="w-full rounded-lg px-3 py-2 text-sm font-mono" style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }} value={code} onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="auto from name if blank" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: '#6c5dd3' }}>Description</label>
              <input className="w-full rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Help text shown on the vendor form" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: '#6c5dd3' }}>Type *</label>
              <select className="w-full rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }} value={fieldType} onChange={(e) => setFieldType(e.target.value as CustomFieldType)}>
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="boolean">Boolean (Yes/No)</option>
                <option value="select">Select (single choice)</option>
                <option value="multi_select">Multi-Select</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-7">
              <input id="req" type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="h-4 w-4 rounded" style={{ accentColor: '#6c5dd3' }} />
              <label htmlFor="req" className="text-sm font-medium" style={{ color: '#4a4270' }}>Required field</label>
            </div>
            {(fieldType === 'select' || fieldType === 'multi_select') && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: '#6c5dd3' }}>Options (one per line) *</label>
                <textarea
                  className="w-full rounded-lg px-3 py-2 text-sm font-mono"
                  style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
                  rows={3}
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  placeholder={'High\nMedium\nLow'}
                />
              </div>
            )}
          </div>

          {error && <p className="text-xs" style={{ color: '#e11d48' }}>{error}</p>}

          <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid rgba(109,93,211,0.06)' }}>
            <button
              type="button"
              onClick={handleCreate}
              disabled={isPending || !name}
              className="text-xs font-semibold px-4 py-2 rounded-full text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
            >
              {isPending ? 'Creating…' : 'Create Field'}
            </button>
            <button type="button" onClick={reset} className="text-xs px-3 py-2" style={{ color: '#a99fd8' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
