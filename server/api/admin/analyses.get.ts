import { prisma } from '../../utils/db'
import { assertAdmin } from '../../utils/auth'
import { toDateLabel } from '../../utils/format'

export default defineEventHandler(async (event) => {
  assertAdmin(event)
  const query = getQuery(event)
  const q = String(query.q || '').trim()
  const page = Math.max(1, Number(query.page || 1))
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)))

  const where = q
    ? {
        OR: [{ name: { contains: q } }, { slug: { contains: q } }, { category: { contains: q } }]
      }
    : {}

  const [total, items] = await Promise.all([
    prisma.app.count({ where }),
    prisma.app.findMany({
      where,
      orderBy: { analyzedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ])

  return {
    page,
    pageSize,
    total,
    items: items.map((app) => ({
      id: app.id,
      name: app.name,
      riskLevel: app.riskLevel,
      status: app.status,
      analyzedAtLabel: toDateLabel(app.analyzedAt),
      oneLiner: app.oneLiner
    }))
  }
})
