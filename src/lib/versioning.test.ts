import test from 'node:test';
import assert from 'node:assert/strict';

import { getNextVersionNo, isContentChanged } from './versioning';

test('isContentChanged returns false when hash unchanged', () => {
  assert.equal(isContentChanged('abc', 'abc'), false);
});

test('isContentChanged returns true when hash changed', () => {
  assert.equal(isContentChanged('abc', 'xyz'), true);
});

test('isContentChanged returns true when no previous hash', () => {
  assert.equal(isContentChanged(null, 'xyz'), true);
});

test('getNextVersionNo increments safely', () => {
  assert.equal(getNextVersionNo(undefined), 1);
  assert.equal(getNextVersionNo(2), 3);
});
