import { prisma } from '../../utils/db'
import { assertAdmin } from '../../utils/auth'
import { normalizeAnalysis, toDateLabel } from '../../utils/format'

export default defineEventHandler(async (event) => {
  assertAdmin(event)
  const query = getQuery(event)
  const q = String(query.q || '').trim()
  const status = String(query.status || '').trim()
  const risk = String(query.risk || '').trim()
  const page = Math.max(1, Number(query.page || 1))
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)))

  const where: any = {}
  if (q) {
    where.OR = [{ name: { contains: q } }, { developer: { contains: q } }, { slug: { contains: q } }]
  }
  if (status) where.status = status
  if (risk) where.riskLevel = risk

  const [items, total, totalApps, pendingSubmissions, highRiskApps] = await Promise.all([
    prisma.app.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.app.count({ where }),
    prisma.app.count({ where: { isPublished: true } }),
    prisma.userSubmission.count({ where: { status: { in: ['pending', 'processing', 'review_ready'] } } }),
    prisma.app.count({ where: { riskLevel: { in: ['high', 'critical'] } } })
  ])

  return {
    summary: { totalApps, pendingSubmissions, highRiskApps },
    page,
    pageSize,
    total,
    items: items.map((app) => {
      const analysis = normalizeAnalysis(app.analysis)
      return {
        ...app,
        riskLevel: app.riskLevel || analysis.riskLevel,
        updatedAtLabel: toDateLabel(app.updatedAt),
        analyzedAtLabel: toDateLabel(app.analyzedAt)
      }
    })
  }
})
