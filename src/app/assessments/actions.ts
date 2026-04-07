'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireCurrentUser } from '@/lib/current-user'
import {
  createAssessment,
  addAssessmentFrameworkSelection,
  instantiateFrameworkItems,
  removeFrameworkFromAssessment,
  updateAssessment,
  deleteAssessment,
  updateAssessmentItem,
  createFinding,
  updateFindingStatus,
  createMitigation,
  createReview,
  completeReview,
  getAssessmentDetail,
} from '@/lib/db/assessments'
import { logActivity } from '@/lib/db/activity-log'
import type { AssessmentFormState } from '@/types/assessment'

// ─── Create assessment ────────────────────────────────────────────────────────

export async function createAssessmentAction(
  _prev: AssessmentFormState,
  formData: FormData,
): Promise<AssessmentFormState> {
  const user = await requireCurrentUser()
  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const vendorId = (formData.get('vendor_id') as string | null)?.trim() ?? ''
  const frameworkIds = formData.getAll('framework_ids').map(v => String(v).trim()).filter(Boolean)
  const periodType = (formData.get('period_type') as string | null) || null
  const periodStart = (formData.get('period_start') as string | null) || null
  const periodEnd = (formData.get('period_end') as string | null) || null
  const description = (formData.get('description') as string | null)?.trim() || null

  if (!title) return { message: 'Title is required.' }
  if (!vendorId) return { message: 'Vendor is required.' }

  try {
    const assessment = await createAssessment({
      orgId: user.orgId,
      vendorId,
      title,
      description,
      periodType: periodType as never,
      periodStart,
      periodEnd,
      createdByUserId: user.userId,
    })

    // Record all selected frameworks explicitly, then instantiate their items
    for (const fwId of frameworkIds) {
      await addAssessmentFrameworkSelection(assessment.id, fwId, 'manual', user.userId)
      await instantiateFrameworkItems(user.orgId, assessment.id, fwId, user.userId)
    }

    redirect(`/assessments/${assessment.id}`)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    return { message: (err as Error).message ?? 'Failed to create assessment.' }
  }
}

// ─── Advance / update status ──────────────────────────────────────────────────

export async function updateAssessmentStatusAction(
  assessmentId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireCurrentUser()
  const status = formData.get('status') as string
  const now = new Date().toISOString()

  // Fetch current assessment to get previous status and vendor_id for logging
  const detail = await getAssessmentDetail(user.orgId, assessmentId)
  const prevStatus = detail?.assessment.status ?? 'unknown'

  await updateAssessment(user.orgId, assessmentId, {
    status: status as never,
    ...(status === 'submitted' ? { submitted_at: now } : {}),
    ...(status === 'completed' ? { completed_at: now } : {}),
  })

  // Log status change
  const ACTION_LABELS: Record<string, string> = {
    in_review: 'assessment_reopened',
    submitted: 'assessment_submitted',
    completed: 'assessment_completed',
    pending_ai_review: 'assessment_ai_review_triggered',
    pending_human_review: 'assessment_human_review_started',
  }
  await logActivity({
    orgId: user.orgId,
    vendorId: detail?.assessment.vendor_id ?? null,
    actorUserId: user.userId,
    entityType: 'vendor_assessment',
    entityId: assessmentId,
    action: ACTION_LABELS[status] ?? `assessment_status_${status}`,
    metadata: { from: prevStatus, to: status },
  })

  revalidatePath(`/assessments/${assessmentId}`)
}

// ─── Save assessment notes / summary ──────────────────────────────────────────

export async function saveAssessmentSummaryAction(
  assessmentId: string,
  _prev: AssessmentFormState,
  formData: FormData,
): Promise<AssessmentFormState> {
  const user = await requireCurrentUser()
  try {
    await updateAssessment(user.orgId, assessmentId, {
      final_summary: (formData.get('final_summary') as string | null) ?? null,
      final_recommendation: (formData.get('final_recommendation') as string | null) ?? null,
      human_notes: (formData.get('human_notes') as string | null) ?? null,
    })
    return { success: true, message: 'Saved.' }
  } catch (e: unknown) {
    return { message: (e as Error).message }
  }
}

// ─── Update assessment item ───────────────────────────────────────────────────

export async function updateAssessmentItemAction(
  itemId: string,
  _prev: AssessmentFormState,
  formData: FormData,
): Promise<AssessmentFormState> {
  const user = await requireCurrentUser()
  try {
    await updateAssessmentItem(user.orgId, itemId, {
      status: (formData.get('status') as never) ?? undefined,
      score: formData.get('score') ? Number(formData.get('score')) : null,
      rationale: (formData.get('rationale') as string | null) ?? null,
      reviewer_notes: (formData.get('reviewer_notes') as string | null) ?? null,
    })
    return { success: true }
  } catch (e: unknown) {
    return { message: (e as Error).message }
  }
}

