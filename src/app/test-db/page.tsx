import { createServerClient } from '@/lib/supabase/server'

export default async function TestDbPage() {
  const supabase = createServerClient()
  const { data: organizations, error } = await supabase
    .from('organizations')
    .select('*')

  return (
    <main style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>Database Connection Test</h1>
      <h2>Table: organizations</h2>

      {error && (
        <div style={{ color: 'red' }}>
          <strong>Error:</strong> {error.message}
        </div>
      )}

      {!error && organizations && organizations.length === 0 && (
        <p>No rows found — table is empty but connection succeeded.</p>
      )}

      {!error && organizations && organizations.length > 0 && (
        <pre style={{ background: '#f4f4f4', padding: '1rem', borderRadius: '4px' }}>
          {JSON.stringify(organizations, null, 2)}
        </pre>
      )}
    </main>
  )
}
