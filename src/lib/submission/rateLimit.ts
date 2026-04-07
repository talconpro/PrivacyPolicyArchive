import { createHash } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';

export interface DailyRateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterSeconds: number;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function resolveClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown';
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return 'unknown';
}

export function hashIpAddress(ip: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${ip}`, 'utf8').digest('hex');
}

export function calculateWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - ONE_DAY_MS);
}

export async function checkDailySubmissionRateLimit(
  prisma: PrismaClient,
  ipHash: string,
  limit = 5,
  now: Date = new Date(),
): Promise<DailyRateLimitResult> {
  const windowStart = calculateWindowStart(now);

  const count = await prisma.userSubmission.count({
    where: {
      ipHash,
      createdAt: {
        gte: windowStart,
      },
    },
  });

  const allowed = count < limit;
  let retryAfterSeconds = 0;

  if (!allowed) {
    const oldestRecord = await prisma.userSubmission.findFirst({
      where: {
        ipHash,
        createdAt: {
          gte: windowStart,
        },
      },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        createdAt: true,
      },
    });

    const retryAt = oldestRecord
      ? oldestRecord.createdAt.getTime() + ONE_DAY_MS
      : now.getTime() + ONE_DAY_MS;
    retryAfterSeconds = Math.max(1, Math.ceil((retryAt - now.getTime()) / 1000));
  }

  return {
    allowed,
    count,
    limit,
    retryAfterSeconds,
  };
}
