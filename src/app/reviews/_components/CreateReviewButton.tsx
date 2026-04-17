'use client'

import { useState } from 'react'
import { CreateReviewModal } from './CreateReviewModal'

interface Vendor { id: string; name: string; vendor_code: string | null }
interface Pack { id: string; name: string; code: string | null }
interface User { id: string; name: string | null; email: string | null }

interface Props {
  vendors: Vendor[]
  packs: Pack[]
  users: User[]
  createAction: (input: {
    vendorId: string
    reviewPackId: string
    reviewerUserId: string | null
    approverUserId: string | null
    dueAt: string | null
  }) => Promise<{ success?: boolean; vrpId?: string; message?: string }>
}

export function CreateReviewButton({ vendors, packs, users, createAction }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-sm font-medium px-5 py-2 rounded-full text-white"
        style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 2px 8px rgba(108,93,211,0.3)' }}
      >
        + Create Review
      </button>
      <CreateReviewModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        vendors={vendors}
        packs={packs}
        users={users}
        createAction={createAction}
      />
    </>
  )
}
