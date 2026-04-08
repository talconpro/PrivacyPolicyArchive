import { PrismaClient } from '@prisma/client'
import { fetchPolicyText } from '../shared/lib/policy'
import { analyzePolicyText } from '../shared/lib/analysis'

const prisma = new PrismaClient()

async function main() {
  const apps = await prisma.app.findMany({ where: { isPublished: true }, orderBy: { updatedAt: 'asc' }, take: 20 })

  for (const app of apps) {
    if (!app.privacyPolicyUrl) continue
    try {
      const fetched = await fetchPolicyText(app.privacyPolicyUrl)
      if (app.contentHash === fetched.contentHash) {
        console.log(`[skip] ${app.name}`)
        continue
      }
      const analysis = await analyzePolicyText(fetched.text)
      await prisma.app.update({
        where: { id: app.id },
        data: {
          rawText: fetched.text,
          contentHash: fetched.contentHash,
          analysis,
          analysisSource: analysis,
          riskLevel: analysis.risk_level,
          oneLiner: analysis.one_liner,
          plainSummary: analysis.plain_summary,
          analyzedAt: new Date(),
          lastFetchAt: new Date(),
          status: app.isPublished ? 'published' : 'review_ready'
        }
      })
      await prisma.policyVersion.create({
        data: {
          appId: app.id,
          versionLabel: `Weekly ${new Date().toISOString().slice(0, 10)}`,
          rawText: fetched.text,
          contentHash: fetched.contentHash,
          analysis,
          sourceUrl: app.privacyPolicyUrl
        }
      })
      console.log(`[updated] ${app.name}`)
    } catch (error: any) {
      await prisma.app.update({ where: { id: app.id }, data: { lastError: error?.message || 'weekly maintenance failed' } })
      console.error(`[failed] ${app.name}`, error)
    }
  }
}

main().finally(() => prisma.$disconnect())
