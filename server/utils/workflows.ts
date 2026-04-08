import { prisma } from './db'
import { fetchPolicyText } from '../../shared/lib/policy'
import { analyzePolicyText } from '../../shared/lib/analysis'
import { slugifyName } from './format'

export async function processSubmission(submissionId: string) {
  const submission = await prisma.userSubmission.findUnique({ where: { id: submissionId } })
  if (!submission) throw new Error('Submission not found')

  await prisma.userSubmission.update({
    where: { id: submissionId },
    data: {
      status: 'processing',
      fetchStatus: 'running',
      analysisStatus: 'queued',
      processingError: null
    }
  })

  try {
    const fetched = await fetchPolicyText(submission.privacyUrl)
    const analysis = await analyzePolicyText(fetched.text)
    const slugBase = slugifyName(submission.appName)
    let slug = slugBase
    let i = 2

    while (
      await prisma.app.findFirst({
        where: {
          slug,
          NOT: submission.linkedAppId ? { id: submission.linkedAppId } : undefined
        }
      })
    ) {
      slug = `${slugBase}-${i++}`
    }

    const existing = submission.linkedAppId
      ? await prisma.app.findUnique({ where: { id: submission.linkedAppId } })
      : await prisma.app.findFirst({ where: { OR: [{ name: submission.appName }, { slug }] } })

    const app = existing
      ? await prisma.app.update({
          where: { id: existing.id },
          data: {
            name: submission.appName,
            slug,
            privacyPolicyUrl: submission.privacyUrl,
            termsOfServiceUrl: submission.termsUrl,
            rawText: fetched.text,
            contentHash: fetched.contentHash,
            analysis,
            analysisSource: analysis,
            riskLevel: analysis.risk_level,
            oneLiner: analysis.one_liner,
            plainSummary: analysis.plain_summary,
            analyzedAt: new Date(),
            lastFetchAt: new Date(),
            sourceType: 'submission',
            sourceSubmissionId: submission.id,
            status: 'review_ready',
            isPublished: false,
            lastError: null
          }
        })
      : await prisma.app.create({
          data: {
            name: submission.appName,
            slug,
            category: 'Uncategorized',
            privacyPolicyUrl: submission.privacyUrl,
            termsOfServiceUrl: submission.termsUrl,
            rawText: fetched.text,
            contentHash: fetched.contentHash,
            analysis,
            analysisSource: analysis,
            riskLevel: analysis.risk_level,
            oneLiner: analysis.one_liner,
            plainSummary: analysis.plain_summary,
            analyzedAt: new Date(),
            lastFetchAt: new Date(),
            sourceType: 'submission',
            sourceSubmissionId: submission.id,
            status: 'review_ready'
          }
        })

    await prisma.policyVersion.create({
      data: {
        appId: app.id,
        versionLabel: `Auto ${new Date().toISOString().slice(0, 10)}`,
        rawText: fetched.text,
        contentHash: fetched.contentHash,
        analysis,
        sourceUrl: submission.privacyUrl
      }
    })

    await prisma.userSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'review_ready',
        fetchStatus: 'success',
        analysisStatus: 'success',
        extractedText: fetched.text.slice(0, 20000),
        extractedHash: fetched.contentHash,
        suggestedRisk: analysis.risk_level,
        analysisDraft: analysis,
        linkedAppId: app.id
      }
    })

    return app
  } catch (error: any) {
    const statusCode = error?.response?.status
    const readableMessage = statusCode
      ? `抓取失败：隐私政策链接返回 ${statusCode}`
      : error?.message || '处理失败'

    await prisma.userSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'failed',
        fetchStatus: 'failed',
        analysisStatus: 'failed',
        processingError: readableMessage
      }
    })
    throw new Error(readableMessage)
  }
}
