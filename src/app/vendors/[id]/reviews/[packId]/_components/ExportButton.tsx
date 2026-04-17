'use client'

import { useTransition } from 'react'

interface Props {
  vendorId: string
  packId: string
  exportAction: (vendorId: string, packId: string) => Promise<{ csv?: string; fileName?: string; message?: string }>
}

export function ExportButton({ vendorId, packId, exportAction }: Props) {
  const [isPending, startTransition] = useTransition()

  const handleExport = () => {
    startTransition(async () => {
      const r = await exportAction(vendorId, packId)
      if (r.csv && r.fileName) {
        const blob = new Blob([r.csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = r.fileName
        a.click()
        URL.revokeObjectURL(url)
      } else if (r.message) {
        alert(r.message)
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isPending}
      className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
      style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.12)' }}
    >
      {isPending ? 'Exporting…' : '↓ Export CSV'}
    </button>
  )
}
