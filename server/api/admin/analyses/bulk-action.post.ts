import { analysisBulkActionSchema } from '../../../../shared/validators/admin'
import { prisma } from '../../../utils/db'
import { assertAdmin } from '../../../utils/auth'
import { analyzePolicyText } from '../../../../shared/lib/analysis'
import { logAudit } from '../../../utils/audit'
import { makeBatchId } from '../../../utils/id'

type BulkItemResult = {
  id: string
  ok: boolean
  code?: string
  message?: string
}

export default defineEventHandler(async (event) => {
  const admin = assertAdmin(event)
  const body = analysisBulkActionSchema.parse(await readBody(event))
  const batchId = makeBatchId('analysis')
  const results: BulkItemResult[] = []

  for (const id of body.ids) {
    try {
      const before = await prisma.app.findUnique({ where: { id } })
      if (!before) {
        results.push({ id, ok: false, code: 'APP_NOT_FOUND', message: '应用不存在' })
        continue
      }

      if (body.action === 'restore_ai') {
        if (!before.analysisSource) throw new Error('找不到 AI 初稿')
        await prisma.app.update({
          where: { id },
          data: {
            analysis: before.analysisSource,
            riskLevel: (before.analysisSource as any).risk_level,
            oneLiner: (before.analysisSource as any).one_liner,
            plainSummary: (before.analysisSource as any).plain_summary,
            analyzedAt: new Date()
          }
        })
      } else if (body.action === 'recalculate_risk') {
        if (!before.rawText) throw new Error('当前 App 没有可分析文本')
        const analysis = await analyzePolicyText(before.rawText)
        await prisma.app.update({
          where: { id },
          data: {
            analysis,
            riskLevel: analysis.risk_level,
            oneLiner: analysis.one_liner,
            plainSummary: analysis.plain_summary,
            analyzedAt: new Date()
          }
        })
      }

      const after = await prisma.app.findUnique({ where: { id } })
      await logAudit({
        entityType: 'analysis',
        entityId: id,
        appId: id,
        action: `analysis.bulk_${body.action}`,
        actor: admin.username,
        before: before.analysis,
        after: {
          analysis: after?.analysis,
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
      type: 'analysis_bulk_action',
      status: failedCount(results) > 0 ? 'failed' : 'success',
      targetType: 'analysis',
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
