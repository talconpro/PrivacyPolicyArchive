<script setup lang="ts">
import { computed } from 'vue'
import { settings} from "@/config/settings.ts"

const props = defineProps<{ level?: string | null }>()
const config = computed(() => {
  switch (props.level) {
    case 'low':
      return { label: '低风险', cls: 'text-signal border-signal/50' }
    case 'medium':
      return { label: '中风险', cls: 'text-warning border-warning/50' }
    case 'high':
      return { label: '高风险', cls: 'text-red-400 border-red-400/50' }
    case 'critical':
      return { label: '严重', cls: 'text-danger border-danger/50' }
    default:
      return { label: '未评级', cls: 'text-slate border-charcoal' }
  }
})
</script>

<template>
  <span v-show="settings.riskShow" class="badge" :class="config.cls">{{ config.label }}</span>
</template>
