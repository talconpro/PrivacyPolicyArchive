import { createHash } from 'node:crypto';

import {
  DocumentType,
  FetchStatus as PrismaFetchStatus,
  ReviewStatus,
  RiskLevel,
  type App,
} from '@prisma/client';

import { analyzeWithDeepseek } from '../src/analyzer/deepseek';
import { generateChangeSummary } from '../src/analyzer/changeSummary';
import { normalizeAnalysisResult } from '../src/analyzer/normalize';
import { decideReview } from '../src/analyzer/review';
import { calculateRiskScore } from '../src/analyzer/riskScorer';
import { fetchPolicyByUrl } from '../src/crawler/fetcher';
import { TaskLogger } from '../src/lib/logger';
import { prisma } from '../src/lib/prisma';
import {
  type SnapshotAppDetail,
  type SnapshotAppIndexItem,
  writeSnapshots,
} from '../src/lib/snapshot';
import { getNextVersionNo, isContentChanged } from '../src/lib/versioning';
import type { FetchStatus as CrawlerFetchStatus } from '../src/types/fetch';

interface AppWithLatestPolicy extends App {
  policies: Array<{
    id: string;
    sourceUrl: string;
    contentHash: string;
    versionNo: number;
    isCurrent: boolean;
    normalizedText: string;
    fetchedAt: Date;
  }>;
}

interface UpdateStats {
  totalApps: number;
  fetchedSuccess: number;
  skippedUnchanged: number;
  analyzed: number;
  failed: number;
  reviewQueued: number;
}

function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function mapFetchStatus(status: CrawlerFetchStatus): PrismaFetchStatus {
  switch (status) {
    case 'SUCCESS':
      return PrismaFetchStatus.SUCCESS;
    case 'NEEDS_REVIEW':
      return PrismaFetchStatus.NEEDS_REVIEW;
    case 'FAILED':
    default:
      return PrismaFetchStatus.FAILED;
  }
}

function mapRiskLevel(level: string): RiskLevel {
  if (level === 'LOW') {
    return RiskLevel.LOW;
  }
  if (level === 'MEDIUM') {
    return RiskLevel.MEDIUM;
  }
  if (level === 'HIGH') {
    return RiskLevel.HIGH;
  }
  if (level === 'CRITICAL') {
    return RiskLevel.CRITICAL;
  }

  return RiskLevel.UNKNOWN;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function printStats(stats: UpdateStats): void {
  console.log('\n===== Update Summary =====');
  console.log(`total apps: ${stats.totalApps}`);
  console.log(`fetched success: ${stats.fetchedSuccess}`);
  console.log(`skipped unchanged: ${stats.skippedUnchanged}`);
  console.log(`analyzed: ${stats.analyzed}`);
  console.log(`failed: ${stats.failed}`);
  console.log(`review queued: ${stats.reviewQueued}`);
}

function resolvePolicyUrl(app: AppWithLatestPolicy): string | null {
  const latestPolicyUrl = app.policies[0]?.sourceUrl?.trim();
  if (latestPolicyUrl) {
    return latestPolicyUrl;
  }

  const websiteUrl = app.websiteUrl?.trim();
  if (websiteUrl) {
    return websiteUrl;
  }

  return null;
}

async function loadPendingApps(): Promise<AppWithLatestPolicy[]> {
  return prisma.app.findMany({
    orderBy: [{ createdAt: 'asc' }],
    include: {
      policies: {
        orderBy: [{ fetchedAt: 'desc' }],
        take: 2,
        select: {
          id: true,
          sourceUrl: true,
          contentHash: true,
          versionNo: true,
          isCurrent: true,
          normalizedText: true,
          fetchedAt: true,
        },
      },
    },
  });
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string')) {
      return parsed;
    }
  } catch {
    return [];
  }

  return [];
}

function parseNormalizedPayload(value: string | null | undefined): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
}

function toBooleanMap(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const map: Record<string, boolean> = {};
  for (const [key, entry] of Object.entries(value)) {
    map[key] = Boolean(entry);
  }

  return map;
}

