import { prisma } from '../../../utils/db'
import { assertAdmin } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  assertAdmin(event)
  const id = getRouterParam(event, 'id')!
  const app = await prisma.app.findUnique({ where: { id } })
  if (!app) throw createError({ statusCode: 404, statusMessage: 'App not found' })
  return { app }
})
