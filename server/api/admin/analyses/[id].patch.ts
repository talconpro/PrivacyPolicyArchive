import { analysisEditorSchema } from '../../../../shared/validators/admin'
import { containsDeterministicLegalTerms } from '../../../../shared/validators/admin'
import { prisma } from '../../../utils/db'
import { assertAdmin } from '../../../utils/auth'
import { logAudit } from '../../../utils/audit'
import { throwApiError } from '../../../utils/api'

export default defineEventHandler(async (event) => {
  const admin = assertAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = analysisEditorSchema.parse(await readBody(event))
  const legalFields = [body.one_liner, body.plain_summary, body.dispute, ...body.key_findings]
  if (legalFields.some((item) => containsDeterministicLegalTerms(item))) {
    throwApiError({
      statusCode: 400,
      code: 'LEGAL_TONE_VIOLATION',
      message: '请避免使用“违法/非法”等确定性法律判断，改为中性描述'
    })
  }
  const before = await prisma.app.findUnique({ where: { id } })
  if (!before) {
    throwApiError({ statusCode: 404, code: 'APP_NOT_FOUND', message: 'App 不存在' })
  }
  const app = await prisma.app.update({
    where: { id },
    data: {
      analysis: body,
      riskLevel: body.risk_level,
      oneLiner: body.one_liner,
      plainSummary: body.plain_summary,
      analyzedAt: new Date(),
      status: before.status === 'draft' ? 'review_ready' : before.status
    }
  })
  await logAudit({ entityType: 'analysis', entityId: id, appId: id, action: 'analysis.edited', actor: admin.username, before: before.analysis, after: body })
  return { ok: true, app }
})
