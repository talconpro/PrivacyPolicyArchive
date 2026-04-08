<script setup lang="ts">
const route = useRoute()
const filters = computed(() => ({
  q: route.query.q,
  risk: route.query.risk,
  category: route.query.category,
  sort: route.query.sort
}))
const { data, refresh } = await useAsyncData('browse', () => $fetch('/api/search', { query: filters.value }), { watch: [filters] })
useSeoMeta({ title: '浏览 App', description: '按风险等级、类别、更新时间筛选 App。' })
</script>

<template>
  <div class="space-y-6">
    <div>
      <div class="label-overline">Browse</div>
      <h1 class="text-4xl leading-none tracking-[-0.04em]">浏览 App 档案</h1>
    </div>
    <div class="panel grid gap-4 p-4 md:grid-cols-4">
      <input :value="route.query.q" class="input-base md:col-span-2" placeholder="搜索名称或开发商" @change="navigateTo({ query: { ...route.query, q: ($event.target as HTMLInputElement).value || undefined } })">
      <select class="input-base" :value="route.query.risk || ''" @change="navigateTo({ query: { ...route.query, risk: ($event.target as HTMLSelectElement).value || undefined } })">
        <option value="">全部风险</option>
        <option value="low">低</option>
        <option value="medium">中</option>
        <option value="high">高</option>
        <option value="critical">严重</option>
      </select>
      <select class="input-base" :value="route.query.category || ''" @change="navigateTo({ query: { ...route.query, category: ($event.target as HTMLSelectElement).value || undefined } })">
        <option value="">全部类别</option>
        <option v-for="c in data?.categories || []" :key="c" :value="c">{{ c }}</option>
      </select>
    </div>
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <AppCard v-for="app in data?.items || []" :key="app.id" :app="app" />
    </div>
    <button class="btn-ghost" @click="refresh">刷新</button>
  </div>
</template>
