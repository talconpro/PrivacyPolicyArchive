import { prisma } from '../../../../utils/db'
import { assertAdmin } from '../../../../utils/auth'
import { logAudit } from '../../../../utils/audit'
import { throwApiError } from '../../../../utils/api'

export default defineEventHandler(async (event) => {
  const admin = assertAdmin(event)
  const id = getRouterParam(event, 'id')!
  const app = await prisma.app.findUnique({ where: { id } })

  if (!app?.analysisSource) {
    throwApiError({ statusCode: 404, code: 'ANALYSIS_SOURCE_NOT_FOUND', message: '未找到 AI 初稿，无法恢复' })
  }

  const updated = await prisma.app.update({
    where: { id },
    data: {
      analysis: app.analysisSource,
      riskLevel: (app.analysisSource as any).risk_level,
      oneLiner: (app.analysisSource as any).one_liner,
      plainSummary: (app.analysisSource as any).plain_summary,
      analyzedAt: new Date()
    }
  })

  await logAudit({
    entityType: 'analysis',
    entityId: id,
    appId: id,
    action: 'analysis.restored',
    actor: admin.username,
    before: app.analysis,
    after: app.analysisSource
  })

  return { ok: true, app: updated }
})
