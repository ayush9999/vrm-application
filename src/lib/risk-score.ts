/**
 * Risk Score computation.
 *
 * Formula (locked in 2026-04-16):
 *   - Required review item completed (Pass / Exception Approved) = 1.0 points
 *   - Optional review item completed = 0.3 points
 *   - Required evidence Approved = 1.0 points
 *   - Optional evidence Approved = 0.3 points
 *   - Score = (achieved / max possible) * 100
 *   - Each open critical remediation: -5 points (capped at -20)
 *   - Bands:
 *       0–30  → Critical
 *       31–60 → High
 *       61–85 → Medium
 *       86–100 → Low
 *   - If approval_status is Suspended or Blocked → always Critical (overrides score)
 */

import type { VendorApprovalStatus } from '@/types/review-pack'

export type RiskBand = 'low' | 'medium' | 'high' | 'critical'

export interface RiskScoreInput {
  // Review items
  requiredReviewTotal: number
  requiredReviewCompleted: number  // pass + exception_approved (excluding N/A)
  optionalReviewTotal: number
  optionalReviewCompleted: number  // pass + exception_approved (excluding N/A)
  // Evidence
  requiredEvidenceTotal: number
  requiredEvidenceApproved: number
  optionalEvidenceTotal: number
  optionalEvidenceApproved: number
  // Remediation
  openCriticalRemediations: number
  // Approval
  approvalStatus: VendorApprovalStatus
}

export interface RiskScoreOutput {
  score: number          // 0-100, integer
  band: RiskBand
  rawScore: number       // before approval-status override
  remediationPenalty: number
  isApprovalOverride: boolean
  formula: string        // human-readable formula explanation
}

const REQUIRED_WEIGHT = 1.0
const OPTIONAL_WEIGHT = 0.3
const REMEDIATION_PENALTY_PER_ITEM = 5
const REMEDIATION_PENALTY_CAP = 20

export function computeRiskScore(input: RiskScoreInput): RiskScoreOutput {
  const maxPossible =
    input.requiredReviewTotal * REQUIRED_WEIGHT +
    input.optionalReviewTotal * OPTIONAL_WEIGHT +
    input.requiredEvidenceTotal * REQUIRED_WEIGHT +
    input.optionalEvidenceTotal * OPTIONAL_WEIGHT

  const achieved =
    input.requiredReviewCompleted * REQUIRED_WEIGHT +
    input.optionalReviewCompleted * OPTIONAL_WEIGHT +
    input.requiredEvidenceApproved * REQUIRED_WEIGHT +
    input.optionalEvidenceApproved * OPTIONAL_WEIGHT

  const baseScore = maxPossible > 0 ? (achieved / maxPossible) * 100 : 0

  const remediationPenalty = Math.min(
    input.openCriticalRemediations * REMEDIATION_PENALTY_PER_ITEM,
    REMEDIATION_PENALTY_CAP,
  )

  let rawScore = Math.max(0, Math.min(100, Math.round(baseScore - remediationPenalty)))

  let band = bandFromScore(rawScore)
  let isApprovalOverride = false

  // Approval status override
  if (input.approvalStatus === 'suspended' || input.approvalStatus === 'blocked') {
    band = 'critical'
    isApprovalOverride = true
  }

  const formula =
    `Score = (achieved ÷ max possible) × 100 − remediation penalty\n` +
    `      = (${achieved.toFixed(1)} ÷ ${maxPossible.toFixed(1)}) × 100 − ${remediationPenalty}\n` +
    `      = ${rawScore}\n\n` +
    `Required items weight: ${REQUIRED_WEIGHT}, Optional: ${OPTIONAL_WEIGHT}\n` +
    `Critical remediation penalty: −${REMEDIATION_PENALTY_PER_ITEM} each, capped at −${REMEDIATION_PENALTY_CAP}\n` +
    `Bands: 86–100 Low · 61–85 Medium · 31–60 High · 0–30 Critical\n` +
    (isApprovalOverride ? `Approval status (${input.approvalStatus}) overrides band → Critical` : '')

  // Score returned is the raw score (band may differ if overridden)
  return {
    score: rawScore,
    band,
    rawScore,
    remediationPenalty,
    isApprovalOverride,
    formula: formula.trim(),
  }
}

function bandFromScore(score: number): RiskBand {
  if (score <= 30) return 'critical'
  if (score <= 60) return 'high'
  if (score <= 85) return 'medium'
  return 'low'
}

export const RISK_BAND_STYLE: Record<RiskBand, { label: string; bg: string; color: string; dot: string }> = {
  low:      { label: 'Low',      bg: 'rgba(5,150,105,0.1)',  color: '#059669', dot: '#10b981' },
  medium:   { label: 'Medium',   bg: 'rgba(245,158,11,0.1)', color: '#d97706', dot: '#f59e0b' },
  high:     { label: 'High',     bg: 'rgba(234,88,12,0.1)',  color: '#ea580c', dot: '#f97316' },
  critical: { label: 'Critical', bg: 'rgba(225,29,72,0.1)',  color: '#e11d48', dot: '#ef4444' },
}
