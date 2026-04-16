import Link from 'next/link'
import { requireCurrentUser } from '@/lib/current-user'
import { CustomPackBuilder } from './_components/CustomPackBuilder'
import { createCustomPackAction } from '../actions'

export default async function NewReviewPackPage() {
  const user = await requireCurrentUser()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 text-xs" style={{ color: '#a99fd8' }}>
        <Link href="/settings/review-packs" className="hover:text-[#6c5dd3]" style={{ color: '#a99fd8' }}>
          Review Packs
        </Link>
        <span>/</span>
        <span className="font-medium" style={{ color: '#1e1550' }}>New Custom Pack</span>
      </div>

      <div>
        <h2 className="text-lg font-semibold tracking-tight" style={{ color: '#1e1550' }}>Create Custom Review Pack</h2>
        <p className="text-sm mt-1" style={{ color: '#a99fd8' }}>
          Define a new pack tailored to your organisation. Add evidence requirements and review questions, set the auto-apply rules, then save.
        </p>
      </div>

      {user.role !== 'site_admin' && (
        <p className="text-xs" style={{ color: '#d97706' }}>Only site admins can create review packs.</p>
      )}

      <CustomPackBuilder createAction={createCustomPackAction} />
    </div>
  )
}
