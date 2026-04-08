import { z } from 'zod'
import { assertAdmin } from '../../../utils/auth'
import { createJob, runJob } from '../../../utils/jobs'
import { processSubmission } from '../../../utils/workflows'
import { prisma } from '../../../utils/db'
import { analyzePolicyText } from '../../../../shared/lib/analysis'
import { throwApiError } from '../../../utils/api'

const schema = z.object({
  type: z.enum(['process_pending_submissions', 'reanalyze_app']),
  targetId: z.string().optional()
})

export default defineEventHandler(async (event) => {
  assertAdmin(event)
  const body = schema.parse(await readBody(event))
  const job = await createJob(body.type, body.targetId ? 'app' : undefined, body.targetId)

  if (body.type === 'process_pending_submissions') {
    const result = await runJob(
      job.id,
      async () => {
        const pending = await prisma.userSubmission.findMany({
          where: { status: 'pending' },
          orderBy: { createdAt: 'asc' },
          take: 10
        })

        const processed: string[] = []
        for (const item of pending) {
          try {
            await processSubmission(item.id)
            processed.push(item.appName)
          } catch (error: any) {
            await prisma.userSubmission.update({
              where: { id: item.id },
              data: { status: 'failed', processingError: error?.message || '处理失败' }
            })
          }
        }

        return processed
      },
      '批量处理待审核提交'
    )

    return { ok: true, result }
  }

  if (!body.targetId) {
    throwApiError({ statusCode: 400, code: 'TARGET_ID_REQUIRED', message: '缺少 targetId 参数' })
  }

  const result = await runJob(
    job.id,
    async () => {
      const app = await prisma.app.findUnique({ where: { id: body.targetId } })
      if (!app?.rawText) {
        throw new Error('目标 App 缺少可分析文本')
      }

      const analysis = await analyzePolicyText(app.rawText)
      await prisma.app.update({
        where: { id: app.id },
        data: {
          analysis,
          riskLevel: analysis.risk_level,
          oneLiner: analysis.one_liner,
          plainSummary: analysis.plain_summary,
          analyzedAt: new Date()
        }
      })

      return analysis
    },
    '重新分析 App'
  )

  return { ok: true, result }
})
