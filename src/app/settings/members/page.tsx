import { headers } from 'next/headers'
import { requireCurrentUser } from '@/lib/current-user'
import { listOrgMembers, listOrgInvites } from '@/lib/db/invites'
import { getInviteStatus } from '@/types/invite'
import { MembersClient } from './_components/MembersClient'

export default async function MembersPage() {
  const user = await requireCurrentUser()

  const [members, invites] = await Promise.all([
    listOrgMembers(user.orgId),
    listOrgInvites(user.orgId),
  ])

  // Build absolute base URL for invite links (so the owner can copy a real URL)
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const baseUrl = `${proto}://${host}`

  const invitesWithStatus = invites.map((inv) => ({
    ...inv,
    status: getInviteStatus(inv),
    invite_url: `${baseUrl}/invite/${inv.token}`,
  }))

  const isOwner = user.role === 'site_admin'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>
          Members & Invites
        </h2>
        <p className="text-sm mt-1" style={{ color: '#a99fd8' }}>
          Manage who has access to your organisation.
        </p>
      </div>

      <MembersClient
        members={members}
        invites={invitesWithStatus}
        currentUserId={user.userId}
        isOwner={isOwner}
      />
    </div>
  )
}
