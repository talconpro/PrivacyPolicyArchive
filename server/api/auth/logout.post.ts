import { clearAdminSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  clearAdminSession(event)
  return { ok: true }
})
