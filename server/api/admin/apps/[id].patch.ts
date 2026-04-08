import { appEditorSchema } from '../../../../shared/validators/admin'
import { prisma } from '../../../utils/db'
import { assertAdmin } from '../../../utils/auth'
import { sanitizeText } from '../../../utils/sanitize'
import { logAudit } from '../../../utils/audit'
import { throwApiError } from '../../../utils/api'

export default defineEventHandler(async (event) => {
  const admin = assertAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = appEditorSchema.parse(await readBody(event))
  const before = await prisma.app.findUnique({ where: { id } })

  if (!before) {
    throwApiError({ statusCode: 404, code: 'APP_NOT_FOUND', message: '应用不存在' })
  }

  const app = await prisma.app.update({
    where: { id },
    data: {
      ...body,
      developer: body.developer || null,
      iconUrl: body.iconUrl || null,
      privacyPolicyUrl: body.privacyPolicyUrl || null,
      termsOfServiceUrl: body.termsOfServiceUrl || null,
      reviewNotes: sanitizeText(body.reviewNotes),
      isPublished: body.status === 'published' ? true : body.isPublished
    }
  })

  await logAudit({
    entityType: 'app',
    entityId: app.id,
    appId: app.id,
    action: 'app.updated',
    actor: admin.username,
    before,
    after: app
  })

  return { ok: true, app }
})
