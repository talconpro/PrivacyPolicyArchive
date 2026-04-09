<script setup lang="ts">
import RiskBadge from '@/components/ui/RiskBadge.vue'
import { useSiteRuntimeSettings } from '@/composables/useSiteRuntimeSettings'

defineProps<{ app: any }>()
const { settings } = useSiteRuntimeSettings()
</script>

<template>
  <router-link :to="`/apps/${app.slug}`" class="panel block min-w-0 max-w-full overflow-hidden p-4 hover:border-signal">
    <div class="mb-3 flex items-start justify-between gap-4">
      <div class="min-w-0 flex-1">
        <div class="flex items-start gap-3">
          <div
            v-if="settings.showAppIcon"
            class="mt-0.5 h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-charcoal bg-carbon"
          >
            <img
              v-if="app.iconUrl"
              :src="app.iconUrl"
              :alt="`${app.name} 图标`"
              class="h-full w-full object-cover"
              loading="lazy"
              referrerpolicy="no-referrer"
            >
            <div v-else class="flex h-full w-full items-center justify-center text-xs text-slate">
              App
            </div>
          </div>

          <div class="min-w-0">
            <div class="truncate text-lg font-semibold">{{ app.name }}</div>
            <div class="mt-1 flex w-full min-w-0 items-center gap-1 overflow-hidden text-sm text-slate">
              <span class="max-w-[42%] min-w-0 truncate" :title="app.category || '未分类'">
                {{ app.category || '未分类' }}
              </span>
              <span class="shrink-0">·</span>
              <span class="flex-1 min-w-0 truncate whitespace-nowrap" :title="app.developer || '未知开发商'">
                {{ app.developer || '未知开发商' }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <RiskBadge :level="app.riskLevel" />
    </div>
    <p class="line-clamp-2 text-sm text-parchment">{{ app.oneLiner || app.plainSummary || '暂无摘要' }}</p>
    <div class="mt-4 text-xs text-slate">更新于 {{ app.updatedAtLabel || app.updatedAt }}</div>
  </router-link>
</template>
