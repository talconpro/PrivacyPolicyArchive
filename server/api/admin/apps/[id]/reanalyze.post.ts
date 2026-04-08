import { prisma } from '../../../../utils/db'
import { assertAdmin } from '../../../../utils/auth'
import { analyzePolicyText } from '../../../../../shared/lib/analysis'
import { logAudit } from '../../../../utils/audit'
import { throwApiError } from '../../../../utils/api'

export default defineEventHandler(async (event) => {
  const admin = assertAdmin(event)
  const id = getRouterParam(event, 'id')!
  const app = await prisma.app.findUnique({ where: { id } })

  if (!app) {
    throwApiError({ statusCode: 404, code: 'APP_NOT_FOUND', message: '应用不存在' })
  }

  if (!app.rawText) {
    throwApiError({ statusCode: 400, code: 'RAW_TEXT_MISSING', message: '缺少可分析的隐私政策文本' })
  }

  const analysis = await analyzePolicyText(app.rawText)
  const updated = await prisma.app.update({
    where: { id },
    data: {
      analysis,
      riskLevel: analysis.risk_level,
      oneLiner: analysis.one_liner,
      plainSummary: analysis.plain_summary,
      analyzedAt: new Date(),
      status: app.status === 'draft' ? 'review_ready' : app.status,
      lastError: null
    }
  })

  await prisma.policyVersion.create({
    data: {
      appId: id,
      versionLabel: `Reanalyzed ${new Date().toISOString().slice(0, 10)}`,
      rawText: app.rawText,
      contentHash: app.contentHash || 'manual',
      analysis,
      sourceUrl: app.privacyPolicyUrl
    }
  })

  await logAudit({
    entityType: 'app',
    entityId: id,
    appId: id,
    action: 'app.reanalyzed',
    actor: admin.username,
    before: app.analysis,
    after: updated.analysis
  })

  return { ok: true, analysis }
})
