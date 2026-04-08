<script setup lang="ts">
const route = useRoute()
const { data: app } = await useAsyncData(`app-${route.params.slug}`, () => $fetch(`/api/apps/${route.params.slug}`))
useSeoMeta(() => ({ title: `${app.value?.name || ''} 隐私风险分析`, description: app.value?.plainSummary || app.value?.oneLiner || '' }))
</script>

<template>
  <div v-if="app" class="space-y-6">
    <section class="panel-accent p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="label-overline">{{ app.category }}</div>
          <h1 class="mt-2 text-4xl leading-none tracking-[-0.04em]">{{ app.name }}</h1>
          <p class="mt-3 max-w-3xl text-lg text-parchment">{{ app.oneLiner }}</p>
          <div class="mt-3 text-sm text-slate">{{ app.developer || '未知开发商' }} · 分析于 {{ app.analyzedAtLabel }}</div>
        </div>
        <!-- <RiskBadge :level="app.riskLevel" /> -->
      </div>
    </section>

    <section class="panel p-4 text-sm text-slate">
      免责声明：本页面内容基于该应用公开隐私政策进行自动化分析生成，仅供参考，不构成法律建议。具体条款请以官方原文为准。
    </section>

    <section class="grid gap-6 lg:grid-cols-[1fr,340px]">
      <div class="space-y-6">
        <div class="panel p-6">
          <div class="label-overline">Key findings</div>
          <h2 class="mt-2 text-2xl">关键发现</h2>
          <ul class="mt-4 space-y-3 text-parchment">
            <li v-for="(finding, idx) in app.keyFindings" :key="idx">• {{ finding }}</li>
          </ul>
        </div>

        <div class="panel p-6">
          <div class="label-overline">Plain summary</div>
          <h2 class="mt-2 text-2xl">白话摘要</h2>
          <p class="mt-4 leading-7 text-parchment">{{ app.plainSummary }}</p>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <div class="panel p-5">
            <h3 class="text-xl">收集的数据</h3>
            <ul class="mt-3 space-y-2 text-sm text-parchment">
              <li v-for="(item, idx) in app.dataCollected" :key="idx">• {{ item }}</li>
            </ul>
          </div>

          <div class="panel p-5">
            <h3 class="text-xl">共享对象</h3>
            <ul class="mt-3 space-y-2 text-sm text-parchment">
              <li v-for="(item, idx) in app.dataSharedWith" :key="idx">• {{ item }}</li>
            </ul>
          </div>

          <div class="panel p-5">
            <h3 class="text-xl">用户权利</h3>
            <ul class="mt-3 space-y-2 text-sm text-parchment">
              <li v-for="(item, idx) in app.userRights" :key="idx">• {{ item }}</li>
            </ul>
          </div>

          <div class="panel p-5">
            <h3 class="text-xl">争议解决</h3>
            <p class="mt-3 text-sm text-parchment">{{ app.dispute || '暂无明确说明' }}</p>
          </div>
        </div>
      </div>

      <aside class="space-y-4">
        <div class="panel p-5">
          <div class="label-overline">Source</div>
          <div class="mt-3 space-y-3 text-sm">
            <a v-if="app.privacyPolicyUrl" :href="app.privacyPolicyUrl" target="_blank" class="block text-signal hover:underline">隐私政策原文</a>
            <a v-if="app.termsOfServiceUrl" :href="app.termsOfServiceUrl" target="_blank" class="block text-signal hover:underline">用户协议原文</a>
          </div>
        </div>

        <div class="panel p-5">
          <div class="label-overline">Compare</div>
          <div class="mt-2 text-lg">同类 App 对比</div>
          <div class="mt-4 space-y-2">
            <NuxtLink
              v-for="item in app.similarApps"
              :key="item.slug"
              :to="`/compare?apps=${app.slug},${item.slug}`"
              class="block rounded-sm border border-charcoal px-3 py-2 hover:border-signal"
            >
              {{ item.name }}
            </NuxtLink>
          </div>
        </div>
      </aside>
    </section>
  </div>
</template>
