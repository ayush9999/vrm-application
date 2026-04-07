import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import { SidebarNav } from './_components/SidebarNav'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VRM — Vendor Management',
  description: 'Vendor Management SaaS',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}>
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside
            className="w-56 shrink-0 flex flex-col relative overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #17172a 0%, #111120 35%, #0d0d18 100%)',
              borderRight: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            {/* Subtle ambient glow */}
            <div
              className="pointer-events-none absolute top-0 left-0 right-0"
              style={{
                height: '180px',
                background: 'radial-gradient(ellipse 100% 50% at 50% 0%, rgba(99,102,241,0.1) 0%, transparent 70%)',
              }}
            />

            {/* Logo */}
            <div className="relative h-14 flex items-center px-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <Link href="/vendors" className="flex items-center gap-2.5">
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold tracking-tight"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    boxShadow: '0 0 16px rgba(99,102,241,0.5), 0 0 0 1px rgba(99,102,241,0.3)',
                  }}
                >
                  VRM
                </span>
                <span className="font-semibold text-white text-sm tracking-tight">Vendor Risk</span>
              </Link>
            </div>

            {/* Nav */}
            <SidebarNav />

            {/* Footer */}
            <div className="relative p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md"
                style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-xs text-amber-400 font-medium">Dev mode</span>
              </span>
            </div>
          </aside>

          {/* Main content — aurora + dot grid */}
          <main
            className="flex-1 overflow-auto"
            style={{
              backgroundColor: '#ecedf2',
              backgroundImage: [
                'radial-gradient(ellipse 60% 45% at 80% 0%, rgba(99,102,241,0.055) 0%, transparent 65%)',
                'radial-gradient(rgba(0,0,0,0.028) 1.5px, transparent 1.5px)',
              ].join(', '),
              backgroundSize: 'auto, 20px 20px',
            }}
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
