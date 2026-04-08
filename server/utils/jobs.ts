import { prisma } from './db'

export async function createJob(type: string, targetType?: string, targetId?: string, meta?: any) {
  return prisma.crawlJob.create({
    data: { type, targetType, targetId, meta, status: 'queued' }
  })
}

export async function runJob<T>(jobId: string, work: () => Promise<T>, summary?: string) {
  await prisma.crawlJob.update({ where: { id: jobId }, data: { status: 'running', startedAt: new Date() } })
  try {
    const result = await work()
    await prisma.crawlJob.update({ where: { id: jobId }, data: { status: 'success', finishedAt: new Date(), summary } })
    return result
  } catch (error: any) {
    await prisma.crawlJob.update({
      where: { id: jobId },
      data: { status: 'failed', finishedAt: new Date(), summary: error?.message || '??????', log: String(error?.stack || error) }
    })
    throw error
  }
}
