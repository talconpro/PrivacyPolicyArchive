import { prisma } from '../../../../utils/db'
import { assertAdmin } from '../../../../utils/auth'
import { sanitizeText } from '../../../../utils/sanitize'
import { logAudit } from '../../../../utils/audit'
import { throwApiError } from '../../../../utils/api'

export default defineEventHandler(async (event) => {
  const admin = assertAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = (await readBody(event).catch(() => ({}))) as { adminNote?: string }
  const adminNote = sanitizeText(body.adminNote)

  if (!adminNote) {
    throwApiError({ statusCode: 400, code: 'ADMIN_NOTE_REQUIRED', message: '退回补充信息时，审核备注不能为空' })
  }

  const submission = await prisma.userSubmission.findUnique({ where: { id } })
  if (!submission) {
    throwApiError({ statusCode: 404, code: 'SUBMISSION_NOT_FOUND', message: '提交记录不存在' })
  }

  const updated = await prisma.userSubmission.update({
    where: { id },
    data: { status: 'needs_revision', adminNote, approvedAt: null }
  })

  await logAudit({
    entityType: 'submission',
    entityId: id,
    appId: submission.linkedAppId,
    action: 'submission.sent_back',
    actor: admin.username,
    before: submission,
    after: updated
  })

  return { ok: true }
})
