<script setup lang="ts">
const route = useRoute()
const apps = computed(() => String(route.query.apps || '').split(',').filter(Boolean))
const { data } = await useAsyncData('compare', () => $fetch('/api/compare', { method: 'POST', body: { slugs: apps.value } }), { watch: [apps] })
</script>

<template>
  <div class="space-y-6">
    <div>
      <div class="label-overline">Compare</div>
      <h1 class="text-4xl leading-none tracking-[-0.04em]">隐私条款对比</h1>
    </div>
    <div class="panel overflow-x-auto p-4">
      <table class="min-w-full text-left text-sm">
        <thead class="border-b border-charcoal text-slate">
          <tr>
            <th class="px-3 py-3">维度</th>
            <th v-for="app in data?.items || []" :key="app.slug" class="px-3 py-3">{{ app.name }}</th>
          </tr>
        </thead>
        <tbody>
          <tr class="border-b border-charcoal"><td class="px-3 py-3">风险等级</td><td v-for="app in data?.items || []" :key="app.slug" class="px-3 py-3"><RiskBadge :level="app.riskLevel" /></td></tr>
          <tr class="border-b border-charcoal"><td class="px-3 py-3">一句话总结</td><td v-for="app in data?.items || []" :key="app.slug" class="px-3 py-3 text-parchment">{{ app.oneLiner }}</td></tr>
          <tr class="border-b border-charcoal"><td class="px-3 py-3">收集范围</td><td v-for="app in data?.items || []" :key="app.slug" class="px-3 py-3 text-parchment">{{ app.dataCollected.join('、') }}</td></tr>
          <tr><td class="px-3 py-3">共享对象</td><td v-for="app in data?.items || []" :key="app.slug" class="px-3 py-3 text-parchment">{{ app.dataSharedWith.join('、') }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
