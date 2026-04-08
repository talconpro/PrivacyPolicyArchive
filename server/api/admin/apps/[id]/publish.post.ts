import { prisma } from '../../../../utils/db'
import { assertAdmin } from '../../../../utils/auth'
import { logAudit } from '../../../../utils/audit'
import { throwApiError } from '../../../../utils/api'

export default defineEventHandler(async (event) => {
  const admin = assertAdmin(event)
  const id = getRouterParam(event, 'id')!
  const before = await prisma.app.findUnique({ where: { id } })

  if (!before) {
    throwApiError({ statusCode: 404, code: 'APP_NOT_FOUND', message: '应用不存在' })
  }

  const app = await prisma.app.update({
    where: { id },
    data: { status: 'published', isPublished: true }
  })

  await logAudit({
    entityType: 'app',
    entityId: id,
    appId: id,
    action: 'app.published',
    actor: admin.username,
    before,
    after: app
  })

  return { ok: true }
})
