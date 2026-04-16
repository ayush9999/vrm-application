import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendorById } from '@/lib/db/vendors'
import { getVendorReviewItems } from '@/lib/db/review-packs'
import { createServerClient } from '@/lib/supabase/server'
import { ReviewPackClient } from './_components/ReviewPackClient'
import { setReviewItemDecisionAction, aiAssistReviewItemAction } from './actions'

interface PageProps {
  params: Promise<{ id: string; packId: string }>
}

export default async function ReviewPackDetailPage({ params }: PageProps) {
  const { id: vendorId, packId } = await params
  const user = await requireCurrentUser()

  const vendor = await getVendorById(user.orgId, vendorId)
  if (!vendor) notFound()

  // Fetch the vendor_review_pack + parent review_pack
  const supabase = await createServerClient()
  const { data: vrp } = await supabase
    .from('vendor_review_packs')
    .select(`
      *,
      review_packs!inner ( id, name, code, description )
    `)
    .eq('id', packId)
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!vrp) notFound()

  const items = await getVendorReviewItems(packId)
  const pack = (vrp as { review_packs: { id: string; name: string; code: string | null; description: string | null } }).review_packs

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-1.5 text-xs" style={{ color: '#a99fd8' }}>
        <Link href="/vendors" className="hover:text-[#6c5dd3]" style={{ color: '#a99fd8' }}>Vendors</Link>
        <span>/</span>
        <Link href={`/vendors/${vendorId}`} className="hover:text-[#6c5dd3]" style={{ color: '#a99fd8' }}>{vendor.name}</Link>
        <span>/</span>
        <Link href={`/vendors/${vendorId}?tab=reviews`} className="hover:text-[#6c5dd3]" style={{ color: '#a99fd8' }}>Reviews</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: '#1e1550' }}>{pack.name}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>{pack.name}</h1>
        {pack.description && (
          <p className="text-sm mt-1" style={{ color: '#a99fd8' }}>{pack.description}</p>
        )}
      </div>

      <ReviewPackClient
        vendorId={vendorId}
        packId={packId}
        items={items}
        setDecisionAction={setReviewItemDecisionAction}
        aiAssistAction={aiAssistReviewItemAction}
      />
    </div>
  )
}
