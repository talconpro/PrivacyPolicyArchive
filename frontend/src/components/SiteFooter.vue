<script setup lang="ts">
import { useSiteRuntimeSettings } from '@/composables/useSiteRuntimeSettings'

const { settings: runtimeSettings } = useSiteRuntimeSettings()
</script>

<template>
  <footer class="mt-auto border-t border-charcoal/60 bg-carbon/40">
    <div class="container-shell space-y-1 py-4 text-[11px] leading-5 text-slate">
      <div class="flex min-w-0 items-center gap-3">
        <span class="min-w-0 flex-1 truncate" :title="runtimeSettings.legalDisclaimerShort">
          免责声明：{{ runtimeSettings.legalDisclaimerShort }}
        </span>
        <div class="flex shrink-0 items-center gap-2">
          <router-link to="/disclaimer" class="text-signal hover:underline">免责声明</router-link>
          <router-link to="/disclaimer#ai-notice" class="text-signal hover:underline">AI 分析声明</router-link>
          <router-link to="/disclaimer#icon-notice" class="text-signal hover:underline">图标声明</router-link>
          <router-link to="/appeal" class="text-signal hover:underline">开发者申诉通道</router-link>
        </div>
      </div>
      <div class="flex min-w-0 items-center justify-between gap-3">
        <span class="min-w-0 truncate" :title="runtimeSettings.dataSourceNotice">
          数据来源：{{ runtimeSettings.dataSourceNotice }}
        </span>
        <span class="shrink-0">
          联系邮箱：{{ runtimeSettings.contactEmail }} ｜ 申诉 SLA：{{ runtimeSettings.appealSlaDays }} 天内处理
        </span>
      </div>
    </div>
  </footer>
</template>
