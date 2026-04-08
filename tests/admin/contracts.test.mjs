import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('admin validators include expected bulk actions', () => {
  const source = readFileSync(resolve(process.cwd(), 'shared/validators/admin.ts'), 'utf-8')
  assert.match(source, /submissionBulkActionSchema/)
  assert.match(source, /'process'/)
  assert.match(source, /'approve'/)
  assert.match(source, /'reject'/)
  assert.match(source, /'send_back'/)
  assert.match(source, /appBulkActionSchema/)
  assert.match(source, /'publish'/)
  assert.match(source, /'archive'/)
  assert.match(source, /'reanalyze'/)
  assert.match(source, /analysisBulkActionSchema/)
  assert.match(source, /'restore_ai'/)
  assert.match(source, /'recalculate_risk'/)
})

test('analysis validation includes deterministic legal terms guard', () => {
  const source = readFileSync(resolve(process.cwd(), 'server/api/admin/analyses/[id].patch.ts'), 'utf-8')
  assert.match(source, /LEGAL_TONE_VIOLATION/)
  assert.match(source, /违法/)
  assert.match(source, /非法/)
})
