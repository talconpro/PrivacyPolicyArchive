import { prisma } from '../src/lib/prisma';
import { processPendingSubmissions } from '../src/lib/submission/process';

async function main(): Promise<void> {
  const limit = Number(process.env.SUBMISSION_PROCESS_LIMIT ?? '20');
  const result = await processPendingSubmissions({
    limit: Number.isFinite(limit) && limit > 0 ? limit : 20,
  });

  console.log('===== Submission Processing Summary =====');
  console.log(`total: ${result.total}`);
  console.log(`moved to needs review: ${result.movedToNeedsReview}`);
  console.log(`requeued: ${result.requeued}`);
  console.log(`failed: ${result.failed}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
