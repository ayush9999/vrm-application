import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { SidebarShell } from './_components/SidebarShell'
import { NavigationProgress } from './_components/NavigationProgress'
import { getCurrentUser } from '@/lib/current-user'
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
 * Reuses getCurrentUser() (React cached) so the auth.getUser() + users
 * lookup is shared with the page component — no duplicate round-trips.
 * Returns null if there's no session — SidebarShell hides itself in that case.
 */
async function getSidebarUser(): Promise<SidebarUser | null> {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) return null

    const supabase = await createServerClient()
    // Only fetch the extra sidebar fields — auth + user lookup is already done
    const [{ data: userRow }, { data: org }] = await Promise.all([
      supabase.from('users').select('name, email').eq('id', currentUser.userId).maybeSingle(),
      supabase.from('organizations').select('name').eq('id', currentUser.orgId).maybeSingle(),
    ])

    return {
      email: userRow?.email ?? null,
      name: userRow?.name ?? null,
      orgName: org?.name ?? null,
    }
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
