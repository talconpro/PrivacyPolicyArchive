import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeAnalysisResult } from './normalize';

test('normalizeAnalysisResult falls back safely for invalid payload', () => {
  const result = normalizeAnalysisResult('invalid-json-shape');

  assert.equal(result.value.oneLineSummary, 'Summary unavailable.');
  assert.equal(result.value.needsHumanReview, true);
  assert.ok(result.warnings.length > 0);
});

test('normalizeAnalysisResult keeps valid fields and applies defaults', () => {
  const result = normalizeAnalysisResult({
    oneLineSummary: 'A short summary',
    plainSummary: 'Detailed summary',
    keyFindings: ['f1'],
    dataCollected: ['email'],
    dataSharedWith: ['service_providers'],
    confidence: 0.9,
    promptVersion: 'v-test',
  });

  assert.equal(result.value.oneLineSummary, 'A short summary');
  assert.equal(result.value.userRights.access, false);
  assert.equal(result.value.structuredFlags.dataCollectionFlags.collectsPersonalData, false);
  assert.equal(result.value.confidence, 0.9);
  assert.equal(result.value.promptVersion, 'v-test');
});
