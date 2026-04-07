import test from 'node:test';
import assert from 'node:assert/strict';

import {
  adminApprovePayloadSchema,
  adminRejectPayloadSchema,
  submissionStatusQuerySchema,
  submitPayloadSchema,
} from './validation';

test('submitPayloadSchema accepts minimal valid payload', () => {
  const result = submitPayloadSchema.safeParse({
    appName: 'Example App',
    privacyUrl: 'https://example.com/privacy',
    captchaId: 'captcha-1',
    captchaAnswer: '8',
  });

  assert.equal(result.success, true);
});

test('submitPayloadSchema rejects invalid URL', () => {
  const result = submitPayloadSchema.safeParse({
    appName: 'Example App',
    privacyUrl: 'not-a-url',
    captchaId: 'captcha-1',
    captchaAnswer: '8',
  });

  assert.equal(result.success, false);
});

test('submissionStatusQuerySchema parses status and limit', () => {
  const result = submissionStatusQuerySchema.parse({
    status: 'NEEDS_REVIEW',
    limit: '20',
  });

  assert.equal(result.status, 'NEEDS_REVIEW');
  assert.equal(result.limit, 20);
});

test('admin schemas validate expected payloads', () => {
  const approve = adminApprovePayloadSchema.safeParse({
    adminNote: 'Looks good',
    override: {
      riskLevel: 'MEDIUM',
      riskScore: 42,
    },
  });
  const reject = adminRejectPayloadSchema.safeParse({
    adminNote: 'Spam submission',
  });

  assert.equal(approve.success, true);
  assert.equal(reject.success, true);
});
