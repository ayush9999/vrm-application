import Link from 'next/link'
import { requireCurrentUser } from '@/lib/current-user'
import { getCachedDashboardData } from '@/lib/db/cached'
import { getProgrammeHealth, getPackReadiness, getAttentionItems } from '@/lib/db/dashboard'
import { GaugeChart, RadarChart } from './_components/DashboardCharts'
import { InfoPopover } from './_components/InfoPopover'
import { DashboardTileModal } from './_components/DashboardTileModal'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  return `${months} month${months === 1 ? '' : 's'} ago`
}

function barColor(pct: number) {
  if (pct >= 60) return '#639922'
  if (pct >= 30) return '#EF9F27'
  return '#E24B4A'
}

const BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  red: { bg: '#FCEBEB', color: '#A32D2D' },
  amber: { bg: '#FAEEDA', color: '#854F0B' },
  blue: { bg: '#E6F1FB', color: '#185FA5' },
}

const RISK_BADGE: Record<string, { bg: string; color: string }> = {
  critical: { bg: '#FCEBEB', color: '#A32D2D' },
  high: { bg: '#FAEEDA', color: '#854F0B' },
  medium: { bg: '#E6F1FB', color: '#185FA5' },
  low: { bg: '#EAF3DE', color: '#3B6D11' },
}

const BAND_BADGE: Record<string, { bg: string; color: string }> = {
  critical: { bg: '#FCEBEB', color: '#A32D2D' },
  high: { bg: '#FCEBEB', color: '#A32D2D' },
  medium: { bg: '#FAEEDA', color: '#854F0B' },
  low: { bg: '#EAF3DE', color: '#3B6D11' },
}

function activityChip(entityType: string, action: string) {
  const key = `${entityType}/${action}`
  if (entityType === 'issue' || action.startsWith('remediation') || key.includes('issue'))
    return { code: 'REM', bg: '#FCEBEB', color: '#A32D2D' }
  if (entityType === 'document' || entityType === 'evidence' || action.includes('evidence'))
    return { code: 'DOC', bg: '#FAEEDA', color: '#854F0B' }
  if (entityType === 'review' || action.includes('review'))
    return { code: 'REV', bg: '#E6F1FB', color: '#185FA5' }
  if (entityType === 'approval' || action.includes('approval'))
    return { code: 'APV', bg: '#EAF3DE', color: '#3B6D11' }
  if (entityType === 'vendor')
    return { code: 'VND', bg: '#EEEDFE', color: '#534AB7' }
  if (entityType === 'incident')
    return { code: 'INC', bg: '#F1EFE8', color: '#5F5E5A' }
  return { code: 'ACT', bg: '#F1EFE8', color: '#5F5E5A' }
}

const AVATAR_COLORS = [
  { bg: '#EEEDFE', color: '#534AB7' },
  { bg: '#E1F5EE', color: '#0F6E56' },
]

const ghostButtonStyle = {
  fontSize: 12,
  padding: '7px 14px',
  borderRadius: 8,
  border: '1px solid #eceae4',
  background: 'transparent',
  color: '#6a6860',
}

