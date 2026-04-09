<script setup lang="ts">
import { useSiteRuntimeSettings } from '@/composables/useSiteRuntimeSettings'

const { settings: runtimeSettings } = useSiteRuntimeSettings()

</script>

<template>
  <div class="space-y-6">
    <section class="panel-accent p-6">
      <div class="label-overline">Disclaimer</div>
      <h1 class="mt-2 text-3xl tracking-[-0.03em]">免责声明</h1>

      <p class="mt-4 text-base leading-7 text-parchment">
        {{ runtimeSettings.legalDisclaimerShort }}
      </p>
      <p class="mt-4 text-base leading-7 text-parchment">
        {{ runtimeSettings.disclaimerNoAdviceNotice }}
      </p>
      <p class="mt-4 text-base leading-7 text-parchment">
        {{ runtimeSettings.disclaimerAccuracyNotice }}
      </p>
      <p class="mt-4 text-base leading-7 text-parchment">
        {{ runtimeSettings.disclaimerTrademarkNotice }}
      </p>
      <p class="mt-4 text-base leading-7 text-parchment">
        {{ runtimeSettings.dataSourceNotice }}
      </p>
      <p class="mt-4 text-base leading-7 text-parchment">
        {{ runtimeSettings.disclaimerRightsContactNotice }}
      </p>

      <h2 id="appeal-notice" class="mt-8 text-2xl">开发者申诉通道</h2>
      <p class="mt-4 text-base leading-7 text-parchment">
        如开发者对页面内容存在异议，可通过
        <router-link to="/appeal" class="text-signal hover:underline">申诉页面</router-link>
        提交，我们将在收到后尽快处理。
      </p>

      <h2 id="ai-notice" class="mt-8 text-2xl">AI 分析声明</h2>
      <p class="mt-3 text-base leading-7 text-parchment">
        {{ runtimeSettings.aiAnalysisNotice }}
      </p>

      <h2 id="icon-notice" class="mt-8 text-2xl">图标声明</h2>
      <p class="mt-3 text-base leading-7 text-parchment">
        {{ runtimeSettings.iconUsageNotice }}
      </p>
    </section>
  </div>
</template>
