'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GaugeChartLarge, RadarChartLarge } from './DashboardCharts'

export type TileType = 'programme' | 'radar' | 'bars'

interface ProgrammeHealthData {
  score: number
  band: 'critical' | 'high' | 'medium' | 'low'
  bandColor: string
  evidenceCompletePct: number
  reviewsCompletePct: number
  vendorsApprovedPct: number
}

interface PackReadinessItem {
  packName: string
  packCode: string | null
  readinessPct: number
}

interface Props {
  type: TileType
  health?: ProgrammeHealthData
  packReadiness?: PackReadinessItem[]
  children: React.ReactNode // the tile content (clickable)
}

const BAND_BADGE: Record<string, { bg: string; color: string; meaning: string }> = {
  critical: { bg: '#FCEBEB', color: '#A32D2D', meaning: 'Programme needs urgent attention. Focus on approving vendors and closing evidence gaps.' },
  high:     { bg: '#FCEBEB', color: '#A32D2D', meaning: 'Significant gaps remain. Concentrate on the weakest component.' },
  medium:   { bg: '#FAEEDA', color: '#854F0B', meaning: 'Making progress — you still have room to improve evidence and review coverage.' },
  low:      { bg: '#EAF3DE', color: '#3B6D11', meaning: 'Strong programme health. Maintain steady reviews to keep the score high.' },
}

