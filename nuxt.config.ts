export default defineNuxtConfig({
  compatibilityDate: '2026-04-08',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  components: [{ path: '~/components', pathPrefix: false }],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    deepseekApiKey: process.env.NUXT_DEEPSEEK_API_KEY,
    deepseekBaseUrl: process.env.NUXT_DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    deepseekModel: process.env.NUXT_DEEPSEEK_MODEL || 'deepseek-chat',
    adminUsername: process.env.NUXT_ADMIN_USERNAME || 'admin',
    adminPassword: process.env.NUXT_ADMIN_PASSWORD || 'change-me',
    adminToken: process.env.NUXT_ADMIN_TOKEN || 'change-me',
    sessionSecret: process.env.NUXT_SESSION_SECRET || 'change-this-secret',
    turnstileSecret: process.env.NUXT_TURNSTILE_SECRET || '',
    public: {
      siteName: 'Privacy Policy Archive',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    }
  },
  routeRules: {
    '/': { prerender: true },
    '/browse': { prerender: true },
    '/categories/**': { prerender: true },
    '/apps/**': { prerender: true },
    '/admin/**': { ssr: true }
  },
  nitro: {
    prerender: {
      routes: ['/', '/browse', '/submit']
    }
  },
  typescript: {
    strict: true,
    typeCheck: false
  }
})