const cardStyle = {
  background: 'white',
  border: '1px solid #e8e5de',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default async function DashboardPage() {
  const user = await requireCurrentUser()
  const [data, health, packReadiness, attentionItems] = await Promise.all([
    getCachedDashboardData(user.orgId),
    getProgrammeHealth(user.orgId),
    getPackReadiness(user.orgId),
    getAttentionItems(user.orgId),
  ])

  const sortedPacks = [...packReadiness].sort((a, b) => b.readinessPct - a.readinessPct)

  return (
    <div style={{ background: '#f9f8f6', minHeight: '100vh' }}>
      {/* ── Topbar ── */}
      <div
        style={{ background: 'white', borderBottom: '1px solid #eceae4', padding: '14px 28px' }}
        className="flex items-center justify-between"
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 500, color: '#18181b', letterSpacing: '-0.01em' }}>
            Dashboard
          </div>
          <div style={{ fontSize: 11, color: '#9a9890', marginTop: 2 }}>
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/vendors/new/wizard"
            className="inline-flex items-center"
            style={ghostButtonStyle}
          >
            Guided setup
          </Link>
          <Link
            href="/issues"
            className="inline-flex items-center"
            style={ghostButtonStyle}
          >
            View remediation
          </Link>
          <Link
            href="/vendors/new"
            className="inline-flex items-center"
            style={{
              background: '#18181b',
              color: '#f4f4f5',
              fontSize: 12,
              padding: '7px 14px',
              borderRadius: 8,
              border: 'none',
            }}
          >
            + Add vendor
          </Link>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: '22px 28px' }} className="space-y-2.5">
        {/* ── KPI Row ── */}
        <div className="grid grid-cols-4 gap-2.5">
          <KpiCard
            label="TOTAL VENDORS"
            value={data.totals.vendors}
            valueColor="#18181b"
            iconBg="#F1EFE8"
            icon={<BuildingIcon />}
            href="/vendors"
          />
          <KpiCard
            label="CRITICAL VENDORS"
            value={data.totals.criticalVendors}
            valueColor="#BA7517"
            iconBg="#FAEEDA"
            icon={<TriangleWarningIcon />}
            href="/vendors?critical=true"
          />
          <KpiCard
            label="OPEN REMEDIATIONS"
            value={data.operational.openRemediations}
            valueColor="#A32D2D"
            iconBg="#FCEBEB"
            icon={<CircleInfoIcon />}
            href="/issues"
          />
          <KpiCard
            label="REVIEWS DUE"
            value={data.operational.reviewsDueThisMonth}
            valueColor="#185FA5"
            iconBg="#E6F1FB"
            icon={<CalendarIcon />}
            href="/reviews?filter=due"
          />
        </div>

        {/* ── Main 3-col Grid ── */}
        <div className="grid gap-2.5" style={{ gridTemplateColumns: '1fr 1fr 1.1fr' }}>
          {/* Column 1: Programme Health */}
          <DashboardTileModal type="programme" health={health}>
          <div style={{ ...cardStyle, cursor: 'pointer', height: '100%' }} className="flex flex-col transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between" style={{ padding: '14px 18px 0' }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9a9890' }}>
                  Programme health
                </span>
                <InfoPopover title="Programme Health">
                  <p style={{ marginBottom: 8 }}>
                    A single score (0–100) measuring how healthy your vendor risk programme is.
                  </p>
                  <p style={{ fontWeight: 600, color: '#1e1550', marginBottom: 4 }}>How it&apos;s calculated:</p>
                  <ul style={{ paddingLeft: 16, marginBottom: 8, listStyleType: 'disc' }}>
                    <li>35% — Evidence documents approved</li>
                    <li>35% — Review packs completed</li>
                    <li>30% — Vendors approved</li>
                    <li>Minus up to 20 pts for open critical remediations</li>
                  </ul>
                  <p style={{ fontWeight: 600, color: '#1e1550', marginBottom: 4 }}>Bands:</p>
                  <ul style={{ paddingLeft: 16, listStyleType: 'disc' }}>
                    <li><strong style={{ color: '#A32D2D' }}>0–30 Critical</strong></li>
                    <li><strong style={{ color: '#BA7517' }}>31–60 High</strong></li>
                    <li><strong style={{ color: '#a16207' }}>61–85 Medium</strong></li>
                    <li><strong style={{ color: '#3B6D11' }}>86–100 Low</strong></li>
                  </ul>
                </InfoPopover>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  padding: '3px 8px',
                  borderRadius: 20,
                  background: BAND_BADGE[health.band].bg,
                  color: BAND_BADGE[health.band].color,
                }}
              >
                {health.band}
              </span>
            </div>

            {/* Gauge chart area */}
            <div className="flex flex-col items-center" style={{ padding: '12px 18px 0', position: 'relative' }}>
              <div style={{ position: 'relative' }}>
                <GaugeChart score={health.score} bandColor={health.bandColor} />
                {/* Center overlay */}
                <div
                  className="flex flex-col items-center"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -30%)',
                  }}
                >
                  <span style={{ fontSize: 30, fontWeight: 500, color: '#18181b', lineHeight: 1 }}>
                    {health.score}
                  </span>
                  <span style={{ fontSize: 11, color: '#9a9890', marginTop: 2 }}>out of 100</span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 500,
                      padding: '2px 7px',
                      borderRadius: 20,
                      marginTop: 4,
                      background: BAND_BADGE[health.band].bg,
                      color: BAND_BADGE[health.band].color,
                    }}
                  >
                    {health.band}
                  </span>
                </div>
              </div>
            </div>

            {/* Band meaning + next step */}
            {(() => {
              const bandMeaning: Record<string, string> = {
                critical: 'Programme needs urgent attention',
                high: 'Significant gaps remain',
                medium: 'Making progress, room to improve',
                low: 'Strong programme health',
              }
              const nextThresholds: Record<string, { next: number; nextBand: string }> = {
                critical: { next: 31, nextBand: 'High' },
                high:     { next: 61, nextBand: 'Medium' },
                medium:   { next: 86, nextBand: 'Low' },
                low:      { next: 100, nextBand: 'perfect' },
              }
              const nt = nextThresholds[health.band]
              const pointsNeeded = Math.max(0, nt.next - health.score)
              return (
                <div className="flex-1 flex flex-col justify-end" style={{ padding: '6px 18px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#6a6860', marginBottom: 2 }}>
                    {bandMeaning[health.band]}
                  </div>
                  {pointsNeeded > 0 && health.band !== 'low' && (
                    <div style={{ fontSize: 10, color: '#9a9890' }}>
                      +{pointsNeeded} pts to reach <strong style={{ color: '#6c5dd3' }}>{nt.nextBand}</strong>
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: '#a99fd8', marginTop: 8 }}>
                    Click for breakdown &rsaquo;
                  </div>
                </div>
              )
            })()}
          </div>
          </DashboardTileModal>

          {/* Column 2: Pack Readiness Radar */}
          <DashboardTileModal type="radar" packReadiness={packReadiness}>
          <div style={{ ...cardStyle, cursor: 'pointer', height: '100%' }} className="flex flex-col transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between" style={{ padding: '14px 18px 0' }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9a9890' }}>
                  Pack readiness
                </span>
                <InfoPopover title="Pack Readiness">
                  <p style={{ marginBottom: 8 }}>
                    A spider chart showing how ready each review pack is across all assigned vendors.
                  </p>
                  <p style={{ marginBottom: 8 }}>
                    Each axis represents one review pack (e.g. Security, Legal &amp; Contract). The further the dot is from the centre, the higher the readiness.
                  </p>
                  <p style={{ fontWeight: 600, color: '#1e1550', marginBottom: 4 }}>Readiness per pack =</p>
                  <p style={{ marginBottom: 8 }}>
                    Passed items + approved evidence, divided by total applicable items across all vendors with that pack.
                  </p>
                  <p style={{ fontSize: 11, color: '#8b7fd4' }}>
                    Dot colour: <strong style={{ color: '#3B6D11' }}>green</strong> ≥60%,{' '}
                    <strong style={{ color: '#BA7517' }}>amber</strong> 30–59%,{' '}
                    <strong style={{ color: '#A32D2D' }}>red</strong> &lt;30%
                  </p>
                </InfoPopover>
              </div>
              <span style={{ fontSize: 11, color: '#9a9890' }}>
                {packReadiness.length} pack{packReadiness.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex-1 flex items-center justify-center" style={{ padding: '12px 18px' }}>
              {packReadiness.length < 3 ? (
                <div style={{ fontSize: 12, color: '#9a9890', textAlign: 'center', padding: '24px 0' }}>
                  Radar chart requires at least 3 packs.
                  <br />
                  Currently {packReadiness.length} pack{packReadiness.length !== 1 ? 's' : ''} configured.
                </div>
              ) : (
                <RadarChart
                  labels={packReadiness.map((p) => p.packName)}
                  data={packReadiness.map((p) => p.readinessPct)}
                />
              )}
            </div>

            <div
              style={{
                borderTop: '1px solid #eceae4',
                padding: '10px 18px',
                fontSize: 11,
                color: '#9a9890',
                textAlign: 'center',
              }}
            >
              Each axis = a review pack &middot; distance from centre = readiness %
            </div>
          </div>
          </DashboardTileModal>

          {/* Column 3: Readiness by review pack (horizontal bars) */}
          <DashboardTileModal type="bars" packReadiness={packReadiness}>
          <div style={{ ...cardStyle, cursor: 'pointer', height: '100%' }} className="flex flex-col transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between" style={{ padding: '14px 18px 0' }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9a9890' }}>
                  Readiness by review pack
                </span>
                <InfoPopover title="Readiness by Pack">
                  <p style={{ marginBottom: 8 }}>
                    The same data as the spider chart, shown as horizontal bars sorted highest to lowest.
                  </p>
                  <p style={{ marginBottom: 8 }}>
                    Each bar shows the <strong>average readiness</strong> of a pack across every vendor that has it assigned.
                  </p>
                  <p style={{ fontSize: 11, color: '#8b7fd4' }}>
                    Use this to spot which packs need the most attention. Low bars = many vendors behind on that pack.
                  </p>
                </InfoPopover>
              </div>
            </div>

            <div style={{ padding: '10px 0' }} className="flex-1">
              {sortedPacks.length === 0 ? (
                <div style={{ fontSize: 12, color: '#9a9890', textAlign: 'center', padding: 24 }}>
                  No review packs configured yet.
                </div>
              ) : (
                sortedPacks.map((pack) => (
                  <div
                    key={pack.packCode ?? pack.packName}
                    className="flex items-center gap-2"
                    style={{ padding: '7px 16px' }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: '#6a6860',
                        width: 80,
                        textAlign: 'right',
                        flexShrink: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {pack.packName}
                    </span>
                    <div
                      className="flex-1"
                      style={{ height: 18, background: '#F1EFE8', borderRadius: 3, overflow: 'hidden' }}
                    >
                      <div
                        className="flex items-center justify-end"
                        style={{
                          height: '100%',
                          borderRadius: 3,
                          minWidth: 32,
                          width: `${Math.max(pack.readinessPct, 8)}%`,
                          background: pack.readinessPct >= 60 ? '#378ADD' : pack.readinessPct >= 30 ? '#EF9F27' : '#E24B4A',
                          paddingRight: 6,
                        }}
                      >
                        <span style={{ fontSize: 10, fontWeight: 500, color: 'white' }}>
                          {pack.readinessPct}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          </DashboardTileModal>
        </div>

        {/* ── Attention Section ── */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6a6860', marginBottom: 8 }}>
            Needs your attention
          </div>
          <div style={cardStyle}>
            {attentionItems.map((item, i) => {
              const badge = BADGE_STYLES[item.badgeStyle] ?? BADGE_STYLES.blue
              const inner = (
                <div
                  className="flex items-center gap-3"
                  style={{
                    padding: '12px 18px',
                    borderBottom: i < attentionItems.length - 1 ? '1px solid #eceae4' : 'none',
                    cursor: item.href ? 'pointer' : 'default',
                  }}
                >
                  {/* Colored line */}
                  <div style={{ width: 2, height: 34, borderRadius: 1, background: item.lineColor, flexShrink: 0 }} />

                  {/* Body */}
                  <div className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#18181b' }}>{item.title}</span>
                    {item.subtitle && (
                      <span
                        style={{
                          fontSize: 11,
                          color: '#9a9890',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.subtitle}
                      </span>
                    )}
                  </div>

                  {/* Badge */}
                  {item.badgeLabel && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        padding: '3px 8px',
                        borderRadius: 20,
                        background: badge.bg,
                        color: badge.color,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.badgeLabel}
                    </span>
                  )}

                  {/* Arrow */}
                  {item.href && (
                    <span style={{ fontSize: 14, color: '#9a9890', flexShrink: 0 }}>&rsaquo;</span>
                  )}
                </div>
              )

              if (item.href) {
                return (
                  <Link key={`${item.type}-${i}`} href={item.href} className="block hover:bg-[#fafaf8] transition-colors">
                    {inner}
                  </Link>
                )
              }
              return <div key={`${item.type}-${i}`}>{inner}</div>
            })}
          </div>
        </div>

        {/* ── Bottom Grid ── */}
        <div className="grid gap-2.5" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
          {/* Left: Vendor Risk Overview */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6a6860', marginBottom: 8 }}>
              Vendor risk overview
            </div>
            <div style={cardStyle}>
              {/* Card header */}
              <div className="flex items-center justify-between" style={{ padding: '14px 18px', borderBottom: '1px solid #eceae4' }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#18181b' }}>Ranked by risk</span>
                <Link href="/vendors" style={{ fontSize: 11, color: '#9a9890' }}>
                  View all &rarr;
                </Link>
              </div>

              {data.highRiskVendors.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#9a9890' }}>
                  No high-risk vendors at this time.
                </div>
              ) : (
                data.highRiskVendors.slice(0, 6).map((v, i) => {
                  const riskStyle = RISK_BADGE[v.riskBand] ?? RISK_BADGE.critical
                  const avatarStyle = AVATAR_COLORS[i % AVATAR_COLORS.length]
                  const initials = v.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase() ?? '')
                    .join('') || '\u2014'
                  const fillColor = barColor(v.readinessPct)
                  const fillWidth = Math.max(v.readinessPct, 4)

                  return (
                    <Link
                      key={v.id}
                      href={`/vendors/${v.id}`}
                      className="flex items-center gap-3 hover:bg-[#fafaf8] transition-colors"
                      style={{
                        padding: '10px 18px',
                        borderBottom: i < Math.min(data.highRiskVendors.length, 6) - 1 ? '1px solid #eceae4' : 'none',
                      }}
                    >
                      {/* Avatar */}
                      <div
                        className="flex items-center justify-center shrink-0"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          fontSize: 10,
                          fontWeight: 600,
                          background: avatarStyle.bg,
                          color: avatarStyle.color,
                        }}
                      >
                        {initials}
                      </div>

                      {/* Vendor info */}
                      <div className="flex-1 min-w-0">
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {v.name}
                        </div>
                      </div>

                      {/* Readiness bar */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div style={{ width: 52, height: 3, background: '#F1EFE8', borderRadius: 2 }}>
                          <div style={{ width: `${fillWidth}%`, height: '100%', borderRadius: 2, background: fillColor }} />
                        </div>
                        <span style={{ fontSize: 11, width: 28, textAlign: 'right', color: fillColor }}>
                          {v.readinessPct}%
                        </span>
                      </div>

                      {/* Risk badge */}
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          padding: '3px 8px',
                          borderRadius: 20,
                          background: riskStyle.bg,
                          color: riskStyle.color,
                          textTransform: 'capitalize',
                          flexShrink: 0,
                        }}
                      >
                        {v.riskBand}
                      </span>
                    </Link>
                  )
                })
              )}
            </div>
          </div>

          {/* Right: Recent Activity */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6a6860', marginBottom: 8 }}>
              Recent activity
            </div>
            <div style={cardStyle}>
              {data.recentActivity.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#9a9890' }}>
                  No activity yet.
                </div>
              ) : (
                data.recentActivity.slice(0, 6).map((entry, i) => {
                  const chip = activityChip(entry.entity_type, entry.action)
                  const relTime = formatRelativeTime(entry.created_at)

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3"
                      style={{
                        padding: '10px 18px',
                        borderBottom: i < Math.min(data.recentActivity.length, 6) - 1 ? '1px solid #eceae4' : 'none',
                      }}
                    >
                      {/* Chip avatar */}
                      <div
                        className="flex items-center justify-center shrink-0"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          fontSize: 9,
                          fontWeight: 600,
                          background: chip.bg,
                          color: chip.color,
                        }}
                      >
                        {chip.code}
                      </div>

                      {/* Event info */}
                      <div className="flex-1 min-w-0">
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.title ?? entry.action.replace(/_/g, ' ')}
                        </div>
                        <div style={{ fontSize: 11, color: '#9a9890', marginTop: 1 }}>
                          {entry.actor_name ? `${entry.actor_name} \u00b7 ` : ''}{relTime}
                        </div>
                      </div>

                      {/* Relative time on right */}
                      <span style={{ fontSize: 11, color: '#9a9890', flexShrink: 0 }}>
                        {relTime}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function KpiCard({
  label,
  value,
  valueColor,
  iconBg,
  icon,
  href,
}: {
  label: string
  value: number
  valueColor: string
  iconBg: string
  icon: React.ReactNode
  href?: string
}) {
  const content = (
    <>
      <div className="flex items-start justify-between">
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#78756d' }}>
          {label}
        </span>
        <div
          className="flex items-center justify-center"
          style={{ width: 30, height: 30, borderRadius: 8, background: iconBg }}
        >
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 36, fontWeight: 600, lineHeight: 1, letterSpacing: '-0.02em', color: valueColor, marginTop: 12 }}>
        {value}
      </div>
    </>
  )

  const cardStyle = { background: 'white', border: '1px solid #e8e5de', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }

  if (href) {
    return (
      <Link href={href} className="block transition-all hover:shadow-md hover:-translate-y-0.5" style={cardStyle}>
        {content}
      </Link>
    )
  }
  return <div style={cardStyle}>{content}</div>
}

/* ── Inline SVG icons ── */

function BuildingIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2 12.5V2.5C2 2.22 2.22 2 2.5 2H7.5C7.78 2 8 2.22 8 2.5V12.5M8 5H11.5C11.78 5 12 5.22 12 5.5V12.5M5 4.5H5.5M5 6.5H5.5M5 8.5H5.5M5 10.5H5.5M10 7.5H10.5M10 9.5H10.5M1 12.5H13"
        stroke="#6a6860"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TriangleWarningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M7 5V7.5M7 9.5H7.005M6.134 2.5L1.634 10.5C1.5 10.73 1.5 11 1.634 11.23C1.768 11.46 2 11.6 2.268 11.6H11.732C12 11.6 12.232 11.46 12.366 11.23C12.5 11 12.5 10.73 12.366 10.5L7.866 2.5C7.732 2.27 7.5 2.13 7.232 2.13C6.964 2.13 6.732 2.27 6.598 2.5H6.134Z"
        stroke="#BA7517"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CircleInfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7" cy="7" r="5.5" stroke="#A32D2D" strokeWidth="0.8" />
      <path d="M7 6V9.5M7 4.5V5" stroke="#A32D2D" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="2.5" width="11" height="9.5" rx="1" stroke="#185FA5" strokeWidth="0.8" />
      <path d="M1.5 5.5H12.5M4.5 1.5V3.5M9.5 1.5V3.5" stroke="#185FA5" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  )
}
