import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendorById } from '@/lib/db/vendors'
import { createServerClient } from '@/lib/supabase/server'
import { CompareClient } from './_components/CompareClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CompareReviewsPage({ params }: PageProps) {
  const { id: vendorId } = await params
  const user = await requireCurrentUser()

  const vendor = await getVendorById(user.orgId, vendorId)
  if (!vendor) notFound()

  const supabase = await createServerClient()

  // Get all completed review packs for this vendor
  const { data: vrps } = await supabase
    .from('vendor_review_packs')
    .select(`
      id, status, completed_at,
      review_packs!inner ( id, name, code )
    `)
    .eq('vendor_id', vendorId)
    .eq('org_id', user.orgId)
    .in('status', ['approved', 'approved_with_exception', 'locked'])
    .is('deleted_at', null)
    .order('completed_at', { ascending: false })

  type VrpRow = {
    id: string
    status: string
    completed_at: string | null
    review_packs: { id: string; name: string; code: string | null } | { id: string; name: string; code: string | null }[] | null
  }
  const completedVrps = ((vrps ?? []) as unknown as VrpRow[]).map((v) => {
    const rp = Array.isArray(v.review_packs) ? v.review_packs[0] : v.review_packs
    return {
      id: v.id,
      status: v.status,
      completed_at: v.completed_at,
      pack_name: rp?.name ?? 'Unknown',
      pack_code: rp?.code ?? null,
      pack_id: rp?.id ?? '',
    }
  })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-5 flex items-center gap-1.5 text-xs" style={{ color: '#a99fd8' }}>
        <Link href="/vendors" className="hover:text-[#6c5dd3]">Vendors</Link>
        <span>/</span>
        <Link href={`/vendors/${vendorId}`} className="hover:text-[#6c5dd3]">{vendor.name}</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: '#1e1550' }}>Compare Reviews</span>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight mb-6" style={{ color: '#1e1550' }}>
        Compare Reviews — {vendor.name}
      </h1>

      {completedVrps.length < 2 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'white', border: '1.5px dashed rgba(109,93,211,0.2)' }}>
          <p className="text-sm font-medium" style={{ color: '#1e1550' }}>Need at least 2 completed reviews to compare.</p>
          <p className="text-xs mt-1" style={{ color: '#a99fd8' }}>
            Complete a review pack and come back here.
          </p>
        </div>
      ) : (
        <CompareClient vendorId={vendorId} completedVrps={completedVrps} />
      )}
    </div>
  )
}
