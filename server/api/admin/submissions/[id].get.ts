import { prisma } from '../../../utils/db'
import { assertAdmin } from '../../../utils/auth'
import { toDateLabel } from '../../../utils/format'

export default defineEventHandler(async (event) => {
  assertAdmin(event)
  const id = getRouterParam(event, 'id')!
  const submission = await prisma.userSubmission.findUnique({ where: { id } })
  if (!submission) throw createError({ statusCode: 404, statusMessage: 'Submission not found' })
  const linkedApp = submission.linkedAppId ? await prisma.app.findUnique({ where: { id: submission.linkedAppId } }) : null
  return {
    submission: {
      ...submission,
      createdAtLabel: toDateLabel(submission.createdAt),
      updatedAtLabel: toDateLabel(submission.updatedAt)
    },
    linkedApp
  }
})
