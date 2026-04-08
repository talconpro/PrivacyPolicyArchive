import { prisma } from '../utils/db'

export default defineEventHandler(async () => {
  const rows = await prisma.app.groupBy({
    by: ['category'],
    where: { isPublished: true },
    _count: { category: true },
    orderBy: { _count: { category: 'desc' } }
  })
  return {
    items: rows.map((row) => ({ category: row.category, count: row._count.category }))
  }
})
