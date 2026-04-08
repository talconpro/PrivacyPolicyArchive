import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '../utils/db'
import { sanitizeText } from '../utils/sanitize'
import { verifyCaptcha } from '../utils/captcha'
import { createJob } from '../utils/jobs'
import { throwApiError } from '../utils/api'

const schema = z.object({
  appName: z.string().min(1).max(100),
  privacyUrl: z.string().url(),
  termsUrl: z.string().url().optional().or(z.literal('')),
  remark: z.string().max(1000).optional().or(z.literal('')),
  submitterEmail: z.string().email().optional().or(z.literal('')),
  captchaToken: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event))
  await verifyCaptcha(body.captchaToken)

  const ip = getRequestIP(event, { xForwardedFor: true }) || '0.0.0.0'
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex')
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const count = await prisma.userSubmission.count({ where: { ipHash, createdAt: { gte: todayStart } } })
  if (count >= 5) {
    throwApiError({ statusCode: 429, code: 'RATE_LIMITED', message: '??????????' })
  }

  const duplicated = await prisma.userSubmission.findFirst({
    where: {
      appName: body.appName,
      privacyUrl: body.privacyUrl,
      status: { in: ['pending', 'processing', 'review_ready'] }
    }
  })

  if (duplicated) {
    throwApiError({ statusCode: 409, code: 'DUPLICATED_SUBMISSION', message: '???????????' })
  }

  await prisma.userSubmission.updateMany({
    where: {
      appName: body.appName,
      privacyUrl: body.privacyUrl,
      status: 'needs_revision'
    },
    data: { status: 'superseded' }
  })

  const item = await prisma.userSubmission.create({
    data: {
      appName: body.appName,
      privacyUrl: body.privacyUrl,
      termsUrl: body.termsUrl || null,
      remark: sanitizeText(body.remark),
      submitterEmail: body.submitterEmail || null,
      ipHash,
      status: 'pending'
    }
  })

  await createJob('submission_ingest', 'submission', item.id, { appName: body.appName })
  return { ok: true, id: item.id }
})
