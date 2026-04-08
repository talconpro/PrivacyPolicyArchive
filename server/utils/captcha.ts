export async function verifyCaptcha(token?: string) {
  const secret = process.env.NUXT_TURNSTILE_SECRET
  if (!secret || !token) return true
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token })
  })
  const json = await response.json() as { success?: boolean }
  if (!json.success) throw createError({ statusCode: 400, statusMessage: '验证码校验失败' })
  return true
}
