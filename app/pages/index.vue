<script setup lang="ts">
const { data } = await useAsyncData('home', () => $fetch('/api/home'))
useSeoMeta({ title: 'Privacy Policy Archive', description: '几秒看懂 App 的隐私风险。' })
</script>

<template>
  <div class="space-y-10">
    <HomeHero />

    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <div class="label-overline">Hot apps</div>
          <h2 class="text-2xl">热门 App</h2>
        </div>
        <NuxtLink to="/browse" class="text-sm text-signal">查看全部</NuxtLink>
      </div>
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <AppCard v-for="app in data?.hotApps || []" :key="app.id" :app="app" />
      </div>
    </section>

    <section class="grid gap-4 lg:grid-cols-[1fr,320px]">
      <div class="panel p-5">
        <div class="label-overline">Latest updated</div>
        <h2 class="mt-2 text-2xl">最近更新</h2>
        <div class="mt-4 space-y-4">
          <div v-for="app in data?.latestApps || []" :key="app.id" class="flex items-center justify-between border-b border-charcoal pb-4 last:border-none last:pb-0">
            <div>
              <NuxtLink :to="`/apps/${app.slug}`" class="font-medium hover:text-signal">{{ app.name }}</NuxtLink>
              <div class="text-sm text-slate">{{ app.updatedAtLabel }}</div>
            </div>
            <RiskBadge :level="app.riskLevel" />
          </div>
        </div>
      </div>
      <div class="panel-accent p-5">
        <div class="label-overline">High risk watchlist</div>
        <h2 class="mt-2 text-2xl">高危预警</h2>
        <div class="mt-4 space-y-3">
          <NuxtLink v-for="app in data?.criticalApps || []" :key="app.id" :to="`/apps/${app.slug}`" class="block rounded-sm border border-danger/40 p-3 hover:border-danger">
            <div class="font-medium">{{ app.name }}</div>
            <div class="mt-1 text-sm text-parchment">{{ app.oneLiner }}</div>
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
