'use client'

import { useState, useTransition, useEffect } from 'react'
import type { ReviewComment } from '@/lib/db/review-comments'

interface Props {
  itemId: string
  vendorId: string
  packId: string
  getCommentsAction: (itemId: string) => Promise<{ comments?: ReviewComment[]; message?: string }>
  addCommentAction: (vendorId: string, packId: string, itemId: string, body: string, parentCommentId?: string | null) => Promise<{ success?: boolean; message?: string }>
}

export function CommentThread({ itemId, vendorId, packId, getCommentsAction, addCommentAction }: Props) {
  const [comments, setComments] = useState<ReviewComment[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const loadComments = async () => {
    if (comments !== null) return
    setIsLoading(true)
    const r = await getCommentsAction(itemId)
    setIsLoading(false)
    if (r.comments) setComments(r.comments)
  }

  const handleToggle = () => {
    setIsOpen((v) => !v)
    if (!isOpen && comments === null) loadComments()
  }

  const handleSubmit = () => {
    if (!newComment.trim()) return
    startTransition(async () => {
      const r = await addCommentAction(vendorId, packId, itemId, newComment.trim(), replyTo)
      if (r.success) {
        setNewComment('')
        setReplyTo(null)
        // Reload comments
        const fresh = await getCommentsAction(itemId)
        if (fresh.comments) setComments(fresh.comments)
      }
    })
  }

  const totalCount = comments ? countAll(comments) : null

  return (
    <div className="pt-2 border-t" style={{ borderColor: 'rgba(108,93,211,0.08)' }}>
      <button
        type="button"
        onClick={handleToggle}
        className="text-[11px] font-medium flex items-center gap-1.5"
        style={{ color: '#6c5dd3' }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h12v8a1 1 0 01-1 1H5l-3 3V4a1 1 0 011-1z" />
        </svg>
        {isOpen ? 'Hide comments' : 'Comments'}
        {totalCount !== null && totalCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(108,93,211,0.1)', color: '#6c5dd3' }}>
            {totalCount}
          </span>
        )}
        {isLoading && ' …'}
      </button>

      {isOpen && (
        <div className="mt-2 space-y-2">
          {/* Comment list */}
          {comments && comments.length > 0 && (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {comments.map((c) => (
                <CommentNode key={c.id} comment={c} onReply={(id) => setReplyTo(id)} depth={0} />
              ))}
            </div>
          )}
          {comments && comments.length === 0 && (
            <p className="text-[11px] py-2" style={{ color: '#a99fd8' }}>No comments yet.</p>
          )}

          {/* New comment input */}
          <div className="flex items-start gap-2">
            <div className="flex-1">
              {replyTo && (
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[10px]" style={{ color: '#8b7fd4' }}>Replying to comment</span>
                  <button type="button" onClick={() => setReplyTo(null)} className="text-[10px]" style={{ color: '#e11d48' }}>× Cancel</button>
                </div>
              )}
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
                placeholder="Add a comment…"
                className="w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                style={{ border: '1px solid rgba(109,93,211,0.15)', color: '#1e1550' }}
              />
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !newComment.trim()}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50 mt-0.5"
              style={{ background: '#6c5dd3' }}
            >
              {isPending ? '…' : 'Post'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CommentNode({ comment, onReply, depth }: { comment: ReviewComment; onReply: (id: string) => void; depth: number }) {
  const initials = (comment.user_name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div style={{ marginLeft: depth > 0 ? `${depth * 20}px` : undefined }}>
      <div className="flex items-start gap-2 px-2 py-1.5 rounded-lg" style={{ background: depth > 0 ? 'rgba(108,93,211,0.03)' : 'rgba(108,93,211,0.05)' }}>
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
          style={{ background: '#6c5dd3' }}
        >
          {initials}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold" style={{ color: '#1e1550' }}>{comment.user_name ?? 'Unknown'}</span>
            <span className="text-[10px]" style={{ color: '#a99fd8' }}>
              {new Date(comment.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              type="button"
              onClick={() => onReply(comment.id)}
              className="text-[10px] font-medium hover:underline ml-auto"
              style={{ color: '#6c5dd3' }}
            >
              Reply
            </button>
          </div>
          <p className="text-xs mt-0.5" style={{ color: '#4a4270' }}>{comment.body}</p>
        </div>
      </div>
      {comment.replies?.map((reply) => (
        <CommentNode key={reply.id} comment={reply} onReply={onReply} depth={depth + 1} />
      ))}
    </div>
  )
}

function countAll(comments: ReviewComment[]): number {
  let n = 0
  for (const c of comments) {
    n += 1
    if (c.replies) n += countAll(c.replies)
  }
  return n
}
