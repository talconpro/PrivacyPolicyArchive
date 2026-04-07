import test from 'node:test';
import assert from 'node:assert/strict';

import { selectMergePriorityTarget } from './process';

test('selectMergePriorityTarget prefers url match over name match', () => {
  const byUrl = { id: 'app-url' };
  const byName = { id: 'app-name' };

  const result = selectMergePriorityTarget(byUrl, byName);
  assert.deepEqual(result, byUrl);
});

test('selectMergePriorityTarget falls back to name match', () => {
  const byName = { id: 'app-name' };

  const result = selectMergePriorityTarget(null, byName);
  assert.deepEqual(result, byName);
});

test('selectMergePriorityTarget returns null when no match exists', () => {
  const result = selectMergePriorityTarget(null, null);
  assert.equal(result, null);
});
