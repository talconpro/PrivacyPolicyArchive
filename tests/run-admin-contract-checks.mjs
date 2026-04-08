import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function read(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

function check(name, fn) {
  try {
    fn()
    console.log(`PASS: ${name}`)
  } catch (error) {
    console.error(`FAIL: ${name}`)
    throw error
  }
}

check('schema includes needs_revision and superseded statuses', () => {
  const schema = read('prisma/schema.prisma')
  assert.match(schema, /needs_revision/)
  assert.match(schema, /superseded/)
})

check('admin validators include bulk action schemas', () => {
  const source = read('shared/validators/admin.ts')
  assert.match(source, /submissionBulkActionSchema/)
  assert.match(source, /appBulkActionSchema/)
  assert.match(source, /analysisBulkActionSchema/)
})

check('analysis patch enforces neutral legal wording', () => {
  const source = read('server/api/admin/analyses/[id].patch.ts')
  assert.match(source, /LEGAL_TONE_VIOLATION/)
  assert.match(source, /违法/)
  assert.match(source, /非法/)
})

check('submission admin API includes send-back endpoint', () => {
  const source = read('server/api/admin/submissions/[id]/send-back.post.ts')
  assert.match(source, /needs_revision/)
})

console.log('All admin contract checks passed.')
