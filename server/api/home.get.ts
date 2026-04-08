import { prisma } from '../utils/db'
import { normalizeAnalysis, toDateLabel } from '../utils/format'

function mapApp(app: any) {
  const analysis = normalizeAnalysis(app.analysis)
  return {
    id: app.id,
    slug: app.slug,
    name: app.name,
    category: app.category,
    developer: app.developer,
    riskLevel: app.riskLevel || analysis.riskLevel,
    oneLiner: app.oneLiner || analysis.oneLiner,
    plainSummary: app.plainSummary || analysis.plainSummary,
    updatedAt: app.updatedAt,
    updatedAtLabel: toDateLabel(app.updatedAt)
  }
}

export default defineEventHandler(async () => {
  const where = { isPublished: true }
  const [hotApps, latestApps, criticalApps] = await Promise.all([
    prisma.app.findMany({ where, orderBy: [{ featured: 'desc' }, { updatedAt: 'desc' }], take: 6 }),
    prisma.app.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 5 }),
    prisma.app.findMany({ where: { isPublished: true, OR: [{ warningPinned: true }, { riskLevel: { in: ['high', 'critical'] } }] }, orderBy: { analyzedAt: 'desc' }, take: 5 })
  ])
  return { hotApps: hotApps.map(mapApp), latestApps: latestApps.map(mapApp), criticalApps: criticalApps.map(mapApp) }
})
