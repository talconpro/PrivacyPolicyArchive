import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('submission status comment documents new workflow states', () => {
  const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf-8')
  assert.match(schema, /needs_revision/)
  assert.match(schema, /superseded/)
})
