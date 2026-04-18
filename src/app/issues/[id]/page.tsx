import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCurrentUser } from '@/lib/current-user'
import { getIssueById } from '@/lib/db/issues'
import { getOrgUsers } from '@/lib/db/organizations'
import { getVendorDocumentTypes } from '@/lib/db/documents'
import { IssueDetailClient } from './_components/IssueDetailClient'
import {
  updateIssueAction,
  addIssueNoteAction,
  uploadEvidenceAction,
  reviewEvidenceAction,
  deleteEvidenceAction,
  changeIssueStatusAction,
  promoteEvidenceAction,
} from '../actions'

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireCurrentUser()
  const [issue, orgUsers] = await Promise.all([
    getIssueById(user.orgId, id),
    getOrgUsers(user.orgId),
  ])
  if (!issue) notFound()

  // Fetch doc types specific to the vendor's category
  const docTypes = await getVendorDocumentTypes(user.orgId, issue.vendor_id)

  const boundUpdate = updateIssueAction.bind(null, id)
  const boundNote = addIssueNoteAction.bind(null, id)
  const boundUploadEvidence = uploadEvidenceAction.bind(null, id)

  return (
    <div className="px-6 py-5 max-w-4xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs" style={{ color: '#8b7fd4' }}>
        <Link href="/issues" className="hover:underline">Issues</Link>
        <span>›</span>
        <span style={{ color: '#1e1550' }}>{issue.title}</span>
      </div>

      <IssueDetailClient
        issue={issue}
        orgUsers={orgUsers}
        docTypes={docTypes}
        updateAction={boundUpdate}
        noteAction={boundNote}
        uploadEvidenceAction={boundUploadEvidence}
        reviewEvidenceAction={reviewEvidenceAction}
        deleteEvidenceAction={deleteEvidenceAction}
        changeStatusAction={changeIssueStatusAction}
        promoteEvidenceAction={promoteEvidenceAction}
      />
    </div>
  )
}