export function DashboardTileModal({ type, health, packReadiness, children }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setIsOpen(true)
          }
        }}
        className="text-left transition-all"
        style={{
          cursor: 'pointer',
          display: 'block',
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(30,21,80,0.35)', backdropFilter: 'blur(4px)' }}
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            style={{ background: 'white', boxShadow: '0 12px 48px rgba(30,21,80,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid rgba(109,93,211,0.08)' }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1e1550' }}>
                  {type === 'programme' ? 'Programme Health' : type === 'radar' ? 'Pack Readiness' : 'Readiness by Review Pack'}
                </div>
                <div style={{ fontSize: 12, color: '#5d5285', marginTop: 2 }}>
                  {type === 'programme' && 'Composite score across evidence, reviews and approvals'}
                  {type === 'radar' && 'Each axis is a pack — distance from centre is readiness %'}
                  {type === 'bars' && 'Average readiness per pack, sorted highest to lowest'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-base hover:opacity-70"
                style={{ color: '#6b5fa8' }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5">
              {type === 'programme' && health && <ProgrammeContent health={health} />}
              {type === 'radar' && packReadiness && <RadarContent items={packReadiness} />}
              {type === 'bars' && packReadiness && <BarsContent items={packReadiness} />}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ProgrammeContent({ health }: { health: ProgrammeHealthData }) {
  const bandInfo = BAND_BADGE[health.band]
  const nextThresholds: Record<string, { next: number; nextBand: string }> = {
    critical: { next: 31, nextBand: 'High' },
    high: { next: 61, nextBand: 'Medium' },
    medium: { next: 86, nextBand: 'Low' },
    low: { next: 100, nextBand: 'Perfect' },
  }
  const nt = nextThresholds[health.band]
  const pointsNeeded = Math.max(0, nt.next - health.score)

  return (
    <>
      <div className="flex flex-col items-center">
        <div style={{ position: 'relative' }}>
          <GaugeChartLarge score={health.score} bandColor={health.bandColor} />
          <div
            className="flex flex-col items-center"
            style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -35%)' }}
          >
            <span style={{ fontSize: 54, fontWeight: 600, color: '#18181b', lineHeight: 1 }}>{health.score}</span>
            <span style={{ fontSize: 13, color: '#6e6a5e', marginTop: 4 }}>out of 100</span>
            <span
              style={{
                fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
                marginTop: 8, background: bandInfo.bg, color: bandInfo.color, textTransform: 'uppercase',
              }}
            >
              {health.band}
            </span>
          </div>
        </div>
        <p style={{ fontSize: 13, color: '#4a4270', marginTop: 12, textAlign: 'center', maxWidth: 400 }}>
          {bandInfo.meaning}
        </p>
        {pointsNeeded > 0 && health.band !== 'low' && (
          <p style={{ fontSize: 12, color: '#5d5285', marginTop: 4 }}>
            <strong style={{ color: '#6c5dd3' }}>+{pointsNeeded} pts</strong> to reach <strong>{nt.nextBand}</strong>
          </p>
        )}
      </div>

      {/* How it's calculated */}
      <div style={{ borderTop: '1px solid #f0eee8', paddingTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#6c5dd3', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          How it&apos;s calculated
        </div>
        <ComponentRow label="Evidence complete" weight="35%" pct={health.evidenceCompletePct} href="/vendors?evidence=missing" />
        <ComponentRow label="Reviews completed" weight="35%" pct={health.reviewsCompletePct} href="/reviews?readiness=below_30" />
        <ComponentRow label="Vendors approved" weight="30%" pct={health.vendorsApprovedPct} href="/vendors?approval=not_approved" />
        <p style={{ fontSize: 12, color: '#5d5285', marginTop: 10 }}>
          Minus up to 20 pts penalty for open critical remediations. Capped at 30 if any vendor is suspended or blocked.
        </p>
      </div>

      {/* Band definitions */}
      <div style={{ borderTop: '1px solid #f0eee8', paddingTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#6c5dd3', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          Score bands
        </div>
        <div className="grid grid-cols-4 gap-2">
          <BandBox range="0–30" label="Critical" bg="#FCEBEB" color="#A32D2D" />
          <BandBox range="31–60" label="High" bg="#FCEBEB" color="#A32D2D" />
          <BandBox range="61–85" label="Medium" bg="#FAEEDA" color="#854F0B" />
          <BandBox range="86–100" label="Low" bg="#EAF3DE" color="#3B6D11" />
        </div>
      </div>
    </>
  )
}

function ComponentRow({ label, weight, pct, href }: { label: string; weight: string; pct: number; href?: string }) {
  const color = pct >= 60 ? '#639922' : pct >= 30 ? '#EF9F27' : '#E24B4A'
  const inner = (
    <>
      <span style={{ fontSize: 12, color: '#4a4270', flex: 1 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#6b5fa8', fontFamily: 'monospace' }}>{weight}</span>
      <div style={{ width: 120, height: 4, background: '#f1efe8', borderRadius: 2 }}>
        <div style={{ width: `${Math.max(pct, 2)}%`, height: '100%', borderRadius: 2, background: color }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, width: 40, textAlign: 'right' }}>{pct}%</span>
    </>
  )
  if (href) {
    return (
      <Link href={href} className="flex items-center gap-3 py-1.5 -mx-2 px-2 rounded-lg transition-colors hover:bg-[rgba(108,93,211,0.05)]">
        {inner}
      </Link>
    )
  }
  return <div className="flex items-center gap-3 py-1.5">{inner}</div>
}

function BandBox({ range, label, bg, color }: { range: string; label: string; bg: string; color: string }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 8, background: bg, textAlign: 'center' }}>
      <div style={{ fontSize: 12, color, fontWeight: 600 }}>{range}</div>
      <div style={{ fontSize: 12, color, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function RadarContent({ items }: { items: PackReadinessItem[] }) {
  if (items.length < 3) {
    return <p style={{ fontSize: 13, color: '#5d5285' }}>Radar chart requires at least 3 packs.</p>
  }
  return (
    <>
      <div className="flex justify-center">
        <RadarChartLarge labels={items.map((p) => p.packName)} data={items.map((p) => p.readinessPct)} />
      </div>
      <div style={{ borderTop: '1px solid #f0eee8', paddingTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#6c5dd3', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          Pack breakdown
        </div>
        <PackTable items={items} />
      </div>
    </>
  )
}

function BarsContent({ items }: { items: PackReadinessItem[] }) {
  const sorted = [...items].sort((a, b) => b.readinessPct - a.readinessPct)
  if (sorted.length === 0) {
    return <p style={{ fontSize: 13, color: '#5d5285' }}>No packs assigned yet.</p>
  }

  const avg = Math.round(sorted.reduce((s, p) => s + p.readinessPct, 0) / sorted.length)
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]
  const onTrack = sorted.filter((p) => p.readinessPct >= 60).length
  const needsWork = sorted.filter((p) => p.readinessPct < 30).length

  return (
    <>
      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        <StatCell label="Avg readiness" value={`${avg}%`} valueColor={readinessColor(avg)} />
        <StatCell label="Packs on track" value={`${onTrack}/${sorted.length}`} valueColor="#378ADD" hint="≥ 60%" href="/reviews?readiness=on_track" />
        <StatCell label="Need work" value={`${needsWork}`} valueColor={needsWork > 0 ? '#E24B4A' : '#378ADD'} hint="< 30%" href="/reviews?readiness=below_30" />
        <StatCell label="Total packs" value={`${sorted.length}`} valueColor="#1e1550" href="/settings/review-packs" />
      </div>

      {/* Best / worst callouts */}
      <div className="grid grid-cols-2 gap-3">
        <HighlightCard tone="good" label="Top performer" name={best.packName} pct={best.readinessPct}
          href={best.packCode ? `/reviews?pack=${best.packCode}` : undefined} />
        <HighlightCard tone="bad" label="Biggest gap" name={worst.packName} pct={worst.readinessPct}
          href={worst.packCode ? `/reviews?pack=${worst.packCode}` : undefined} />
      </div>

      {/* Sorted list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6c5dd3', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            All packs · ranked
          </div>
          <div style={{ fontSize: 12, color: '#6b5fa8' }}>
            <span style={{ color: '#378ADD', fontWeight: 600 }}>●</span> ≥60% &nbsp;
            <span style={{ color: '#EF9F27', fontWeight: 600 }}>●</span> 30-59% &nbsp;
            <span style={{ color: '#E24B4A', fontWeight: 600 }}>●</span> &lt;30%
          </div>
        </div>
        <PackTable items={sorted} large showRank />
      </div>
    </>
  )
}

function readinessColor(pct: number): string {
  if (pct >= 60) return '#378ADD'
  if (pct >= 30) return '#EF9F27'
  return '#E24B4A'
}

function StatCell({ label, value, valueColor, hint, href }: { label: string; value: string; valueColor: string; hint?: string; href?: string }) {
  const inner = (
    <>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#5d5285', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span style={{ fontSize: 22, fontWeight: 600, color: valueColor, lineHeight: 1, letterSpacing: '-0.02em' }}>
          {value}
        </span>
        {hint && <span style={{ fontSize: 12, color: '#6b5fa8' }}>{hint}</span>}
      </div>
    </>
  )
  const baseStyle = { background: 'rgba(108,93,211,0.04)', border: '1px solid rgba(108,93,211,0.08)' }
  if (href) {
    return (
      <Link href={href} className="rounded-xl p-3 block transition-all hover:shadow-sm hover:-translate-y-0.5" style={baseStyle}>
        {inner}
      </Link>
    )
  }
  return <div className="rounded-xl p-3" style={baseStyle}>{inner}</div>
}

function HighlightCard({ tone, label, name, pct, href }: { tone: 'good' | 'bad'; label: string; name: string; pct: number; href?: string }) {
  const color = tone === 'good' ? '#378ADD' : '#E24B4A'
  const bg = tone === 'good' ? 'rgba(55,138,221,0.06)' : 'rgba(226,75,74,0.06)'
  const border = `1px solid ${tone === 'good' ? 'rgba(55,138,221,0.18)' : 'rgba(226,75,74,0.18)'}`
  const inner = (
    <>
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 12, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </div>
        <div className="truncate" style={{ fontSize: 13, fontWeight: 500, color: '#1e1550', marginTop: 2 }}>
          {name}
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {pct}%
      </div>
    </>
  )
  if (href) {
    return (
      <Link href={href} className="rounded-xl p-3 flex items-center gap-3 transition-all hover:shadow-sm hover:-translate-y-0.5" style={{ background: bg, border }}>
        {inner}
      </Link>
    )
  }
  return (
    <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: bg, border }}>
      {inner}
    </div>
  )
}

function PackTable({
  items,
  large = false,
  showRank = false,
}: {
  items: PackReadinessItem[]
  large?: boolean
  showRank?: boolean
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(108,93,211,0.08)' }}>
      {items.map((p, idx) => {
        const color = p.readinessPct >= 60 ? '#378ADD' : p.readinessPct >= 30 ? '#EF9F27' : '#E24B4A'
        const href = p.packCode ? `/reviews?pack=${p.packCode}` : null
        const rowStyle = {
          paddingTop: large ? 10 : 8,
          paddingBottom: large ? 10 : 8,
          borderTop: idx === 0 ? undefined : '1px solid rgba(108,93,211,0.06)',
          background: idx % 2 === 1 ? 'rgba(108,93,211,0.015)' : undefined,
        }
        const rowClass = href
          ? 'flex items-center gap-3 px-3 transition-colors hover:bg-[rgba(108,93,211,0.06)]'
          : 'flex items-center gap-3 px-3'
        const inner = (
          <>
            {/* Band-color accent */}
            <span
              aria-hidden
              className="rounded-full shrink-0"
              style={{ width: 3, height: 18, background: color }}
            />

            {/* Rank */}
            {showRank && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#6b5fa8',
                  width: 18,
                  textAlign: 'right',
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {idx + 1}
              </span>
            )}

            {/* Pack name */}
            <span
              className="flex-1 min-w-0 truncate"
              style={{
                fontSize: large ? 13 : 12,
                color: '#1e1550',
                fontWeight: large ? 500 : 400,
              }}
              title={p.packName}
            >
              {p.packName}
            </span>

            {/* Bar — fills available space */}
            <div
              className="flex-1"
              style={{
                height: large ? 8 : 6,
                background: '#f1efe8',
                borderRadius: 4,
                overflow: 'hidden',
                maxWidth: 240,
                minWidth: 80,
              }}
            >
              <div
                style={{
                  width: `${Math.max(p.readinessPct, 0)}%`,
                  height: '100%',
                  background: color,
                  borderRadius: 4,
                  transition: 'width 220ms ease-out',
                }}
              />
            </div>

            {/* % label */}
            <span
              style={{
                fontSize: large ? 13 : 12,
                fontWeight: 600,
                color,
                width: 42,
                textAlign: 'right',
                flexShrink: 0,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {p.readinessPct}%
            </span>
          </>
        )
        const key = p.packCode ?? p.packName
        if (href) {
          return (
            <Link key={key} href={href} className={rowClass} style={rowStyle}>
              {inner}
            </Link>
          )
        }
        return (
          <div key={key} className={rowClass} style={rowStyle}>
            {inner}
          </div>
        )
      })}
    </div>
  )
}
