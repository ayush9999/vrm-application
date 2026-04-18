import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Pings Supabase every 5 minutes to keep the database warm.
 * Called by Vercel Cron. Prevents the 2-5 second cold-start penalty
 * on the first request after idle.
 */
export async function GET() {
  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from('organizations').select('id').limit(1)
    return Response.json({ ok: true, error: error?.message ?? null, ts: new Date().toISOString() })
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