// ─── Create finding ───────────────────────────────────────────────────────────

export async function createFindingAction(
  assessmentId: string,
  _prev: AssessmentFormState,
  formData: FormData,
): Promise<AssessmentFormState> {
  const user = await requireCurrentUser()
  const title = (formData.get('title') as string | null)?.trim() ?? ''
  if (!title) return { message: 'Title is required.' }
  try {
    await createFinding({
      orgId: user.orgId,
      assessmentId,
      assessmentItemId: (formData.get('assessment_item_id') as string | null) || null,
      title,
      description: (formData.get('description') as string | null)?.trim() || null,
      severity: (formData.get('severity') as 'low' | 'medium' | 'high') ?? 'low',
      riskDomain: (formData.get('risk_domain') as string | null) || null,
      createdByUserId: user.userId,
    })
    return { success: true }
  } catch (e: unknown) {
    return { message: (e as Error).message }
  }
}

// ─── Update finding status ────────────────────────────────────────────────────

export async function updateFindingStatusAction(
  _vendorId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireCurrentUser()
  const findingId = formData.get('finding_id') as string
  const status = formData.get('status') as 'open' | 'mitigated' | 'accepted' | 'closed'
  await updateFindingStatus(user.orgId, findingId, status)
}

// ─── Create mitigation ────────────────────────────────────────────────────────

export async function createMitigationAction(
  assessmentId: string,
  _prev: AssessmentFormState,
  formData: FormData,
): Promise<AssessmentFormState> {
  const user = await requireCurrentUser()
  const action = (formData.get('action') as string | null)?.trim() ?? ''
  const findingId = (formData.get('finding_id') as string | null)?.trim() ?? ''
  if (!action) return { message: 'Action is required.' }
  if (!findingId) return { message: 'Finding ID is required.' }
  try {
    await createMitigation({
      orgId: user.orgId,
      findingId,
      assessmentId,
      action,
      dueAt: (formData.get('due_at') as string | null) || null,
      notes: (formData.get('notes') as string | null) || null,
      createdByUserId: user.userId,
    })
    return { success: true }
  } catch (e: unknown) {
    return { message: (e as Error).message }
  }
}

// ─── Add / remove frameworks from an existing assessment ─────────────────────

export async function addAssessmentFrameworkAction(
  assessmentId: string,
  frameworkId: string,
): Promise<{ message?: string }> {
  const user = await requireCurrentUser()
  try {
    await addAssessmentFrameworkSelection(assessmentId, frameworkId, 'manual', user.userId)
    await instantiateFrameworkItems(user.orgId, assessmentId, frameworkId, user.userId)
    revalidatePath(`/assessments/${assessmentId}`)
    return {}
  } catch (e: unknown) {
    return { message: (e as Error).message }
  }
}

export async function removeAssessmentFrameworkAction(
  assessmentId: string,
  frameworkId: string,
): Promise<{ message?: string }> {
  const user = await requireCurrentUser()
  try {
    await removeFrameworkFromAssessment(user.orgId, assessmentId, frameworkId)
    revalidatePath(`/assessments/${assessmentId}`)
    return {}
  } catch (e: unknown) {
    return { message: (e as Error).message }
  }
}

// ─── Delete assessment ────────────────────────────────────────────────────────

export async function deleteAssessmentAction(assessmentId: string): Promise<void> {
  const user = await requireCurrentUser()
  await deleteAssessment(user.orgId, assessmentId, user.userId)
  redirect('/assessments')
}

// ─── Trigger AI review (dummy for now) ───────────────────────────────────────

export async function triggerAiReviewAction(
  assessmentId: string,
): Promise<void> {
  const user = await requireCurrentUser()
  // Phase 1: create a pending AI review record; no actual AI call yet
  await createReview(user.orgId, assessmentId, 'ai', null, user.userId)
  await updateAssessment(user.orgId, assessmentId, { status: 'pending_ai_review' })
  revalidatePath(`/assessments/${assessmentId}`)
}

// ─── Complete human review ────────────────────────────────────────────────────

export async function completeHumanReviewAction(
  assessmentId: string,
  _prev: AssessmentFormState,
  formData: FormData,
): Promise<AssessmentFormState> {
  const user = await requireCurrentUser()
  const reviewId = formData.get('review_id') as string | null
  const summary = (formData.get('review_summary') as string | null)?.trim() ?? ''
  if (!summary) return { message: 'Review summary is required.' }
  try {
    if (reviewId) await completeReview(user.orgId, reviewId, summary)
    else {
      const review = await createReview(user.orgId, assessmentId, 'human', user.userId, user.userId)
      await completeReview(user.orgId, review.id, summary)
    }
    await updateAssessment(user.orgId, assessmentId, { status: 'in_review' })
    return { success: true }
  } catch (e: unknown) {
    return { message: (e as Error).message }
  }
}
