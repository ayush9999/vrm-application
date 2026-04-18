/**
 * pool.ts — Direct Postgres connection pool via Supabase's pgBouncer.
 *
 * Use this for all server-side data reads instead of the Supabase JS client.
 * The Supabase JS client wraps every query in an HTTP REST request (PostgREST),
 * adding ~100-200ms per query. A direct Postgres connection does the same
 * query in ~2-5ms over a persistent TCP connection.
 *
 * Keep using the Supabase JS client (@supabase/ssr) only for:
 *   - Auth (sign-in, sign-up, session refresh in proxy.ts)
 *   - Storage (file uploads/downloads)
 *   - Realtime subscriptions
 *
 * Setup:
 *   1. Go to Supabase Dashboard → Settings → Database → Connection string
 *   2. Check "Use connection pooling" (Transaction mode)
 *   3. Copy the URI and set it as DATABASE_URL in your .env.local
 *
 * The pooler URL looks like:
 *   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 */

import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is required. Get it from Supabase Dashboard → Settings → Database → Connection string (with connection pooling enabled).',
  )
}

const sql = postgres(connectionString, {
  // pgBouncer in transaction mode doesn't support prepared statements
  prepare: false,

  // Supabase requires SSL
  ssl: 'require',

  // Max connections in the local pool (Vercel serverless: keep low)
  max: 5,

  // Idle connection timeout (seconds)
  idle_timeout: 20,

  // Connection timeout (seconds)
  connect_timeout: 10,
})

export default sql
