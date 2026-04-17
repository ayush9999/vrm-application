import { createServerClient } from '@/lib/supabase/server'

export interface ReviewComment {
  id: string
  vendor_review_item_id: string
  parent_comment_id: string | null
  user_id: string
  user_name: string | null
  body: string
  mentions: { user_id: string; name: string }[]
  created_at: string
  replies?: ReviewComment[]
}

/** Get all comments for a review item, nested by parent. */
export async function getReviewItemComments(reviewItemId: string): Promise<ReviewComment[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('review_item_comments')
    .select(`
      id, vendor_review_item_id, parent_comment_id, user_id, body, mentions, created_at,
      users!inner ( name, email )
    `)
    .eq('vendor_review_item_id', reviewItemId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)

  type Row = {
    id: string
    vendor_review_item_id: string
    parent_comment_id: string | null
    user_id: string
    body: string
    mentions: { user_id: string; name: string }[] | null
    created_at: string
    users: { name: string | null; email: string | null } | { name: string | null; email: string | null }[] | null
  }

  const flat = ((data ?? []) as unknown as Row[]).map((r) => {
    const u = Array.isArray(r.users) ? r.users[0] : r.users
    return {
      id: r.id,
      vendor_review_item_id: r.vendor_review_item_id,
      parent_comment_id: r.parent_comment_id,
      user_id: r.user_id,
      user_name: u?.name ?? u?.email ?? null,
      body: r.body,
      mentions: r.mentions ?? [],
      created_at: r.created_at,
    } as ReviewComment
  })

  // Nest replies under parents
  const roots: ReviewComment[] = []
  const byId = new Map<string, ReviewComment>()
  for (const c of flat) {
    c.replies = []
    byId.set(c.id, c)
  }
  for (const c of flat) {
    if (c.parent_comment_id && byId.has(c.parent_comment_id)) {
      byId.get(c.parent_comment_id)!.replies!.push(c)
    } else {
      roots.push(c)
    }
  }
  return roots
}

/** Add a comment to a review item. */
export async function addReviewItemComment(input: {
  orgId: string
  reviewItemId: string
  parentCommentId?: string | null
  userId: string
  body: string
  mentions?: { user_id: string; name: string }[]
}): Promise<ReviewComment> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('review_item_comments')
    .insert({
      org_id: input.orgId,
      vendor_review_item_id: input.reviewItemId,
      parent_comment_id: input.parentCommentId ?? null,
      user_id: input.userId,
      body: input.body,
      mentions: input.mentions ?? [],
    })
    .select('id, vendor_review_item_id, parent_comment_id, user_id, body, mentions, created_at')
    .single()
  if (error) throw new Error(error.message)
  return { ...(data as ReviewComment), user_name: null, replies: [] }
}

/** Count comments per review item (for unread indicators). */
export async function countCommentsPerItem(
  reviewItemIds: string[],
): Promise<Map<string, number>> {
  if (reviewItemIds.length === 0) return new Map()
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('review_item_comments')
    .select('vendor_review_item_id')
    .in('vendor_review_item_id', reviewItemIds)
  if (error) throw new Error(error.message)

  const counts = new Map<string, number>()
  for (const r of (data ?? []) as { vendor_review_item_id: string }[]) {
    counts.set(r.vendor_review_item_id, (counts.get(r.vendor_review_item_id) ?? 0) + 1)
  }
  return counts
}
