import { prisma } from '../../../../utils/db'
import { assertAdmin } from '../../../../utils/auth'
import { sanitizeText } from '../../../../utils/sanitize'
import { logAudit } from '../../../../utils/audit'
import { throwApiError } from '../../../../utils/api'

export default defineEventHandler(async (event) => {
  const admin = assertAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = (await readBody(event).catch(() => ({}))) as { adminNote?: string }

  const submission = await prisma.userSubmission.findUnique({ where: { id } })
  if (!submission) {
    throwApiError({ statusCode: 404, code: 'SUBMISSION_NOT_FOUND', message: '提交记录不存在' })
  }

  if (!submission.linkedAppId) {
    throwApiError({ statusCode: 400, code: 'APP_NOT_READY', message: '尚未关联 App，无法通过审核' })
  }

  const app = await prisma.app.findUnique({ where: { id: submission.linkedAppId } })
  if (!app?.analysis || !app.riskLevel || !app.oneLiner || !app.plainSummary) {
    throwApiError({ statusCode: 400, code: 'ANALYSIS_INCOMPLETE', message: '关联 App 的分析结果不完整' })
  }

  const adminNote = sanitizeText(body.adminNote)

  await prisma.app.update({
    where: { id: submission.linkedAppId },
    data: { status: 'published', isPublished: true, reviewNotes: adminNote || null }
  })

  const updated = await prisma.userSubmission.update({
    where: { id },
    data: { status: 'approved', adminNote, approvedAt: new Date() }
  })

  await logAudit({
    entityType: 'submission',
    entityId: id,
    appId: submission.linkedAppId,
    action: 'submission.approved',
    actor: admin.username,
    before: submission,
    after: updated
  })

  return { ok: true }
})
