import { createHash } from 'node:crypto';

import {
  FetchStatus as PrismaFetchStatus,
  ReviewStatus,
  RiskLevel as PrismaRiskLevel,
  SubmissionStatus,
  type App,
  type PrismaClient,
  type UserSubmission,
} from '@prisma/client';

import { analyzeWithDeepseek } from '../../analyzer/deepseek';
import { normalizeAnalysisResult } from '../../analyzer/normalize';
import { decideReview } from '../../analyzer/review';
import { calculateRiskScore } from '../../analyzer/riskScorer';
import { fetchPolicyByUrl } from '../../crawler/fetcher';
import { TaskLogger } from '../logger';
import { prisma } from '../prisma';
import { findAppByNameFromItunes } from '../enrichment/itunes';
import { normalizeUrlFingerprint } from './urlFingerprint';

interface StoredReviewPayload {
  submitterNote?: string;
  error?: string;
  fetch?: {
    sourceUrl: string;
    contentType: string;
    fetchStatus: string;
    rawText: string;
    normalizedText: string;
  };
  contentHash?: string;
  analysis?: ReturnType<typeof normalizeAnalysisResult>['value'];
  scoring?: ReturnType<typeof calculateRiskScore>;
  reviewDecision?: ReturnType<typeof decideReview>;
  enrichment?: {
    trackId?: number;
    developer?: string;
    iconUrl?: string;
  };
}

export interface ProcessSubmissionResult {
  total: number;
  movedToNeedsReview: number;
  requeued: number;
  failed: number;
}

export interface ProcessSubmissionsOptions {
  limit?: number;
  logger?: TaskLogger;
}

export interface ApproveSubmissionOptions {
  adminNote?: string;
  override?: {
    oneLineSummary?: string;
    plainSummary?: string;
    riskScore?: number;
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';
  };
}

function toPrismaRiskLevel(level: string): PrismaRiskLevel {
  switch (level) {
    case 'LOW':
      return PrismaRiskLevel.LOW;
    case 'MEDIUM':
      return PrismaRiskLevel.MEDIUM;
    case 'HIGH':
      return PrismaRiskLevel.HIGH;
    case 'CRITICAL':
      return PrismaRiskLevel.CRITICAL;
    default:
      return PrismaRiskLevel.UNKNOWN;
  }
}

function toPrismaFetchStatus(status: string): PrismaFetchStatus {
  switch (status) {
    case 'SUCCESS':
      return PrismaFetchStatus.SUCCESS;
    case 'NEEDS_REVIEW':
      return PrismaFetchStatus.NEEDS_REVIEW;
    default:
      return PrismaFetchStatus.FAILED;
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function computeContentHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function parseReviewPayload(raw: string | null): StoredReviewPayload {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as StoredReviewPayload;
    }
  } catch {
    return {};
  }

  return {};
}

async function resolveMergeTarget(client: PrismaClient, submission: UserSubmission): Promise<App | null> {
  let bySourceUrl: App | null = null;
  let submissionFingerprint: string | null = null;

  try {
    submissionFingerprint = normalizeUrlFingerprint(submission.privacyUrl);
  } catch {
    submissionFingerprint = submission.normalizedUrlFingerprint || null;
  }

  if (submissionFingerprint) {
    const policyCandidates = await client.policyVersion.findMany({
      select: {
        sourceUrl: true,
        app: true,
      },
      orderBy: [{ fetchedAt: 'desc' }],
      take: 2000,
    });

    for (const candidate of policyCandidates) {
      let candidateFingerprint: string | null = null;
      try {
        candidateFingerprint = normalizeUrlFingerprint(candidate.sourceUrl);
      } catch {
        candidateFingerprint = null;
      }

      if (candidateFingerprint && candidateFingerprint === submissionFingerprint) {
        bySourceUrl = candidate.app;
        break;
      }
    }
  }

  const byName = await client.app.findFirst({
    where: {
      name: submission.appName,
    },
  });

  return selectMergePriorityTarget(bySourceUrl, byName ?? null);
}

export function selectMergePriorityTarget<T>(byUrl: T | null, byName: T | null): T | null {
  if (byUrl) {
    return byUrl;
  }

  if (byName) {
    return byName;
  }

  return null;
}

function slugify(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'app';
}

