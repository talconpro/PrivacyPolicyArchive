<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import RiskBadge from '@/components/ui/RiskBadge.vue'
import { api } from '@/api/client'

const summary = ref({ totalApps: 0, pendingSubmissions: 0, highRiskApps: 0 })
const recentApps = ref<any[]>([])
const recentJobs = ref<any[]>([])

onMounted(async () => {
  const [appsRes, jobsRes] = await Promise.all([
    api.get('/admin/apps', { params: { page: 1, pageSize: 8 } }),
    api.get('/admin/jobs')
  ])

  summary.value = appsRes.data.summary
  recentApps.value = appsRes.data.items || []
  recentJobs.value = (jobsRes.data.items || []).slice(0, 8)
})
</script>

<template>
  <AdminLayout>
    <div class="space-y-6">
      <div>
        <div class="label-overline">Dashboard</div>
        <h1 class="text-4xl leading-none tracking-[-0.04em]">概览</h1>
        <p class="mt-3 text-sm text-parchment">快速查看收录状态、待审核数量和最近任务执行情况。</p>
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        <div class="panel p-5"><div class="text-slate">已发布 App</div><div class="mt-2 text-4xl">{{ summary.totalApps }}</div></div>
        <div class="panel p-5"><div class="text-slate">待审核提交</div><div class="mt-2 text-4xl">{{ summary.pendingSubmissions }}</div></div>
        <div class="panel p-5"><div class="text-slate">高风险条目</div><div class="mt-2 text-4xl">{{ summary.highRiskApps }}</div></div>
      </div>

      <div class="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <div class="panel p-5">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-2xl">最近更新的 App</h2>
            <RouterLink to="/admin/apps" class="text-sm text-signal">进入 App 管理</RouterLink>
          </div>
          <div class="space-y-3">
            <div v-for="app in recentApps" :key="app.id" class="flex items-center justify-between border-b border-charcoal pb-3 last:border-none last:pb-0">
              <div>
                <RouterLink :to="`/admin/apps/${app.id}`" class="font-medium hover:text-signal">{{ app.name }}</RouterLink>
                <div class="text-xs text-slate">{{ app.updatedAtLabel }} · {{ app.status }}</div>
              </div>
              <RiskBadge :level="app.riskLevel" />
            </div>
          </div>
        </div>

        <div class="panel p-5">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-2xl">最近任务</h2>
            <RouterLink to="/admin/jobs" class="text-sm text-signal">查看全部</RouterLink>
          </div>
          <div class="space-y-3">
            <div v-for="job in recentJobs" :key="job.id" class="rounded-sm border border-charcoal p-3">
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
  </AdminLayout>
</template>
