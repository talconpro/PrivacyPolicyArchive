import { z } from 'zod'
import { prisma } from '../utils/db'
import { normalizeAnalysis } from '../utils/format'

const schema = z.object({ slugs: z.array(z.string()).min(2).max(4) })

export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event))
  const apps = await prisma.app.findMany({ where: { slug: { in: body.slugs }, isPublished: true } })
  return {
    items: apps.map((app) => ({
      id: app.id,
      slug: app.slug,
      name: app.name,
      category: app.category,
      riskLevel: app.riskLevel,
      ...normalizeAnalysis(app.analysis)
    }))
  }
})
