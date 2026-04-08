import { prisma } from '../../utils/db'
import { assertAdmin } from '../../utils/auth'
import { toDateLabel } from '../../utils/format'

export default defineEventHandler(async (event) => {
  assertAdmin(event)
  const items = await prisma.crawlJob.findMany({ orderBy: { startedAt: 'desc' }, take: 100 })

  return {
    items: items.map((job) => ({
      ...job,
      startedAtLabel: toDateLabel(job.startedAt),
      finishedAtLabel: toDateLabel(job.finishedAt),
      retryable: job.status === 'failed'
    }))
  }
})
