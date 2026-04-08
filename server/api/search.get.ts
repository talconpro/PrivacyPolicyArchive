import { prisma } from '../utils/db'
import { normalizeAnalysis } from '../utils/format'

export default defineEventHandler(async (event) => {
  const q = (getQuery(event).q as string || '').trim()
  const category = (getQuery(event).category as string || '').trim()
  const risk = (getQuery(event).risk as string || '').trim()
  const where: any = { isPublished: true }
  if (q) where.OR = [{ name: { contains: q } }, { developer: { contains: q } }, { slug: { contains: q } }]
  if (category) where.category = category
  if (risk) where.riskLevel = risk
  const [items, categories] = await Promise.all([
    prisma.app.findMany({ where, orderBy: { updatedAt: 'desc' }, take: q ? 20 : 50 }),
    prisma.app.findMany({ where: { isPublished: true }, distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } })
  ])
  return {
    categories: categories.map((item) => item.category),
    items: items.map((app) => {
      const analysis = normalizeAnalysis(app.analysis)
      return {
        id: app.id,
        slug: app.slug,
        name: app.name,
        category: app.category,
        riskLevel: app.riskLevel || analysis.riskLevel,
        oneLiner: app.oneLiner || analysis.oneLiner,
        updatedAt: app.updatedAt
      }
    })
  }
})
