<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api/client'
import { settings } from '@/config/settings'

const route = useRoute()
const router = useRouter()

const links = [
  { to: '/admin', label: '概览' },
  { to: '/admin/apps', label: 'App 管理' },
  { to: '/admin/apps/new', label: '新增 App' },
  { to: '/admin/submissions', label: '提交审核' },
  { to: '/admin/appeals', label: '开发者申诉' },
  { to: '/admin/analyses', label: '分析结果' },
  { to: '/admin/tools/analyzer', label: '分析工作台' },
  { to: '/admin/tools/appstore-id', label: '批量抓 ID' },
  { to: '/admin/site-settings', label: '站点设置' },
  { to: '/admin/jobs', label: '任务日志' },
]

const isActive = (to: string) => route.path === to || route.path.startsWith(to + '/')

const logout = async () => {
  await api.post('/auth/logout')
  router.push('/admin/login')
}
</script>

<template>
  <div class="min-h-screen bg-abyss">
    <header class="sticky top-0 z-50 border-b border-charcoal bg-abyss/90 backdrop-blur">
      <div class="page-shell flex flex-wrap items-center justify-between gap-3 py-4">
        <router-link to="/admin" class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-md border border-signal text-signal shadow-[0_0_8px_rgba(0,217,146,.35)]">
            <svg class="text-signal" width="24" height="24" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M16.757 9.303a.75.75 0 0 0-1.014-1.106l-5.47 5.015L8.28 11.22a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.037.023l6-5.5ZM20.25 5c-2.663 0-5.258-.943-7.8-2.85a.75.75 0 0 0-.9 0C9.008 4.057 6.413 5 3.75 5a.75.75 0 0 0-.75.75V11c0 5.001 2.958 8.676 8.725 10.948a.75.75 0 0 0 .55 0C18.042 19.676 21 16 21 11V5.75a.75.75 0 0 0-.75-.75ZM4.5 6.478c2.577-.152 5.08-1.09 7.5-2.8 2.42 1.71 4.923 2.648 7.5 2.8V11c0 4.256-2.453 7.379-7.5 9.442C6.953 18.379 4.5 15.256 4.5 11V6.478Z" />
            </svg>
          </div>
          <div>
            <div class="label-overline">{{ settings.siteShortName }} Admin</div>
            <div class="text-sm text-parchment">管理后台</div>
          </div>
        </router-link>

        <nav class="flex flex-wrap items-center gap-2 text-sm">
          <router-link
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="rounded-sm border px-3 py-2 transition-colors"
            :class="isActive(link.to) ? 'border-signal text-signal' : 'border-charcoal text-snow hover:border-signal hover:text-signal'"
          >
            {{ link.label }}
          </router-link>
          <button class="btn-ghost" @click="logout">退出登录</button>
        </nav>
      </div>
    </header>

    <main class="page-shell space-y-4 py-6">
      <slot />
    </main>
  </div>
</template>

