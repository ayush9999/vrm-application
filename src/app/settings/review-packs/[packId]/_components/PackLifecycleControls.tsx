'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { archiveReviewPackAction, restoreReviewPackAction, deleteReviewPackAction, duplicatePackAction } from '../../actions'

interface Props {
  packId: string
  isActive: boolean
  isStandard: boolean
  isSiteAdmin: boolean
}

export function PackLifecycleControls({ packId, isActive, isStandard, isSiteAdmin }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleDuplicate = () => {
    startTransition(async () => {
      const r = await duplicatePackAction(packId)
      if (r.message) alert(r.message)
      // Otherwise the action redirects.
    })
  }

  if (isStandard) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
          style={{ background: 'rgba(108,93,211,0.05)', color: '#6c5dd3' }}
        >
          Read-only
        </span>
        {isSiteAdmin && (
          <button
            type="button"
            onClick={handleDuplicate}
            disabled={isPending}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            style={{ background: 'rgba(108,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(108,93,211,0.15)' }}
          >
            {isPending ? 'Working…' : 'Duplicate as Custom'}
          </button>
        )}
      </div>
    )
  }

  const handleArchive = () => {
    startTransition(async () => {
      const r = await archiveReviewPackAction(packId)
      if (r.success) router.refresh()
      else alert(r.message)
    })
  }
  const handleRestore = () => {
    startTransition(async () => {
      const r = await restoreReviewPackAction(packId)
      if (r.success) router.refresh()
      else alert(r.message)
    })
  }
  const handleDelete = () => {
    if (!confirm('Delete this review pack? This is a soft delete — a database admin can recover it.')) return
    startTransition(async () => {
      const r = await deleteReviewPackAction(packId)
      if (r.success) router.push('/settings/review-packs')
      else alert(r.message)
    })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {isActive ? (
        <button
          type="button"
          onClick={handleArchive}
          disabled={isPending}
          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          style={{ background: 'rgba(245,158,11,0.08)', color: '#d97706', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          {isPending ? 'Working…' : 'Archive Pack'}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleRestore}
          disabled={isPending}
          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          style={{ background: 'rgba(5,150,105,0.08)', color: '#059669', border: '1px solid rgba(5,150,105,0.2)' }}
        >
          {isPending ? 'Working…' : 'Restore Pack'}
        </button>
      )}
      {isSiteAdmin && (
        <>
          <button
            type="button"
            onClick={handleDuplicate}
            disabled={isPending}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            style={{ background: 'rgba(108,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(108,93,211,0.15)' }}
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            style={{ background: 'rgba(225,29,72,0.06)', color: '#e11d48', border: '1px solid rgba(225,29,72,0.2)' }}
          >
            Delete
          </button>
        </>
      )}
    </div>
  )
}
