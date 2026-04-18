/**
 * Cached wrappers around heavy DB helpers.
 * Uses Next.js unstable_cache with 60-second TTL.
 *
 * Import from here instead of the raw helpers when you don't need
 * real-time freshness (list pages, dashboard, metrics).
 *
 * For mutations or pages that need instant freshness after a write,
 * use the raw helpers + revalidateTag/revalidatePath.
 */

import { unstable_cache } from 'next/cache'
import { getDashboardData } from '@/lib/db/dashboard'
import { getReviewsByVendor } from '@/lib/db/reviews-by-vendor'
import type { VendorApprovalStatus } from '@/types/review-pack'

/**
 * Cached dashboard data — revalidates every 60 seconds.
 * Dashboard is the heaviest page (5+ aggregation queries).
 */
export const getCachedDashboardData = unstable_cache(
  async (orgId: string) => getDashboardData(orgId),
  ['dashboard-data'],
  { revalidate: 60, tags: ['dashboard'] },
)

/**
 * Cached reviews-by-vendor — revalidates every 60 seconds.
 * Reviews master page runs metrics for every vendor.
 */
export const getCachedReviewsByVendor = unstable_cache(
  async (orgId: string) => getReviewsByVendor(orgId),
  ['reviews-by-vendor'],
  { revalidate: 60, tags: ['reviews'] },
)
