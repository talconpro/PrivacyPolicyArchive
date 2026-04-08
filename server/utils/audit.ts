import { prisma } from './db'

export async function logAudit(input: {
  entityType: string
  entityId: string
  action: string
  actor: string
  appId?: string | null
  before?: any
  after?: any
}) {
  await prisma.auditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actor: input.actor,
      appId: input.appId || null,
      before: input.before,
      after: input.after
    }
  })
}
