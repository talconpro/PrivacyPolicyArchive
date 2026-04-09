<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api, getApiErrorMessage } from '@/api/client'
import RiskBadge from '@/components/ui/RiskBadge.vue'

const route = useRoute()
const loading = ref(false)
const message = ref('')
const slugsInput = ref('')
const data = ref<any>({ items: [] })

const slugs = computed(() => slugsInput.value.split(',').map((s) => s.trim()).filter(Boolean))

const load = async () => {
  if (slugs.value.length < 2) {
    data.value = { items: [] }
    return
  }
  loading.value = true
  message.value = ''
  try {
    const res = await api.post('/compare', { slugs: slugs.value })
    data.value = res.data
  } catch (error) {
    message.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

watch(() => route.query.apps, (value) => {
  slugsInput.value = String(value || '')
  load()
})

onMounted(() => {
  slugsInput.value = String(route.query.apps || '')
  load()
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <div class="label-overline">Compare</div>
      <h1 class="text-4xl leading-none tracking-[-0.04em]">隐私条款对比</h1>
      <p class="mt-3 text-parchment">输入 2-4 个 slug，用英文逗号分隔，例如：wechat,douyin,alipay</p>
    </div>

    <div class="panel p-4">
      <div class="flex gap-3">
        <input v-model="slugsInput" class="input-base" placeholder="输入待对比 slugs" @keyup.enter="load">
        <button class="btn-primary shrink-0" @click="load">开始对比</button>
      </div>
      <p v-if="message" class="mt-3 text-sm text-danger">{{ message }}</p>
    </div>

    <div class="panel overflow-x-auto p-4">
      <table class="table-shell">
        <thead class="border-b border-charcoal text-slate">
          <tr>
            <th>维度</th>
            <th v-for="app in data.items || []" :key="app.slug">{{ app.name }}</th>
          </tr>
        </thead>
        <tbody>
          <tr class="border-b border-charcoal"><td>风险等级</td><td v-for="app in data.items || []" :key="`${app.slug}-risk`"><RiskBadge :level="app.riskLevel" /></td></tr>
          <tr class="border-b border-charcoal"><td>一句话总结</td><td v-for="app in data.items || []" :key="`${app.slug}-one`" class="text-parchment">{{ app.oneLiner }}</td></tr>
          <tr class="border-b border-charcoal"><td>收集范围</td><td v-for="app in data.items || []" :key="`${app.slug}-collect`" class="text-parchment">{{ (app.dataCollected || []).join('、') }}</td></tr>
          <tr><td>共享对象</td><td v-for="app in data.items || []" :key="`${app.slug}-share`" class="text-parchment">{{ (app.dataSharedWith || []).join('、') }}</td></tr>
        </tbody>
      </table>
      <p v-if="loading" class="mt-3 text-sm text-slate">加载中...</p>
    </div>
  </div>
</template>
