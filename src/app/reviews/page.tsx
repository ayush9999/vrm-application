import { requireCurrentUser } from '@/lib/current-user'
import { getOrgReviewsList } from '@/lib/db/reviews-list'
import { getOrgUsers } from '@/lib/db/organizations'
import { ReviewsListClient } from './_components/ReviewsListClient'
import { bulkAssignReviewerAction, bulkAssignApproverAction, bulkStartReviewsAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function ReviewsPage() {
  const user = await requireCurrentUser()
  const [reviews, users] = await Promise.all([
    getOrgReviewsList(user.orgId),
    getOrgUsers(user.orgId),
  ])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>Reviews</h1>
        <p className="text-sm mt-0.5" style={{ color: '#a99fd8' }}>
          All vendor reviews across your organisation in one place.
        </p>
      </div>

      <ReviewsListClient
        reviews={reviews}
        users={users}
        bulkAssignReviewerAction={bulkAssignReviewerAction}
        bulkAssignApproverAction={bulkAssignApproverAction}
        bulkStartReviewsAction={bulkStartReviewsAction}
      />
    </div>
  )
}
