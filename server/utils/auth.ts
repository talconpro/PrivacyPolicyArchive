import crypto from 'crypto'
import { getHeader, setCookie, deleteCookie } from 'h3'

const COOKIE_NAME = 'ppa_admin_session'

function sign(value: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex')
}

function buildSession(username: string, secret: string) {
  const payload = JSON.stringify({ username, issuedAt: Date.now() })
  const base = Buffer.from(payload).toString('base64url')
  return `${base}.${sign(base, secret)}`
}

function readSession(value: string, secret: string) {
  const [base, signature] = value.split('.')
  if (!base || !signature || sign(base, secret) !== signature) return null
  return JSON.parse(Buffer.from(base, 'base64url').toString('utf-8'))
}

export function createAdminSession(event: any, username: string) {
  const config = useRuntimeConfig(event)
  const cookie = buildSession(username, config.sessionSecret)
  setCookie(event, COOKIE_NAME, cookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12
  })
}

export function clearAdminSession(event: any) {
  deleteCookie(event, COOKIE_NAME, { path: '/' })
}

export function getAdminSession(event: any) {
  const config = useRuntimeConfig(event)
  const cookie = getCookie(event, COOKIE_NAME)
  if (cookie) {
    const session = readSession(cookie, config.sessionSecret)
    if (session) return session
  }
  const bearer = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '')
  if (bearer && bearer === config.adminToken) return { username: config.adminUsername }
  return null
}

export function assertAdmin(event: any) {
  const session = getAdminSession(event)
  if (!session) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  return session
}
