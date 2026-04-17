import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { SidebarShell } from './_components/SidebarShell'
import { NavigationProgress } from './_components/NavigationProgress'
import { createServerClient } from '@/lib/supabase/server'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VRM — Vendor Management',
  description: 'Vendor Management SaaS',
}

interface SidebarUser {
  email: string | null
  name: string | null
  orgName: string | null
}

/**
 * Fetches the minimal user/org info needed by the sidebar UserMenu.
 * Returns null if there's no session — SidebarShell hides itself in that case.
 * Errors are swallowed so the layout never throws (e.g. mid-signup edge cases).
 */
async function getSidebarUser(): Promise<SidebarUser | null> {
  try {
    const supabase = await createServerClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    if (!authUser) return null

    const { data: row } = await supabase
      .from('users')
      .select('name, email, org_id')
      .eq('id', authUser.id)
      .maybeSingle()
    if (!row) return null

    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', row.org_id)
      .maybeSingle()

    return { email: row.email, name: row.name, orgName: org?.name ?? null }
  } catch {
    return null
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSidebarUser()

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}>
        <NavigationProgress />
        <SidebarShell user={user}>{children}</SidebarShell>
      </body>
    </html>
  )
}
