import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { SidebarShell } from './_components/SidebarShell'
import { NavigationProgress } from './_components/NavigationProgress'
import { getCurrentUser } from '@/lib/current-user'
import sql from '@/lib/db/pool'
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

    // Direct Postgres — both queries pipelined on one connection
    const [userRows, orgRows] = await Promise.all([
      sql<{ name: string | null; email: string | null }[]>`
        SELECT name, email FROM users WHERE id = ${currentUser.userId} LIMIT 1
      `,
      sql<{ name: string | null }[]>`
        SELECT name FROM organizations WHERE id = ${currentUser.orgId} LIMIT 1
      `,
    ])

    return {
      email: userRows[0]?.email ?? null,
      name: userRows[0]?.name ?? null,
      orgName: orgRows[0]?.name ?? null,
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
