import { prisma } from '../../utils/db'
import { assertAdmin } from '../../utils/auth'
import { toDateLabel } from '../../utils/format'

export default defineEventHandler(async (event) => {
  assertAdmin(event)
  const query = getQuery(event)

  const status = String(query.status || '').trim()
  const fetchStatus = String(query.fetchStatus || '').trim()
  const analysisStatus = String(query.analysisStatus || '').trim()
  const q = String(query.q || '').trim()
  const page = Math.max(1, Number(query.page || 1))
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)))

  const where: any = {}
  if (status) where.status = status
  if (fetchStatus) where.fetchStatus = fetchStatus
  if (analysisStatus) where.analysisStatus = analysisStatus
  if (q) {
    where.OR = [
      { appName: { contains: q } },
      { privacyUrl: { contains: q } },
      { submitterEmail: { contains: q } }
    ]
  }

  const [total, items] = await Promise.all([
    prisma.userSubmission.count({ where }),
    prisma.userSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ])

  return {
    page,
    pageSize,
    total,
    items: items.map((item) => ({
      ...item,
      createdAtLabel: toDateLabel(item.createdAt),
      updatedAtLabel: toDateLabel(item.updatedAt)
    }))
  }
})
