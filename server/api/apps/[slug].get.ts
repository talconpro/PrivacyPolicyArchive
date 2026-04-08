import { prisma } from '../../utils/db'
import { normalizeAnalysis, toDateLabel } from '../../utils/format'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!
  const app = await prisma.app.findUnique({ where: { slug }, include: { versions: { orderBy: { createdAt: 'desc' }, take: 6 } } })
  if (!app || !app.isPublished) throw createError({ statusCode: 404, statusMessage: 'App not found' })
  const analysis = normalizeAnalysis(app.analysis)
  const similar = await prisma.app.findMany({ where: { category: app.category, id: { not: app.id }, isPublished: true }, select: { name: true, slug: true }, take: 4 })

  return {
    id: app.id,
    slug: app.slug,
    name: app.name,
    category: app.category,
    developer: app.developer,
    iconUrl: app.iconUrl,
    privacyPolicyUrl: app.privacyPolicyUrl,
    termsOfServiceUrl: app.termsOfServiceUrl,
    analyzedAtLabel: toDateLabel(app.analyzedAt),
    updatedAtLabel: toDateLabel(app.updatedAt),
    similarApps: similar,
    versions: app.versions.map((item) => ({ id: item.id, versionLabel: item.versionLabel, createdAtLabel: toDateLabel(item.createdAt) })),
    ...analysis,
    riskLevel: app.riskLevel || analysis.riskLevel,
    oneLiner: app.oneLiner || analysis.oneLiner,
    plainSummary: app.plainSummary || analysis.plainSummary
  }
})