async function buildAndWriteSnapshot(logger: TaskLogger): Promise<void> {
  const apps = await prisma.app.findMany({
    orderBy: [{ name: 'asc' }],
    include: {
      policies: {
        orderBy: [{ fetchedAt: 'desc' }],
        select: {
          id: true,
          versionNo: true,
          fetchedAt: true,
          isCurrent: true,
          analyses: {
            orderBy: [{ createdAt: 'desc' }],
            take: 1,
            select: {
              oneLineSummary: true,
              summary: true,
              riskScore: true,
              riskLevel: true,
              riskReasons: true,
              confidence: true,
              needsHumanReview: true,
              normalizedPayload: true,
              createdAt: true,
            },
          },
        },
      },
      changeSummaries: {
        orderBy: [{ createdAt: 'desc' }],
        take: 1,
        select: {
          changeSummary: true,
          changeHighlights: true,
          createdAt: true,
        },
      },
    },
  });

  const appDetails: Record<string, SnapshotAppDetail> = {};
  const appsIndex: SnapshotAppIndexItem[] = [];
  const compareIndex: Record<string, SnapshotAppIndexItem> = {};
  const categoryCounter = new Map<string, number>();

  for (const app of apps) {
    const currentPolicy = app.policies.find((policy) => policy.isCurrent) ?? app.policies[0];
    if (!currentPolicy) {
      continue;
    }

    const latestAnalysis = currentPolicy.analyses[0];
    const normalizedPayload = parseNormalizedPayload(latestAnalysis?.normalizedPayload);

    const detail: SnapshotAppDetail = {
      id: app.id,
      slug: app.slug ?? app.id,
      name: app.name,
      iconUrl: app.iconUrl,
      category: app.category,
      developer: app.developer,
      officialPolicyUrl: app.websiteUrl,
      oneLineSummary: latestAnalysis?.oneLineSummary ?? 'Summary unavailable.',
      plainSummary: latestAnalysis?.summary ?? 'No summary available.',
      riskLevel: latestAnalysis?.riskLevel ?? RiskLevel.UNKNOWN,
      riskScore: Math.round(latestAnalysis?.riskScore ?? 0),
      riskReasons: parseJsonArray(latestAnalysis?.riskReasons),
      keyFindings: Array.isArray(normalizedPayload.keyFindings)
        ? normalizedPayload.keyFindings.filter((entry): entry is string => typeof entry === 'string')
        : [],
      dataCollected: Array.isArray(normalizedPayload.dataCollected)
        ? normalizedPayload.dataCollected.filter((entry): entry is string => typeof entry === 'string')
        : [],
      dataSharedWith: Array.isArray(normalizedPayload.dataSharedWith)
        ? normalizedPayload.dataSharedWith.filter((entry): entry is string => typeof entry === 'string')
        : [],
      userRights: toBooleanMap(normalizedPayload.userRights),
      redFlags: Array.isArray(normalizedPayload.redFlags)
        ? normalizedPayload.redFlags.filter((entry): entry is string => typeof entry === 'string')
        : [],
      confidence: latestAnalysis?.confidence ?? 0,
      needsHumanReview: latestAnalysis?.needsHumanReview ?? false,
      lastAnalyzedAt: (latestAnalysis?.createdAt ?? currentPolicy.fetchedAt).toISOString(),
      historyVersions: app.policies.map((policy) => ({
        id: policy.id,
        versionNo: policy.versionNo,
        fetchedAt: policy.fetchedAt.toISOString(),
        isCurrent: policy.isCurrent,
      })),
      latestChange: app.changeSummaries[0]
        ? {
            changeSummary: app.changeSummaries[0].changeSummary,
            changeHighlights: parseJsonArray(app.changeSummaries[0].changeHighlights),
            createdAt: app.changeSummaries[0].createdAt.toISOString(),
          }
        : null,
    };

    appDetails[detail.id] = detail;

    const indexItem: SnapshotAppIndexItem = {
      id: detail.id,
      slug: detail.slug,
      name: detail.name,
      iconUrl: detail.iconUrl,
      category: detail.category,
      developer: detail.developer,
      riskLevel: detail.riskLevel,
      riskScore: detail.riskScore,
      oneLineSummary: detail.oneLineSummary,
      lastAnalyzedAt: detail.lastAnalyzedAt,
    };

    appsIndex.push(indexItem);
    compareIndex[indexItem.id] = indexItem;
    compareIndex[indexItem.slug] = indexItem;

    if (detail.category) {
      categoryCounter.set(detail.category, (categoryCounter.get(detail.category) ?? 0) + 1);
    }
  }

  const categories = [...categoryCounter.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  writeSnapshots({
    appsIndex,
    appDetails,
    categories,
    compareIndex,
    generatedAt: new Date().toISOString(),
  });

  logger.info({
    stage: 'snapshot',
    message: 'snapshot files generated',
    extra: {
      apps: appsIndex.length,
      categories: categories.length,
    },
  });
}

async function runUpdate(): Promise<void> {
  const logger = new TaskLogger(`logs/update-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
  const apps = await loadPendingApps();

  const stats: UpdateStats = {
    totalApps: apps.length,
    fetchedSuccess: 0,
    skippedUnchanged: 0,
    analyzed: 0,
    failed: 0,
    reviewQueued: 0,
  };

  logger.info({ stage: 'discover', message: `loaded apps`, extra: { count: apps.length } });

  for (const app of apps) {
    logger.info({ stage: 'start', appId: app.id, appName: app.name, message: 'processing app' });

    try {
      const policyUrl = resolvePolicyUrl(app);
      if (!policyUrl) {
        stats.failed += 1;
        logger.error({
          stage: 'discover',
          appId: app.id,
          appName: app.name,
          message: 'missing privacy policy URL',
        });
        continue;
      }

      const fetchResult = await fetchPolicyByUrl(policyUrl);
      if (fetchResult.fetchStatus === 'FAILED') {
        stats.failed += 1;
        logger.error({
          stage: 'fetch',
          appId: app.id,
          appName: app.name,
          message: 'fetch failed',
          extra: { errorMessage: fetchResult.errorMessage },
        });
        continue;
      }

      stats.fetchedSuccess += 1;
      logger.info({
        stage: 'fetch',
        appId: app.id,
        appName: app.name,
        message: 'fetch success',
        extra: {
          status: fetchResult.fetchStatus,
          parser: fetchResult.parserUsed,
          contentType: fetchResult.contentType,
        },
      });
      logger.info({
        stage: 'parse',
        appId: app.id,
        appName: app.name,
        message: 'content parsed',
        extra: {
          rawLength: fetchResult.rawText.length,
          normalizedLength: fetchResult.normalizedText.length,
        },
      });

      const currentHash = computeContentHash(fetchResult.normalizedText);
      const currentPolicy = app.policies.find((policy) => policy.isCurrent) ?? app.policies[0];
      const previousHash = currentPolicy?.contentHash;

      if (!isContentChanged(previousHash, currentHash)) {
        stats.skippedUnchanged += 1;
        logger.info({
          stage: 'versioning',
          appId: app.id,
          appName: app.name,
          message: 'skipped unchanged content hash',
        });
        continue;
      }

      const existingHashPolicy = await prisma.policyVersion.findUnique({
        where: {
          appId_contentHash: {
            appId: app.id,
            contentHash: currentHash,
          },
        },
        select: {
          id: true,
          versionNo: true,
          isCurrent: true,
        },
      });

      if (existingHashPolicy) {
        stats.skippedUnchanged += 1;
        logger.info({
          stage: 'versioning',
          appId: app.id,
          appName: app.name,
          message: 'skipped existing content hash',
          extra: {
            existingPolicyVersionId: existingHashPolicy.id,
            existingVersionNo: existingHashPolicy.versionNo,
            isCurrent: existingHashPolicy.isCurrent,
          },
        });
        continue;
      }

      const previousVersion = currentPolicy;
      const newVersionNo = getNextVersionNo(previousVersion?.versionNo);

      const policyVersion = await prisma.$transaction(async (tx) => {
        if (previousVersion) {
          await tx.policyVersion.updateMany({
            where: { appId: app.id, isCurrent: true },
            data: { isCurrent: false },
          });
        }

        return tx.policyVersion.create({
          data: {
            appId: app.id,
            documentType: DocumentType.PRIVACY_POLICY,
            sourceUrl: policyUrl,
            checksum: currentHash,
            contentHash: currentHash,
            versionNo: newVersionNo,
            isCurrent: true,
            rawText: fetchResult.rawText,
            normalizedText: fetchResult.normalizedText,
            contentType: fetchResult.contentType,
            fetchStatus: mapFetchStatus(fetchResult.fetchStatus),
          },
        });
      });

      logger.info({
        stage: 'versioning',
        appId: app.id,
        appName: app.name,
        message: 'new policy version created',
        extra: { policyVersionId: policyVersion.id, versionNo: newVersionNo },
      });

      let analyzed;
      try {
        analyzed = await analyzeWithDeepseek({
          app: {
            appId: app.id,
            appName: app.name,
            bundleId: app.bundleId ?? undefined,
            websiteUrl: app.websiteUrl ?? undefined,
            category: app.category ?? undefined,
          },
          policyText: fetchResult.normalizedText,
        });
      } catch (error) {
        logger.warn({
          stage: 'analyze',
          appId: app.id,
          appName: app.name,
          message: 'analyzer failed, fallback normalized analysis will be used',
          extra: { error: formatError(error) },
        });

        const fallback = normalizeAnalysisResult({ promptVersion: 'fallback' });
        analyzed = {
          analysis: fallback.value,
          modelUsed: 'fallback',
          attempts: 1,
          warnings: fallback.warnings,
        };
      }

      if (analyzed.warnings.length > 0) {
        logger.warn({
          stage: 'analyze',
          appId: app.id,
          appName: app.name,
          message: 'analysis normalization warnings',
          extra: { warnings: analyzed.warnings },
        });
      }

      const scored = calculateRiskScore({
        structuredFlags: analyzed.analysis.structuredFlags,
        dataCollected: analyzed.analysis.dataCollected,
        dataSharedWith: analyzed.analysis.dataSharedWith,
        userRights: analyzed.analysis.userRights,
        redFlags: analyzed.analysis.redFlags,
      });

      const review = decideReview({
        riskLevel: scored.riskLevel,
        confidence: analyzed.analysis.confidence,
        normalizedTextLength: fetchResult.normalizedText.length,
        redFlags: analyzed.analysis.redFlags,
      });

      const needsHumanReview = analyzed.analysis.needsHumanReview || review.needsHumanReview;
      if (needsHumanReview) {
        stats.reviewQueued += 1;
      }

      await prisma.analysis.create({
        data: {
          policyVersionId: policyVersion.id,
          oneLineSummary: analyzed.analysis.oneLineSummary,
          summary: analyzed.analysis.plainSummary,
          riskScore: scored.riskScore,
          riskLevel: mapRiskLevel(scored.riskLevel),
          riskReasons: JSON.stringify(scored.reasons.slice(0, 10)),
          confidence: analyzed.analysis.confidence,
          needsHumanReview,
          reviewStatus: needsHumanReview ? ReviewStatus.PENDING : ReviewStatus.APPROVED,
          reviewReason: review.reviewReason,
          reviewPriority: review.reviewPriority,
          normalizedPayload: JSON.stringify(analyzed.analysis),
          modelName: analyzed.modelUsed,
        },
      });

      stats.analyzed += 1;
      logger.info({
        stage: 'persist',
        appId: app.id,
        appName: app.name,
        message: 'analysis persisted',
        extra: {
          riskLevel: scored.riskLevel,
          riskScore: scored.riskScore,
          reviewQueued: needsHumanReview,
        },
      });

      if (previousVersion) {
        try {
          const summary = await generateChangeSummary(previousVersion.normalizedText, fetchResult.normalizedText);

          await prisma.policyChangeSummary.upsert({
            where: {
              fromVersionId_toVersionId: {
                fromVersionId: previousVersion.id,
                toVersionId: policyVersion.id,
              },
            },
            update: {
              changeSummary: summary.changeSummary,
              changeHighlights: JSON.stringify(summary.changeHighlights),
            },
            create: {
              appId: app.id,
              fromVersionId: previousVersion.id,
              toVersionId: policyVersion.id,
              changeSummary: summary.changeSummary,
              changeHighlights: JSON.stringify(summary.changeHighlights),
            },
          });

          logger.info({
            stage: 'changeSummary',
            appId: app.id,
            appName: app.name,
            message: 'change summary generated',
          });
        } catch (error) {
          logger.warn({
            stage: 'changeSummary',
            appId: app.id,
            appName: app.name,
            message: 'change summary failed and was skipped',
            extra: {
              error: formatError(error),
            },
          });
        }
      } else {
        logger.info({
          stage: 'changeSummary',
          appId: app.id,
          appName: app.name,
          message: 'change summary skipped due to missing previous version',
        });
      }
    } catch (error) {
      stats.failed += 1;
      logger.error({
        stage: 'app-failed',
        appId: app.id,
        appName: app.name,
        message: 'app processing failed',
        extra: { error: formatError(error) },
      });
    }
  }

  await buildAndWriteSnapshot(logger);
  printStats(stats);
  logger.info({ stage: 'summary', message: 'pipeline finished', extra: stats });
}

runUpdate()
  .catch((error) => {
    console.error(`Fatal error: ${formatError(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
