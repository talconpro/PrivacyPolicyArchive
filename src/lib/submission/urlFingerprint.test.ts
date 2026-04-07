import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeUrlFingerprint } from './urlFingerprint';

test('normalizeUrlFingerprint removes tracking params and normalizes host/path', () => {
  const result = normalizeUrlFingerprint('HTTPS://Example.com/privacy/?utm_source=ad&foo=1&fbclid=abc');
  assert.equal(result, 'https://example.com/privacy?foo=1');
});

test('normalizeUrlFingerprint strips default ports and sorts query params', () => {
  const result = normalizeUrlFingerprint('https://example.com:443/policy?b=2&a=1');
  assert.equal(result, 'https://example.com/policy?a=1&b=2');
});
