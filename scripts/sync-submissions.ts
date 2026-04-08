import { PrismaClient } from '@prisma/client'
import { fetchPolicyText } from '../shared/lib/policy'
import { analyzePolicyText } from '../shared/lib/analysis'
import slugify from 'slugify'

const prisma = new PrismaClient()

function slugifyName(name: string) {
  return slugify(name, { lower: true, strict: true, locale: 'zh' }) || `app-${Date.now()}`
}

async function processOne(submissionId: string) {
  const submission = await prisma.userSubmission.findUnique({ where: { id: submissionId } })
  if (!submission) return

  await prisma.userSubmission.update({ where: { id: submissionId }, data: { status: 'processing', fetchStatus: 'running', analysisStatus: 'queued', processingError: null } })

  try {
    const fetched = await fetchPolicyText(submission.privacyUrl)
    const analysis = await analyzePolicyText(fetched.text)
    const slug = slugifyName(submission.appName)
    const existing = await prisma.app.findFirst({ where: { OR: [{ name: submission.appName }, { slug }] } })

    const app = existing
      ? await prisma.app.update({
          where: { id: existing.id },
          data: {
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
            status: 'review_ready',
            sourceType: 'submission',
            sourceSubmissionId: submission.id
          }
        })
      : await prisma.app.create({
          data: {
            slug,
            name: submission.appName,
            category: '待分类',
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
            status: 'review_ready',
            sourceType: 'submission',
            sourceSubmissionId: submission.id
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
      where: { id: submission.id },
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

    console.log(`Processed: ${submission.appName}`)
  } catch (error: any) {
    await prisma.userSubmission.update({
      where: { id: submission.id },
      data: { status: 'failed', fetchStatus: 'failed', analysisStatus: 'failed', processingError: error?.message || '处理失败' }
    })
    console.error(`Failed: ${submission.appName}`, error)
  }
}

async function main() {
  const pending = await prisma.userSubmission.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' }, take: 20 })
  for (const item of pending) await processOne(item.id)
}

main().finally(() => prisma.$disconnect())
