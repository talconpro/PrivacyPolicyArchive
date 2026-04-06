import { ReviewStatus } from '@prisma/client';

import { prisma } from '../src/lib/prisma';

function usage(): void {
  console.log('Usage:');
  console.log('  pnpm exec tsx scripts/reviewQueue.ts list [limit]');
  console.log('  pnpm exec tsx scripts/reviewQueue.ts mark <analysisId> <APPROVED|CORRECTED|FALSE_POSITIVE> [reason]');
}

async function listPending(limit = 50): Promise<void> {
  const items = await prisma.analysis.findMany({
    where: {
      needsHumanReview: true,
      reviewStatus: ReviewStatus.PENDING,
    },
    orderBy: [{ reviewPriority: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: {
      policyVersion: {
        include: {
          app: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (items.length === 0) {
    console.log('No pending review items.');
    return;
  }

  console.log(`Pending review items: ${items.length}`);
  for (const item of items) {
    console.log(
      [
        item.id,
        item.policyVersion.app.name,
        `risk=${item.riskLevel}`,
        `score=${item.riskScore ?? 'N/A'}`,
        `confidence=${item.confidence ?? 'N/A'}`,
        `priority=${item.reviewPriority ?? 0}`,
        `reason=${item.reviewReason ?? ''}`,
      ].join(' | '),
    );
  }
}

async function markReview(
  analysisId: string,
  status: ReviewStatus.APPROVED | ReviewStatus.CORRECTED | ReviewStatus.FALSE_POSITIVE,
  reason?: string,
): Promise<void> {
  const updated = await prisma.analysis.update({
    where: { id: analysisId },
    data: {
      reviewStatus: status,
      reviewReason: reason ?? undefined,
      needsHumanReview: false,
    },
    select: {
      id: true,
      reviewStatus: true,
      reviewReason: true,
    },
  });

  console.log(`Updated ${updated.id}: status=${updated.reviewStatus} reason=${updated.reviewReason ?? ''}`);
}

async function main(): Promise<void> {
  const [command = 'list', ...args] = process.argv.slice(2);

  if (command === 'list') {
    const limit = Number(args[0] ?? '50');
    await listPending(Number.isFinite(limit) && limit > 0 ? limit : 50);
    return;
  }

  if (command === 'mark') {
    const [analysisId, statusRaw, ...reasonParts] = args;

    if (!analysisId || !statusRaw) {
      usage();
      process.exitCode = 1;
      return;
    }

    if (!['APPROVED', 'CORRECTED', 'FALSE_POSITIVE'].includes(statusRaw)) {
      console.error(`Invalid status: ${statusRaw}`);
      usage();
      process.exitCode = 1;
      return;
    }

    await markReview(
      analysisId,
      statusRaw as ReviewStatus.APPROVED | ReviewStatus.CORRECTED | ReviewStatus.FALSE_POSITIVE,
      reasonParts.join(' '),
    );
    return;
  }

  usage();
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
