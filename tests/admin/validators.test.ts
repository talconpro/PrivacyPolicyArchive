import test from 'node:test'
import assert from 'node:assert/strict'
import {
  analysisBulkActionSchema,
  appBulkActionSchema,
  containsDeterministicLegalTerms,
  submissionBulkActionSchema
} from '../../shared/validators/admin'

test('submission bulk action schema accepts supported actions', () => {
  const parsed = submissionBulkActionSchema.parse({
    ids: ['a', 'b'],
    action: 'send_back',
    adminNote: 'need more evidence'
  })
  assert.equal(parsed.action, 'send_back')
  assert.equal(parsed.ids.length, 2)
})

test('app bulk action schema rejects unsupported action', () => {
  assert.throws(() => {
    appBulkActionSchema.parse({ ids: ['a'], action: 'delete' })
  })
})

test('analysis bulk action schema accepts restore/recalculate actions', () => {
  const a = analysisBulkActionSchema.parse({ ids: ['x'], action: 'restore_ai' })
  const b = analysisBulkActionSchema.parse({ ids: ['y'], action: 'recalculate_risk' })
  assert.equal(a.action, 'restore_ai')
  assert.equal(b.action, 'recalculate_risk')
})

test('deterministic legal terms detector works', () => {
  assert.equal(containsDeterministicLegalTerms('该条款可能涉及风险'), false)
  assert.equal(containsDeterministicLegalTerms('该应用违法收集信息'), true)
  assert.equal(containsDeterministicLegalTerms('该行为非法'), true)
})
