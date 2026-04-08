import { prisma } from '../../../../utils/db'
import { assertAdmin } from '../../../../utils/auth'
import { createJob, runJob } from '../../../../utils/jobs'
import { processSubmission } from '../../../../utils/workflows'
import { logAudit } from '../../../../utils/audit'
import { throwApiError } from '../../../../utils/api'

export default defineEventHandler(async (event) => {
  const admin = assertAdmin(event)
  const id = getRouterParam(event, 'id')!
  const sourceJob = await prisma.crawlJob.findUnique({ where: { id } })
  if (!sourceJob) {
    throwApiError({ statusCode: 404, code: 'JOB_NOT_FOUND', message: '任务不存在' })
  }
  if (sourceJob.status !== 'failed') {
    throwApiError({ statusCode: 400, code: 'JOB_NOT_RETRYABLE', message: '仅失败任务可重试' })
  }

  const retryJob = await createJob(`${sourceJob.type}_retry`, sourceJob.targetType || undefined, sourceJob.targetId || undefined, {
    retryOf: sourceJob.id,
    originalType: sourceJob.type
  })

  if (sourceJob.type === 'submission_process' && sourceJob.targetId) {
    await runJob(retryJob.id, () => processSubmission(sourceJob.targetId!), '重试处理单条提交')
  } else if (sourceJob.type === 'process_pending_submissions') {
    await runJob(retryJob.id, async () => {
      const pending = await prisma.userSubmission.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: 10
      })
      for (const item of pending) {
        try {
          await processSubmission(item.id)
        } catch (error: any) {
          await prisma.userSubmission.update({
            where: { id: item.id },
            data: { status: 'failed', processingError: error?.message || '处理失败' }
          })
        }
      }
    }, '重试批量处理待审核提交')
  } else {
    throwApiError({
      statusCode: 400,
      code: 'UNSUPPORTED_RETRY_TYPE',
      message: `该任务类型暂不支持重试: ${sourceJob.type}`
    })
  }

  await logAudit({
    entityType: 'job',
    entityId: retryJob.id,
    action: 'job.retried',
    actor: admin.username,
    before: sourceJob,
    after: retryJob
  })

  return { ok: true, retryJobId: retryJob.id }
})
