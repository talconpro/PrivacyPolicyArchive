<script setup lang="ts">
defineProps<{ app: any }>()
</script>

<template>
  <NuxtLink :to="`/apps/${app.slug}`" class="panel block p-4 hover:border-signal">
    <div class="mb-3 flex items-start justify-between gap-4">
      <div>
        <div class="text-lg font-semibold">{{ app.name }}</div>
        <div class="mt-1 text-sm text-slate">{{ app.category }} · {{ app.developer || '未知开发商' }}</div>
      </div>
      <RiskBadge :level="app.riskLevel" />
    </div>
    <p class="line-clamp-2 text-sm text-parchment">{{ app.oneLiner || app.plainSummary || '暂无摘要' }}</p>
    <div class="mt-4 text-xs text-slate">更新于 {{ app.updatedAtLabel || app.updatedAt }}</div>
  </NuxtLink>
</template>
