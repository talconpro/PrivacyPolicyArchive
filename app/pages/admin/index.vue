<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { data: apps } = await useAsyncData('admin-dashboard-apps', () => $fetch('/api/admin/apps', { query: { page: 1, pageSize: 8 } }))
const { data: jobs } = await useAsyncData('admin-dashboard-jobs', () => $fetch('/api/admin/jobs'))
</script>

<template>
  <div class="space-y-6">
    <div>
      <div class="label-overline">Dashboard</div>
      <h1 class="text-4xl leading-none tracking-[-0.04em]">系统概览</h1>
      <p class="mt-3 text-sm text-parchment">快速查看收录状态、待审核数量和最近任务执行情况。</p>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <div class="panel p-5"><div class="text-slate">已发布 App</div><div class="mt-2 text-4xl">{{ apps?.summary.totalApps || 0 }}</div></div>
      <div class="panel p-5"><div class="text-slate">待审核提交</div><div class="mt-2 text-4xl">{{ apps?.summary.pendingSubmissions || 0 }}</div></div>
      <div class="panel p-5"><div class="text-slate">高风险条目</div><div class="mt-2 text-4xl">{{ apps?.summary.highRiskApps || 0 }}</div></div>
    </div>

    <div class="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
      <div class="panel p-5">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-2xl">最近更新的 App</h2>
          <NuxtLink to="/admin/apps" class="text-sm text-signal">进入 App 管理</NuxtLink>
        </div>
        <div class="space-y-3">
          <div v-for="app in apps?.items || []" :key="app.id" class="flex items-center justify-between border-b border-charcoal pb-3 last:border-none last:pb-0">
            <div>
              <NuxtLink :to="`/admin/apps/${app.id}`" class="font-medium hover:text-signal">{{ app.name }}</NuxtLink>
              <div class="text-xs text-slate">{{ app.updatedAtLabel }} · {{ app.status }}</div>
            </div>
            <RiskBadge :level="app.riskLevel" />
          </div>
        </div>
      </div>

      <div class="panel p-5">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-2xl">最近任务</h2>
          <NuxtLink to="/admin/jobs" class="text-sm text-signal">查看全部</NuxtLink>
        </div>
        <div class="space-y-3">
          <div v-for="job in jobs?.items?.slice(0, 8) || []" :key="job.id" class="rounded-sm border border-charcoal p-3">
            <div class="flex items-center justify-between gap-3">
              <div class="font-medium">{{ job.type }}</div>
              <span class="badge" :class="job.status === 'success' ? 'text-mint' : job.status === 'failed' ? 'text-danger' : 'text-warning'">{{ job.status }}</span>
            </div>
            <div class="mt-1 text-xs text-slate">{{ job.startedAtLabel }}</div>
            <div class="mt-2 text-sm text-parchment">{{ job.summary || '暂无摘要' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