async function createUniqueSlug(client: PrismaClient, appName: string): Promise<string> {
  const base = slugify(appName);
  let candidate = base;
  let suffix = 2;

  while (true) {
    const exists = await client.app.findUnique({
      where: {
        slug: candidate,
      },
      select: { id: true },
    });

    if (!exists) {
      return candidate;
    }

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

export async function processPendingSubmissions(
  options: ProcessSubmissionsOptions = {},
): Promise<ProcessSubmissionResult> {
  const limit = options.limit ?? 20;
  const logger = options.logger ?? new TaskLogger(`logs/submissions-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);

  const submissions = await prisma.userSubmission.findMany({
    where: {
      status: SubmissionStatus.PENDING,
    },
    orderBy: [{ createdAt: 'asc' }],
    take: limit,
  });

  const result: ProcessSubmissionResult = {
    total: submissions.length,
    movedToNeedsReview: 0,
    requeued: 0,
    failed: 0,
  };

  for (const submission of submissions) {
    try {
      await prisma.userSubmission.update({
        where: { id: submission.id },
        data: {
          status: SubmissionStatus.PROCESSING,
        },
      });

      logger.info({
        stage: 'submission-process',
        message: 'submission processing started',
        extra: { submissionId: submission.id, appName: submission.appName },
      });

      const payload = parseReviewPayload(submission.reviewPayload);
      const enrich = await findAppByNameFromItunes(submission.appName).catch(() => null);

      const fetchResult = await fetchPolicyByUrl(submission.privacyUrl);
      if (fetchResult.fetchStatus === 'FAILED') {
        payload.error = `fetch-failed: ${fetchResult.errorMessage ?? 'unknown'}`;
        payload.fetch = {
          sourceUrl: submission.privacyUrl,
          contentType: fetchResult.contentType,
          fetchStatus: fetchResult.fetchStatus,
          rawText: fetchResult.rawText,
          normalizedText: fetchResult.normalizedText,
        };
        payload.enrichment = {
          trackId: enrich?.trackId,
          developer: enrich?.artistName,
          iconUrl: enrich?.artworkUrl100,
        };

        await prisma.userSubmission.update({
          where: { id: submission.id },
          data: {
            status: SubmissionStatus.NEEDS_REVIEW,
            adminNote: 'Automatic fetch failed. Needs manual review.',
            appStoreTrackId: enrich?.trackId ?? null,
            reviewPayload: JSON.stringify(payload),
            processedAt: new Date(),
          },
        });

        result.movedToNeedsReview += 1;
        continue;
      }

      const contentHash = computeContentHash(fetchResult.normalizedText);
      payload.contentHash = contentHash;
      payload.fetch = {
        sourceUrl: submission.privacyUrl,
        contentType: fetchResult.contentType,
        fetchStatus: fetchResult.fetchStatus,
        rawText: fetchResult.rawText,
        normalizedText: fetchResult.normalizedText,
      };
      payload.enrichment = {
        trackId: enrich?.trackId,
        developer: enrich?.artistName,
        iconUrl: enrich?.artworkUrl100,
      };

      let analysis;
      try {
        const analyzed = await analyzeWithDeepseek({
          app: {
            appId: submission.id,
            appName: submission.appName,
            websiteUrl: submission.privacyUrl,
          },
          policyText: fetchResult.normalizedText,
        });
        analysis = analyzed.analysis;
      } catch (error) {
        logger.warn({
          stage: 'submission-process',
          message: 'deepseek analyze failed, fallback normalize used',
          extra: {
            submissionId: submission.id,
            error: formatError(error),
          },
        });
        analysis = normalizeAnalysisResult({ promptVersion: 'submission-fallback' }).value;
      }

      const scoring = calculateRiskScore({
        structuredFlags: analysis.structuredFlags,
        dataCollected: analysis.dataCollected,
        dataSharedWith: analysis.dataSharedWith,
        userRights: analysis.userRights,
        redFlags: analysis.redFlags,
      });

      const reviewDecision = decideReview({
        riskLevel: scoring.riskLevel,
        confidence: analysis.confidence,
        normalizedTextLength: fetchResult.normalizedText.length,
        redFlags: analysis.redFlags,
      });

      payload.analysis = analysis;
      payload.scoring = scoring;
      payload.reviewDecision = reviewDecision;

      await prisma.userSubmission.update({
        where: { id: submission.id },
        data: {
          status: SubmissionStatus.NEEDS_REVIEW,
          appStoreTrackId: enrich?.trackId ?? null,
          reviewPayload: JSON.stringify(payload),
          adminNote: reviewDecision.reviewReason || null,
          processedAt: new Date(),
        },
      });

      result.movedToNeedsReview += 1;
    } catch (error) {
      result.failed += 1;
      await prisma.userSubmission.update({
        where: { id: submission.id },
        data: {
          status: SubmissionStatus.PENDING,
          adminNote: `requeued: ${formatError(error)}`,
        },
      });
      result.requeued += 1;
    }
  }

  logger.info({
    stage: 'submission-process-summary',
    message: 'submission processing finished',
    extra: result as unknown as Record<string, unknown>,
  });

  return result;
}

async function resolvePolicyVersionNo(client: PrismaClient, appId: string): Promise<number> {
  const latest = await client.policyVersion.findFirst({
    where: { appId },
    orderBy: [{ versionNo: 'desc' }],
    select: { versionNo: true },
  });

  return (latest?.versionNo ?? 0) + 1;
}

export async function approveSubmission(submissionId: string, options: ApproveSubmissionOptions = {}): Promise<{ appId: string }> {
  const submission = await prisma.userSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submission) {
    throw new Error('Submission not found.');
  }

  if (submission.status === SubmissionStatus.REJECTED || submission.status === SubmissionStatus.APPROVED) {
    throw new Error(`Submission already finalized: ${submission.status}`);
  }

  const payload = parseReviewPayload(submission.reviewPayload);
  const normalizedText = payload.fetch?.normalizedText ?? '';
  const rawText = payload.fetch?.rawText ?? normalizedText;
  const contentHash = payload.contentHash ?? computeContentHash(normalizedText);
  const analysis = payload.analysis ?? normalizeAnalysisResult({ promptVersion: 'approval-fallback' }).value;
  const scoring = payload.scoring ?? calculateRiskScore({
    structuredFlags: analysis.structuredFlags,
    dataCollected: analysis.dataCollected,
    dataSharedWith: analysis.dataSharedWith,
    userRights: analysis.userRights,
    redFlags: analysis.redFlags,
  });

  const overriddenRiskScore = options.override?.riskScore ?? scoring.riskScore;
  const overriddenRiskLevel = options.override?.riskLevel ?? scoring.riskLevel;
  const oneLineSummary = options.override?.oneLineSummary ?? analysis.oneLineSummary;
  const plainSummary = options.override?.plainSummary ?? analysis.plainSummary;

  const app = await prisma.$transaction(async (tx) => {
    const mergeTarget = await resolveMergeTarget(tx, submission);
    let resolvedApp = mergeTarget;

    if (!resolvedApp) {
      const slug = await createUniqueSlug(tx, submission.appName);
      resolvedApp = await tx.app.create({
        data: {
          name: submission.appName,
          slug,
          websiteUrl: submission.privacyUrl,
          iconUrl: payload.enrichment?.iconUrl ?? null,
          developer: payload.enrichment?.developer ?? null,
        },
      });
    }

    const existingVersion = await tx.policyVersion.findUnique({
      where: {
        appId_contentHash: {
          appId: resolvedApp.id,
          contentHash,
        },
      },
      select: { id: true },
    });

    let policyVersionId = existingVersion?.id;

    if (!policyVersionId) {
      await tx.policyVersion.updateMany({
        where: {
          appId: resolvedApp.id,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
        },
      });

      const versionNo = await resolvePolicyVersionNo(tx, resolvedApp.id);
      const createdVersion = await tx.policyVersion.create({
        data: {
          appId: resolvedApp.id,
          sourceUrl: submission.privacyUrl,
          checksum: contentHash,
          contentHash,
          versionNo,
          isCurrent: true,
          rawText,
          normalizedText,
          contentType: payload.fetch?.contentType ?? 'unknown',
          fetchStatus: toPrismaFetchStatus(payload.fetch?.fetchStatus ?? 'FAILED'),
        },
      });
      policyVersionId = createdVersion.id;
    }

    await tx.analysis.create({
      data: {
        policyVersionId,
        oneLineSummary,
        summary: plainSummary,
        riskScore: overriddenRiskScore,
        riskLevel: toPrismaRiskLevel(overriddenRiskLevel),
        riskReasons: JSON.stringify(scoring.reasons.slice(0, 10)),
        confidence: analysis.confidence,
        needsHumanReview: false,
        reviewStatus: ReviewStatus.APPROVED,
        reviewReason: options.adminNote ?? 'approved-by-admin',
        reviewPriority: 0,
        normalizedPayload: JSON.stringify(analysis),
        modelName: 'submission-approval',
      },
    });

    await tx.userSubmission.updateMany({
      where: {
        appId: resolvedApp.id,
        id: {
          not: submission.id,
        },
      },
      data: {
        appId: null,
      },
    });

    await tx.userSubmission.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.APPROVED,
        adminNote: options.adminNote ?? null,
        appId: resolvedApp.id,
        approvedAt: new Date(),
        processedAt: new Date(),
      },
    });

    return resolvedApp;
  });

  return { appId: app.id };
}

export async function rejectSubmission(submissionId: string, adminNote: string): Promise<void> {
  await prisma.userSubmission.update({
    where: { id: submissionId },
    data: {
      status: SubmissionStatus.REJECTED,
      adminNote,
      processedAt: new Date(),
    },
  });
}
