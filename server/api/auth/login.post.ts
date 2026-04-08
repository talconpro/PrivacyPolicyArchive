import { loginSchema } from '../../../shared/validators/admin'
import { createAdminSession } from '../../utils/auth'
import { throwApiError } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const body = loginSchema.parse(await readBody(event))
  const config = useRuntimeConfig(event)

  if (body.username !== config.adminUsername || body.password !== config.adminPassword) {
    throwApiError({ statusCode: 401, code: 'INVALID_CREDENTIALS', message: '???????' })
  }

  createAdminSession(event, body.username)
  return { ok: true, username: body.username }
})
