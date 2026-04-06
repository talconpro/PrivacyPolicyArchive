import test from 'node:test';
import assert from 'node:assert/strict';

import { decideReview } from './review';

test('critical risk goes to review queue with high priority', () => {
  const result = decideReview({
    riskLevel: 'CRITICAL',
    confidence: 0.95,
    normalizedTextLength: 5000,
    redFlags: [],
  });

  assert.equal(result.needsHumanReview, true);
  assert.equal(result.reviewPriority, 3);
  assert.ok(result.reviewReason.includes('critical-risk'));
});

test('low confidence and abnormal text length trigger review', () => {
  const result = decideReview({
    riskLevel: 'LOW',
    confidence: 0.4,
    normalizedTextLength: 100,
    redFlags: [],
  });

  assert.equal(result.needsHumanReview, true);
  assert.equal(result.reviewPriority, 2);
  assert.ok(result.reviewReason.includes('low-confidence'));
  assert.ok(result.reviewReason.includes('abnormal-text-length'));
});

test('normal case can skip review', () => {
  const result = decideReview({
    riskLevel: 'MEDIUM',
    confidence: 0.9,
    normalizedTextLength: 5000,
    redFlags: [],
  });

  assert.equal(result.needsHumanReview, false);
  assert.equal(result.reviewPriority, 0);
});
