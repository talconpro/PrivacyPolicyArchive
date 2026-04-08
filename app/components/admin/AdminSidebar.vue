<script setup lang="ts">
const route = useRoute()

const links = [
  { to: '/admin', label: '概览' },
  { to: '/admin/apps', label: 'App 管理' },
  { to: '/admin/submissions', label: '提交审核' },
  { to: '/admin/analyses', label: '分析结果' },
  { to: '/admin/jobs', label: '任务日志' }
]

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await navigateTo('/admin/login')
}
</script>

<template>
  <aside class="panel h-fit p-4">
    <div class="mb-1 text-lg font-semibold">管理后台</div>
    <div class="mb-4 text-xs text-slate">审核、发布、分析与任务都在这里统一处理。</div>
    <nav class="space-y-2 text-sm">
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="block rounded-sm px-3 py-2 hover:bg-abyss hover:text-signal"
        :class="route.path === link.to || route.path.startsWith(link.to + '/') ? 'border border-signal text-signal' : 'border border-transparent'"
      >
        {{ link.label }}
      </NuxtLink>
    </nav>
    <button class="btn-ghost mt-6 w-full" @click="logout">退出登录</button>
  </aside>
</template>
