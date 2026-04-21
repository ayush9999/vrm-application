import Link from 'next/link'
import { requireCurrentUser } from '@/lib/current-user'
import { getAttentionItems } from '@/lib/db/dashboard'
import type { AttentionItem } from '@/lib/db/dashboard'

const BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  red: { bg: '#FCEBEB', color: '#A32D2D' },
  amber: { bg: '#FAEEDA', color: '#854F0B' },
  blue: { bg: '#E6F1FB', color: '#185FA5' },
}

export default async function AttentionCenterPage() {
  const user = await requireCurrentUser()
  const items = await getAttentionItems(user.orgId)
  const realItems = items.filter((i) => i.type !== 'empty')

  const grouped = {
    red: realItems.filter((i) => i.badgeStyle === 'red'),
    amber: realItems.filter((i) => i.badgeStyle === 'amber'),
    blue: realItems.filter((i) => i.badgeStyle === 'blue'),
  }

  return (
    <div className="px-6 py-5 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-1.5 text-xs" style={{ color: '#a99fd8' }}>
        <Link href="/" className="hover:text-[#6c5dd3]" style={{ color: '#a99fd8' }}>Dashboard</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: '#1e1550' }}>Attention Center</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>Attention Center</h1>
        <p className="text-sm mt-1" style={{ color: '#8b7fd4' }}>
          {realItems.length === 0
            ? 'All caught up — nothing needs your attention right now.'
            : `${realItems.length} item${realItems.length === 1 ? '' : 's'} need${realItems.length === 1 ? 's' : ''} your attention across your vendor programme.`}
        </p>
      </div>

      {/* Empty state */}
      {realItems.length === 0 && (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}
        >
          <div
            className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
            style={{ background: 'rgba(5,150,105,0.08)' }}
          >
            <svg width="26" height="26" viewBox="0 0 16 16" fill="none" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8.5l3.5 3.5 6.5-8" />
            </svg>
          </div>
          <p className="text-sm font-medium" style={{ color: '#059669' }}>All caught up</p>
          <p className="text-xs mt-1" style={{ color: '#8b7fd4' }}>No items need your attention right now.</p>
        </div>
      )}

      {/* Groups */}
      {realItems.length > 0 && (
        <div className="space-y-5">
          {grouped.red.length > 0 && (
            <Group title="Action needed" count={grouped.red.length} color="#A32D2D" items={grouped.red} />
          )}
          {grouped.amber.length > 0 && (
            <Group title="Expiring or due soon" count={grouped.amber.length} color="#854F0B" items={grouped.amber} />
          )}
          {grouped.blue.length > 0 && (
            <Group title="Pending" count={grouped.blue.length} color="#185FA5" items={grouped.blue} />
          )}
        </div>
      )}
    </div>
  )
}

function Group({ title, count, color, items }: { title: string; count: number; color: string; items: AttentionItem[] }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold" style={{ color: '#1e1550' }}>{title}</h2>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${color}15`, color }}
        >
          {count}
        </span>
      </div>
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 1px 4px rgba(109,93,211,0.04)' }}
      >
        {items.map((item, i) => {
          const badge = BADGE_STYLES[item.badgeStyle] ?? BADGE_STYLES.blue
          const inner = (
            <div
              className="flex items-start gap-3 px-4 py-4 transition-colors hover:bg-[rgba(109,93,211,0.02)]"
              style={{
                borderBottom: i < items.length - 1 ? '1px solid rgba(109,93,211,0.06)' : 'none',
                cursor: item.href ? 'pointer' : 'default',
              }}
            >
              <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: item.lineColor, flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 14, fontWeight: 500, color: '#1e1550', lineHeight: 1.4 }}>
                  {item.title}
                </div>
                {item.subtitle && (
                  <div style={{ fontSize: 12, color: '#8b7fd4', marginTop: 4, lineHeight: 1.5 }}>
                    {item.subtitle}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {item.badgeLabel && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: 20,
                      background: badge.bg,
                      color: badge.color,
                      whiteSpace: 'nowrap',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    {item.badgeLabel}
                  </span>
                )}
                {item.href && (
                  <span style={{ fontSize: 14, color: '#a99fd8' }}>›</span>
                )}
              </div>
            </div>
          )

          if (item.href) {
            return (
              <Link key={`${item.type}-${i}`} href={item.href} className="block">
                {inner}
              </Link>
            )
          }
          return <div key={`${item.type}-${i}`}>{inner}</div>
        })}
      </div>
    </section>
  )
}
