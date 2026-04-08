export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/admin/login') return
  const { data } = await useFetch('/api/auth/me', { key: `auth-${to.fullPath}` })
  // @ts-ignore
  if (!data.value?.user) return navigateTo('/admin/login')
})
