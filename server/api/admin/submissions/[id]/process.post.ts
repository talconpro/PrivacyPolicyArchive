import { assertAdmin } from '../../../../utils/auth'
import { createJob, runJob } from '../../../../utils/jobs'
import { processSubmission } from '../../../../utils/workflows'
import { throwApiError } from '../../../../utils/api'
import { prisma } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  assertAdmin(event)
  const id = getRouterParam(event, 'id')!

  const submission = await prisma.userSubmission.findUnique({ where: { id } })
  if (!submission) {
    throwApiError({ statusCode: 404, code: 'SUBMISSION_NOT_FOUND', message: '提交记录不存在' })
  }

  if (submission.status === 'processing') {
    throwApiError({
      statusCode: 409,
      code: 'SUBMISSION_ALREADY_PROCESSING',
      message: '该提交正在处理中，请稍后刷新'
    })
  }

  const job = await createJob('submission_process', 'submission', id)

  try {
    const app = await runJob(job.id, () => processSubmission(id), '处理提交并生成分析')
    return { ok: true, app }
  } catch (error: any) {
    throwApiError({
      statusCode: 400,
      code: 'SUBMISSION_PROCESS_FAILED',
      message: error?.message || '处理失败',
      details: { submissionId: id, jobId: job.id }
    })
  }
})
