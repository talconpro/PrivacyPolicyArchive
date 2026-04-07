import test from 'node:test';
import assert from 'node:assert/strict';

import type { PrismaClient } from '@prisma/client';

import { calculateWindowStart, checkDailySubmissionRateLimit, hashIpAddress } from './rateLimit';

test('hashIpAddress is deterministic for same inputs', () => {
  const a = hashIpAddress('127.0.0.1', 'salt');
  const b = hashIpAddress('127.0.0.1', 'salt');
  const c = hashIpAddress('127.0.0.1', 'salt-2');

  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('checkDailySubmissionRateLimit allows requests under limit', async () => {
  const prisma = {
    userSubmission: {
      count: async () => 2,
      findFirst: async () => null,
    },
  } as unknown as PrismaClient;

  const result = await checkDailySubmissionRateLimit(prisma, 'ip-hash', 5, new Date('2026-04-07T00:00:00.000Z'));
  assert.equal(result.allowed, true);
  assert.equal(result.count, 2);
  assert.equal(result.retryAfterSeconds, 0);
});

test('checkDailySubmissionRateLimit blocks and returns retry window', async () => {
  const createdAt = new Date('2026-04-06T12:00:00.000Z');
  const now = new Date('2026-04-07T00:00:00.000Z');
  const prisma = {
    userSubmission: {
      count: async () => 5,
      findFirst: async () => ({ createdAt }),
    },
  } as unknown as PrismaClient;

  const result = await checkDailySubmissionRateLimit(prisma, 'ip-hash', 5, now);
  assert.equal(result.allowed, false);
  assert.equal(result.count, 5);
  assert.ok(result.retryAfterSeconds > 0);
  assert.equal(result.retryAfterSeconds, 12 * 60 * 60);
});

test('calculateWindowStart subtracts 24 hours', () => {
  const now = new Date('2026-04-07T10:00:00.000Z');
  const windowStart = calculateWindowStart(now);
  assert.equal(windowStart.toISOString(), '2026-04-06T10:00:00.000Z');
});
