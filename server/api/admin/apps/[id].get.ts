import { prisma } from '../../../utils/db'
import { assertAdmin } from '../../../utils/auth'
import { normalizeAnalysis, toDateLabel } from '../../../utils/format'

export default defineEventHandler(async (event) => {
  assertAdmin(event)
  const id = getRouterParam(event, 'id')!
  const app = await prisma.app.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { createdAt: 'desc' }, take: 10 },
      logs: { orderBy: { createdAt: 'desc' }, take: 20 }
    }
  })
  if (!app) throw createError({ statusCode: 404, statusMessage: 'App not found' })
  return {
    app: {
      ...app,
      normalizedAnalysis: normalizeAnalysis(app.analysis),
      versions: app.versions.map((item) => ({ ...item, createdAtLabel: toDateLabel(item.createdAt) })),
      logs: app.logs.map((item) => ({ ...item, createdAtLabel: toDateLabel(item.createdAt) }))
    }
  }
})
