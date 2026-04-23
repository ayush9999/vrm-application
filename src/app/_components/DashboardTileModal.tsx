'use client'

import { useState } from 'react'
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
            className="w-full max-w-2xl rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
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
                <div style={{ fontSize: 11, color: '#8b7fd4', marginTop: 2 }}>
                  {type === 'programme' && 'Overall health of your vendor risk programme'}
                  {type === 'radar' && 'Multi-dimensional view of pack readiness'}
                  {type === 'bars' && 'Ranked view of readiness across all packs'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-base hover:opacity-70"
                style={{ color: '#a99fd8' }}
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
            <span style={{ fontSize: 13, color: '#9a9890', marginTop: 4 }}>out of 100</span>
            <span
              style={{
                fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
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
          <p style={{ fontSize: 12, color: '#8b7fd4', marginTop: 4 }}>
            <strong style={{ color: '#6c5dd3' }}>+{pointsNeeded} pts</strong> to reach <strong>{nt.nextBand}</strong>
          </p>
        )}
      </div>

      {/* How it's calculated */}
      <div style={{ borderTop: '1px solid #f0eee8', paddingTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6c5dd3', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          How it&apos;s calculated
        </div>
        <ComponentRow label="Evidence complete" weight="35%" pct={health.evidenceCompletePct} />
        <ComponentRow label="Reviews completed" weight="35%" pct={health.reviewsCompletePct} />
        <ComponentRow label="Vendors approved" weight="30%" pct={health.vendorsApprovedPct} />
        <p style={{ fontSize: 11, color: '#8b7fd4', marginTop: 10 }}>
          Minus up to 20 pts penalty for open critical remediations. Capped at 30 if any vendor is suspended or blocked.
        </p>
      </div>

      {/* Band definitions */}
      <div style={{ borderTop: '1px solid #f0eee8', paddingTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6c5dd3', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
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

function ComponentRow({ label, weight, pct }: { label: string; weight: string; pct: number }) {
  const color = pct >= 60 ? '#639922' : pct >= 30 ? '#EF9F27' : '#E24B4A'
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span style={{ fontSize: 12, color: '#4a4270', flex: 1 }}>{label}</span>
      <span style={{ fontSize: 10, color: '#a99fd8', fontFamily: 'monospace' }}>{weight}</span>
      <div style={{ width: 120, height: 4, background: '#f1efe8', borderRadius: 2 }}>
        <div style={{ width: `${Math.max(pct, 2)}%`, height: '100%', borderRadius: 2, background: color }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, width: 40, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

function BandBox({ range, label, bg, color }: { range: string; label: string; bg: string; color: string }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 8, background: bg, textAlign: 'center' }}>
      <div style={{ fontSize: 11, color, fontWeight: 600 }}>{range}</div>
      <div style={{ fontSize: 10, color, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function RadarContent({ items }: { items: PackReadinessItem[] }) {
  if (items.length < 3) {
    return <p style={{ fontSize: 13, color: '#8b7fd4' }}>Radar chart requires at least 3 packs.</p>
  }
  return (
    <>
      <div className="flex justify-center">
        <RadarChartLarge labels={items.map((p) => p.packName)} data={items.map((p) => p.readinessPct)} />
      </div>
      <p style={{ fontSize: 12, color: '#8b7fd4', textAlign: 'center' }}>
        Each axis is a review pack. Distance from the centre = readiness % averaged across all vendors with that pack.
      </p>
      <div style={{ borderTop: '1px solid #f0eee8', paddingTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6c5dd3', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          Pack breakdown
        </div>
        <PackTable items={items} />
      </div>
    </>
  )
}

function BarsContent({ items }: { items: PackReadinessItem[] }) {
  const sorted = [...items].sort((a, b) => b.readinessPct - a.readinessPct)
  return (
    <>
      <p style={{ fontSize: 12, color: '#8b7fd4' }}>
        Average readiness per pack across all vendors that have it assigned. Sorted highest to lowest.
      </p>
      <PackTable items={sorted} large />
    </>
  )
}

function PackTable({ items, large = false }: { items: PackReadinessItem[]; large?: boolean }) {
  return (
    <div className="space-y-2">
      {items.map((p) => {
        const color = p.readinessPct >= 60 ? '#378ADD' : p.readinessPct >= 30 ? '#EF9F27' : '#E24B4A'
        return (
          <div key={p.packCode ?? p.packName} className="flex items-center gap-3">
            <span style={{ fontSize: large ? 13 : 12, color: '#4a4270', flex: 1, fontWeight: large ? 500 : 400 }}>
              {p.packName}
            </span>
            {p.packCode && (
              <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#a99fd8' }}>{p.packCode}</span>
            )}
            <div style={{ width: large ? 200 : 140, height: large ? 14 : 10, background: '#f1efe8', borderRadius: 3, overflow: 'hidden' }}>
              <div
                className="flex items-center justify-end"
                style={{
                  width: `${Math.max(p.readinessPct, 6)}%`,
                  height: '100%', background: color, paddingRight: 6,
                }}
              >
                <span style={{ fontSize: 9, fontWeight: 600, color: 'white' }}>{p.readinessPct}%</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
