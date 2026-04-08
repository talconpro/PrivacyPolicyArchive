import { submissionBulkActionSchema } from '../../../../shared/validators/admin'
import { prisma } from '../../../utils/db'
import { assertAdmin } from '../../../utils/auth'
import { sanitizeText } from '../../../utils/sanitize'
import { logAudit } from '../../../utils/audit'
import { processSubmission } from '../../../utils/workflows'
import { makeBatchId } from '../../../utils/id'

type BulkItemResult = {
  id: string
  ok: boolean
  code?: string
  message?: string
}

export default defineEventHandler(async (event) => {
  const admin = assertAdmin(event)
  const body = submissionBulkActionSchema.parse(await readBody(event))
  const batchId = makeBatchId('submission')
  const adminNote = sanitizeText(body.adminNote)
  const results: BulkItemResult[] = []

  for (const id of body.ids) {
    try {
      const before = await prisma.userSubmission.findUnique({ where: { id } })
      if (!before) {
        results.push({ id, ok: false, code: 'SUBMISSION_NOT_FOUND', message: '提交不存在' })
        continue
      }

      if (body.action === 'process') {
        await processSubmission(id)
      } else if (body.action === 'approve') {
        if (!before.linkedAppId) throw new Error('请先处理提交并生成关联 App')
        const app = await prisma.app.findUnique({ where: { id: before.linkedAppId } })
        if (!app?.analysis || !app.riskLevel || !app.oneLiner || !app.plainSummary) {
          throw new Error('关联 App 分析不完整')
        }
        await prisma.app.update({
          where: { id: before.linkedAppId },
          data: { status: 'published', isPublished: true, reviewNotes: adminNote || null }
        })
        await prisma.userSubmission.update({
          where: { id },
          data: { status: 'approved', adminNote, approvedAt: new Date() }
        })
      } else if (body.action === 'reject') {
        await prisma.userSubmission.update({ where: { id }, data: { status: 'rejected', adminNote } })
      } else if (body.action === 'send_back') {
        if (!adminNote) throw new Error('退回补充信息时备注不能为空')
        await prisma.userSubmission.update({
          where: { id },
          data: { status: 'needs_revision', adminNote, approvedAt: null }
        })
      }

      const after = await prisma.userSubmission.findUnique({ where: { id } })
      await logAudit({
        entityType: 'submission',
        entityId: id,
        appId: before.linkedAppId,
        action: `submission.bulk_${body.action}`,
        actor: admin.username,
        before,
        after: {
          ...after,
          batchId
        }
      })

      results.push({ id, ok: true })
    } catch (error: any) {
      results.push({ id, ok: false, code: 'ACTION_FAILED', message: error?.message || '处理失败' })
    }
  }

  await prisma.crawlJob.create({
    data: {
      type: 'submission_bulk_action',
      status: failedCount(results) > 0 ? 'failed' : 'success',
      targetType: 'submission',
      summary: `action=${body.action}, success=${successCount(results)}, failed=${failedCount(results)}`,
      meta: { batchId, action: body.action, success: successCount(results), failed: failedCount(results), ids: body.ids },
      startedAt: new Date(),
      finishedAt: new Date()
    }
  })

  return {
    ok: true,
    batchId,
    action: body.action,
    total: body.ids.length,
    success: successCount(results),
    failed: failedCount(results),
    results
  }
})

function successCount(results: BulkItemResult[]) {
  return results.filter((item) => item.ok).length
}

function failedCount(results: BulkItemResult[]) {
  return results.filter((item) => !item.ok).length
}
