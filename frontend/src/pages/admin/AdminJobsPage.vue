<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, getApiErrorMessage } from '@/api/client'
import AdminLayout from '@/components/admin/AdminLayout.vue'

const items = ref<any[]>([])
const message = ref('')
const running = ref(false)

const bulkJobs = computed(() => items.value.filter((j) => String(j.type || '').includes('_bulk_action')))
const normalJobs = computed(() => items.value.filter((j) => !String(j.type || '').includes('_bulk_action')))

const load = async () => {
  const res = await api.get('/admin/jobs')
  items.value = res.data.items
}

const runPending = async () => {
  try {
    running.value = true
    await api.post('/admin/jobs/run', { type: 'process_pending_submissions' })
    message.value = '已触发批量处理任务'
    await load()
  } catch (e) {
    message.value = getApiErrorMessage(e)
  } finally {
    running.value = false
  }
}

const retry = async (id: string) => {
  if (!window.confirm('确认重试该失败任务？')) return
  try {
    await api.post(`/admin/jobs/${id}/retry`)
    message.value = '重试任务已创建'
    await load()
  } catch (e) {
    message.value = getApiErrorMessage(e)
  }
}

const statusClass = (value: string) => {
  if (value === 'success') return 'text-signal border-signal/50'
  if (value === 'running') return 'text-warning border-warning/50'
  if (value === 'failed') return 'text-danger border-danger/50'
  return 'text-slate border-charcoal'
}

onMounted(load)
</script>

<template>
  <AdminLayout>
    <div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div class="label-overline">Jobs & Automation</div>
          <h1 class="text-3xl">任务日志与自动化</h1>
        </div>
        <button class="btn-primary" :disabled="running" @click="runPending">{{ running ? '执行中...' : '批量处理待审核提交' }}</button>
      </div>

      <p v-if="message" class="text-sm text-parchment">{{ message }}</p>

      <section class="panel space-y-3 p-4">
        <h3 class="text-xl">批量任务执行记录</h3>
        <div class="space-y-2">
          <div v-for="item in bulkJobs" :key="item.id" class="rounded-sm border border-charcoal p-3">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="font-medium">{{ item.type }}</p>
                <p class="text-xs text-slate">{{ item.startedAtLabel }} -> {{ item.finishedAtLabel }}</p>
              </div>
              <span class="badge" :class="statusClass(item.status)">{{ item.status }}</span>
            </div>
            <p class="mt-2 text-sm text-parchment">{{ item.summary || '暂无摘要' }}</p>
            <button v-if="item.retryable" class="btn-ghost mt-3" @click="retry(item.id)">重试</button>
          </div>
          <p v-if="!bulkJobs.length" class="text-sm text-slate">暂无批量任务记录</p>
        </div>
      </section>

      <section class="panel space-y-3 p-4">
        <h3 class="text-xl">其他任务记录</h3>
        <div class="space-y-2">
          <div v-for="item in normalJobs" :key="item.id" class="rounded-sm border border-charcoal p-3">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="font-medium">{{ item.type }}</p>
                <p class="text-xs text-slate">{{ item.startedAtLabel }} -> {{ item.finishedAtLabel }}</p>
              </div>
              <span class="badge" :class="statusClass(item.status)">{{ item.status }}</span>
            </div>
            <p class="mt-2 text-sm text-parchment">{{ item.summary || '暂无摘要' }}</p>
            <button v-if="item.retryable" class="btn-ghost mt-3" @click="retry(item.id)">重试</button>
          </div>
        </div>
      </section>
    </div>
  </AdminLayout>
</template>
