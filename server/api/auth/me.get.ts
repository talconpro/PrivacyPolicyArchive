import { getAdminSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  return { user: getAdminSession(event) }
})
