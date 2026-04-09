'use client'

import { useState, useTransition } from 'react'
import { acceptInviteAction } from '@/app/auth/actions'
import { Spinner } from '@/app/_components/Spinner'

export function AcceptInviteButton({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const result = await acceptInviteAction(token)
      if (result?.message) {
        setError(result.message)
      }
      // On success the action redirects, so this branch never runs
    })
  }

  return (
    <div className="space-y-3">
      {error && (
        <div
          className="rounded-lg px-3 py-2.5 text-sm"
          style={{
            background: 'rgba(225,29,72,0.06)',
            border: '1px solid rgba(225,29,72,0.2)',
            color: '#e11d48',
          }}
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50 transition-all hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
      >
        {isPending && <Spinner />}
        {isPending ? 'Joining…' : 'Accept invite'}
      </button>
    </div>
  )
}
