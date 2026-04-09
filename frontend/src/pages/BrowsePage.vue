<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, getApiErrorMessage } from '@/api/client'
import AppCard from '@/components/app/AppCard.vue'
import {settings} from "@/config/settings.ts"
import { useSiteRuntimeSettings } from '@/composables/useSiteRuntimeSettings'

const route = useRoute()
const router = useRouter()
const { settings: runtimeSettings } = useSiteRuntimeSettings()

const q = ref('')
const risk = ref('')
const category = ref('')
const data = ref<any>({ categories: [], items: [] })
const loading = ref(false)
const errorMessage = ref('')

const hasAnyFilter = computed(() => Boolean(q.value.trim() || risk.value || category.value))
const canQuickSubmit = computed(() => Boolean(q.value.trim()))
const quickSubmitRoute = computed(() => ({
  path: '/submit',
  query: q.value.trim() ? { appName: q.value.trim() } : {},
}))

const syncFromQuery = () => {
  q.value = String(route.query.q || '')
  risk.value = String(route.query.risk || '')
  category.value = String(route.query.category || '')
}

const load = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await api.get('/search', { params: { q: q.value, risk: risk.value, category: category.value } })
    data.value = res.data
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
    data.value = { categories: data.value?.categories || [], items: [] }
  } finally {
    loading.value = false
  }
}

const applyFilters = () => {
  router.push({
    path: '/browse',
    query: {
      q: q.value || undefined,
      risk: risk.value || undefined,
      category: category.value || undefined,
    },
  })
}

watch(
  () => route.query,
  async () => {
    syncFromQuery()
    await load()
  },
  { deep: true },
)

onMounted(async () => {
  syncFromQuery()
  await load()
})
</script>

<template>
  <div class="space-y-6 w-full">
    <div>
      <div class="label-overline">Browse</div>
      <h1 class="text-4xl leading-none tracking-[-0.04em]">浏览 App </h1>
    </div>

    <div class="panel grid gap-4 p-4 md:grid-cols-4">
      <input
        v-model="q"
        class="input-base "
        :class="settings.riskShow? 'md:col-span-2' : 'md:col-span-3'"
        placeholder="搜索名称或开发商"
        @keyup.enter="applyFilters"
      >
      <select v-model="risk" class="select-base" v-show="settings.riskShow">
        <option value="">全部风险</option>
        <option value="low">低</option>
        <option value="medium">中</option>
        <option value="high">高</option>
        <option value="critical">严重</option>
      </select>
      <select v-model="category" class="select-base">
        <option value="">全部类别</option>
        <option v-for="c in data.categories || []" :key="c" :value="c">{{ c }}</option>
      </select>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <button class="btn-primary" :disabled="loading" @click="applyFilters">
        {{ loading ? '搜索中...' : '应用筛选' }}
      </button>
      <button class="btn-ghost" :disabled="loading" @click="load">
        {{ loading ? '加载中...' : '刷新' }}
      </button>
      <span v-if="loading" class="text-xs text-slate">
        正在查询本地档案...
      </span>
    </div>

    <div v-if="errorMessage" class="panel border-danger/40 p-4 text-sm text-danger">
      加载失败：{{ errorMessage }}
    </div>

    <div v-if="loading" class="app-grid">
      <div v-for="i in 6" :key="i" class="panel h-[210px] w-full animate-pulse p-4">
        <div class="h-6 w-2/3 rounded bg-charcoal" />
        <div class="mt-3 h-4 w-5/6 rounded bg-charcoal" />
        <div class="mt-6 h-4 w-full rounded bg-charcoal" />
      </div>
    </div>

    <div v-else-if="(data.items || []).length > 0" class="app-grid">
      <AppCard v-for="app in data.items || []" :key="app.id" :app="app" />
    </div>

    <div v-else class="panel flex min-h-[220px] items-center justify-center p-6 text-center">
      <div>
        <div class="text-lg font-semibold text-snow">暂无数据</div>
        <p class="mt-2 text-sm text-slate">
          {{ hasAnyFilter ? '未找到匹配结果，可更换关键词或筛选条件。' : '当前还没有可展示的应用档案。' }}
        </p>
        <router-link
          v-if="canQuickSubmit"
          :to="quickSubmitRoute"
          class="btn-primary mt-4 inline-flex items-center"
        >
          没有你想要的 App？点击提交
        </router-link>
      </div>
    </div>

    <div v-if="runtimeSettings.showAppIcon" class="text-xs text-slate">
      图标说明：{{ runtimeSettings.iconUsageNotice }}
    </div>
  </div>
</template>

<style scoped>
.app-grid {
  display: grid;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  gap: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
}

@media (max-width: 767px) {
  .app-grid {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 1280px) {
  .app-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
