<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import { api, getApiErrorMessage } from '@/api/client'

type BatchRow = {
  index: number
  appName: string
  country: string
  status: 'success' | 'failed' | 'stopped'
  trackId: number | null
  trackName: string
  bundleId: string
  developerName: string
  privacyPolicyUrl: string
  trackViewUrl: string
  errorCode?: string
  errorMessage?: string
  skippedExisting?: boolean
  savedAppId?: string
}

type BatchProgress = {
  total: number
  processed: number
  success: number
  failed: number
  percent: number
  state: string
  currentAppName?: string
}

type BatchQueue = {
  position: number | null
  queuedTotal: number
  ahead: number
  runningJobId: string | null
}

type BatchJob = {
  id: string
  type: string
  status: string
  summary: string
  progress: BatchProgress
  results: BatchRow[]
  failedAppNames: string[]
  retryable: boolean
  queue?: BatchQueue
}

type BatchHistoryItem = {
  id: string
  status: string
  startedAt: string | null
  finishedAt: string | null
  summary: string
  progress: BatchProgress
  resultCount: number
  failedCount: number
  retryable: boolean
}

const POLL_INTERVAL_MS = 1500
const MAX_BATCH_ITEMS = 500
const JOB_STORAGE_KEY = 'admin_appstore_batch_job_id'

const rawInput = ref('')
const country = ref('cn')
const persistDraft = ref(false)

const loading = ref(false)
const stopping = ref(false)
const retrying = ref(false)
const queryingById = ref(false)
const loadingHistory = ref(false)

const message = ref('')
const errorMessage = ref('')

const jobId = ref('')
const job = ref<BatchJob | null>(null)
const lookupJobId = ref('')
const historyItems = ref<BatchHistoryItem[]>([])
const selectedHistoryJobId = ref('')

const pollErrorCount = ref(0)
let pollTimer: number | null = null

const countries = [
  { value: 'cn', label: '中国大陆 (cn)' },
  { value: 'us', label: '美国 (us)' },
  { value: 'jp', label: '日本 (jp)' },
  { value: 'hk', label: '中国香港 (hk)' },
]

const parsedAppNames = computed(() => {
  const lines = rawInput.value.split(/\r?\n/)
  const seen = new Set<string>()
  const output: string[] = []
  for (const line of lines) {
    const name = line.trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(name)
  }
  return output
})

const progress = computed<BatchProgress>(() => {
  return (
    job.value?.progress || {
      total: 0,
      processed: 0,
      success: 0,
      failed: 0,
      percent: 0,
      state: 'idle',
      currentAppName: '',
    }
  )
})

const rows = computed(() => job.value?.results || [])
const isRunning = computed(() => job.value?.status === 'queued' || job.value?.status === 'running')
const canStart = computed(() => parsedAppNames.value.length > 0 && parsedAppNames.value.length <= MAX_BATCH_ITEMS && !loading.value)
const canStop = computed(() => !!jobId.value && isRunning.value && !stopping.value)
const canRetry = computed(() => !!job.value?.retryable && !retrying.value)
const canExport = computed(() => rows.value.length > 0)

const clearFeedback = () => {
  message.value = ''
  errorMessage.value = ''
}

const clearPolling = () => {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
}

const saveJobId = (value: string) => {
  if (!value) {
    localStorage.removeItem(JOB_STORAGE_KEY)
    return
  }
  localStorage.setItem(JOB_STORAGE_KEY, value)
}

const isTerminalStatus = (status?: string) => ['success', 'failed', 'stopped'].includes(String(status || ''))

const loadJob = async (targetId: string) => {
  const res = await api.get(`/admin/tools/appstore-id/jobs/${targetId}`, {
    params: { _ts: Date.now() },
    headers: { 'Cache-Control': 'no-cache' },
  })
  job.value = (res.data?.job as BatchJob) || null
  if (job.value) {
    jobId.value = job.value.id
    lookupJobId.value = job.value.id
    saveJobId(job.value.id)
  }
  if (isTerminalStatus(job.value?.status)) {
    clearPolling()
  }
}

const startPolling = (targetId: string) => {
  clearPolling()
  pollErrorCount.value = 0
  loadJob(targetId).catch((error) => {
    errorMessage.value = getApiErrorMessage(error)
  })
  pollTimer = window.setInterval(async () => {
    try {
      await loadJob(targetId)
      pollErrorCount.value = 0
    } catch (error) {
      pollErrorCount.value += 1
      errorMessage.value = getApiErrorMessage(error)
      if (pollErrorCount.value >= 8) {
        clearPolling()
      }
    }
  }, POLL_INTERVAL_MS)
}

const openJobById = async (targetId: string) => {
  const id = targetId.trim()
  if (!id) {
    errorMessage.value = '请先输入任务 ID'
    return
  }
  clearFeedback()
  await loadJob(id)
  message.value = `已加载任务：${id}`
  if (job.value && !isTerminalStatus(job.value.status)) {
    startPolling(id)
  }
}

const loadLatestJob = async (): Promise<BatchJob | null> => {
  const res = await api.get('/admin/tools/appstore-id/jobs-latest', {
    params: { _ts: Date.now() },
    headers: { 'Cache-Control': 'no-cache' },
  })
  return (res.data?.job as BatchJob | null) || null
}

const loadHistory = async () => {
  try {
    loadingHistory.value = true
    const res = await api.get('/admin/tools/appstore-id/jobs-history', {
      params: { limit: 50, _ts: Date.now() },
      headers: { 'Cache-Control': 'no-cache' },
    })
    historyItems.value = (res.data?.items as BatchHistoryItem[]) || []
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loadingHistory.value = false
  }
}

const queryByTaskId = async () => {
  try {
    queryingById.value = true
    await openJobById(lookupJobId.value)
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    queryingById.value = false
  }
}

const selectHistoryJob = async () => {
  if (!selectedHistoryJobId.value) return
  try {
    queryingById.value = true
    await openJobById(selectedHistoryJobId.value)
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    queryingById.value = false
  }
}

const startJob = async () => {
  clearFeedback()
  if (parsedAppNames.value.length === 0) {
    errorMessage.value = '请至少输入一个 App 名称。'
    return
  }
  if (parsedAppNames.value.length > MAX_BATCH_ITEMS) {
    errorMessage.value = `单次最多 ${MAX_BATCH_ITEMS} 条，请拆分后再提交。`
    return
  }

  try {
    loading.value = true
    const res = await api.post('/admin/tools/appstore-id/jobs', {
      appNames: parsedAppNames.value,
      country: country.value,
      persistDraft: persistDraft.value,
    })
    const createdJobId = String(res.data?.jobId || '')
    if (!createdJobId) {
      throw new Error('任务创建失败，缺少 jobId')
    }
    jobId.value = createdJobId
    lookupJobId.value = createdJobId
    saveJobId(createdJobId)
    message.value = `任务已创建：${createdJobId}`
    startPolling(createdJobId)
    await loadHistory()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

const stopJob = async () => {
  if (!jobId.value) return
  clearFeedback()
  try {
    stopping.value = true
    await api.post(`/admin/tools/appstore-id/jobs/${jobId.value}/stop`)
    message.value = '已发送停止请求，当前项完成后将停止。'
    await loadJob(jobId.value)
    await loadHistory()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    stopping.value = false
  }
}

const retryFailed = async () => {
  if (!jobId.value) return
  clearFeedback()
  try {
    retrying.value = true
    const res = await api.post(`/admin/tools/appstore-id/jobs/${jobId.value}/retry-failed`)
    const nextJobId = String(res.data?.jobId || '')
    if (!nextJobId) {
      throw new Error('重试任务创建失败')
    }
    jobId.value = nextJobId
    lookupJobId.value = nextJobId
    saveJobId(nextJobId)
    message.value = `已创建失败重试任务：${nextJobId}`
    startPolling(nextJobId)
    await loadHistory()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    retrying.value = false
  }
}

const exportJson = () => {
  if (!job.value) return
  const payload = {
    exportedAt: new Date().toISOString(),
    job: job.value,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `appstore-id-batch-${job.value.id}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

onBeforeUnmount(() => {
  clearPolling()
})

onMounted(async () => {
  await loadHistory()

  const stored = localStorage.getItem(JOB_STORAGE_KEY) || ''
  if (stored) {
    try {
      await openJobById(stored)
      if (job.value && !isTerminalStatus(job.value.status)) return
    } catch {
      localStorage.removeItem(JOB_STORAGE_KEY)
      jobId.value = ''
      job.value = null
    }
  }

  try {
    const latest = await loadLatestJob()
    if (!latest) return
    job.value = latest
    jobId.value = latest.id
    lookupJobId.value = latest.id
    saveJobId(latest.id)
    if (!isTerminalStatus(latest.status)) {
      startPolling(latest.id)
    }
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  }
})
</script>

<template>
  <AdminLayout>
    <div class="space-y-6">
      <div>
        <div class="label-overline">App Store Tools</div>
        <h1 class="text-4xl leading-none tracking-[-0.04em]">批量抓取 App Store ID</h1>
        <p class="mt-3 text-sm text-parchment">支持按任务 ID 查询、历史任务回看、实时进度和结果导出。</p>
      </div>

      <section class="panel space-y-4 p-5">
        <h2 class="text-2xl">按任务查询</h2>
        <div class="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
          <div class="space-y-2">
            <label class="text-sm text-slate">任务 ID</label>
            <div class="flex flex-wrap gap-2">
              <input v-model="lookupJobId" class="input-base flex-1 min-w-[280px]" placeholder="输入任务 ID 后查询" />
              <button class="btn-primary" :disabled="queryingById" @click="queryByTaskId">
                {{ queryingById ? '查询中...' : '查询任务' }}
              </button>
            </div>
          </div>
          <div class="space-y-2">
            <label class="text-sm text-slate">历史任务</label>
            <div class="flex flex-wrap gap-2">
              <select v-model="selectedHistoryJobId" class="select-base min-w-[320px] flex-1" @change="selectHistoryJob">
                <option value="">选择历史任务</option>
                <option v-for="item in historyItems" :key="item.id" :value="item.id">
                  {{ item.id }} | {{ item.status }} | {{ item.progress.processed }}/{{ item.progress.total }}
                </option>
              </select>
              <button class="btn-ghost" :disabled="loadingHistory" @click="loadHistory">
                {{ loadingHistory ? '刷新中...' : '刷新历史' }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="panel space-y-4 p-5">
        <div class="grid gap-4 xl:grid-cols-[1.4fr,0.6fr]">
          <div>
            <label class="mb-2 block text-sm text-slate">App 名称（每行一个）</label>
            <textarea
              v-model="rawInput"
              class="textarea-base min-h-[260px]"
              placeholder="例如：
支付宝
微信
抖音"
            />
            <div class="mt-2 text-xs text-slate">已解析 {{ parsedAppNames.length }} 条（最多 {{ MAX_BATCH_ITEMS }} 条）</div>
          </div>

          <div class="space-y-3">
            <div>
              <label class="mb-2 block text-sm text-slate">国家</label>
              <select v-model="country" class="select-base">
                <option v-for="item in countries" :key="item.value" :value="item.value">
                  {{ item.label }}
                </option>
              </select>
            </div>

            <label class="flex items-center gap-2 text-sm text-parchment">
              <input v-model="persistDraft" type="checkbox" />
              抓取成功后写入草稿 App
            </label>

            <div class="flex flex-wrap gap-2 pt-2">
              <button class="btn-primary" :disabled="!canStart" @click="startJob">
                {{ loading ? '创建中...' : '开始抓取' }}
              </button>
              <button class="btn-danger" :disabled="!canStop" @click="stopJob">
                {{ stopping ? '停止中...' : '停止' }}
              </button>
              <button class="btn-ghost" :disabled="!canRetry" @click="retryFailed">
                {{ retrying ? '重试中...' : '失败重试' }}
              </button>
              <button class="btn-ghost" :disabled="!canExport" @click="exportJson">导出 JSON</button>
            </div>
          </div>
        </div>
      </section>

      <div v-if="message" class="panel border-signal/40 p-4 text-sm text-mint">
        {{ message }}
      </div>
      <div v-if="errorMessage" class="panel border-danger/40 p-4 text-sm text-danger">
        {{ errorMessage }}
      </div>

      <section class="panel p-5">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl">执行进度</h2>
            <p class="text-xs text-slate">任务 ID：{{ jobId || '-' }}</p>
          </div>
          <span class="badge border-charcoal text-slate">{{ job?.status || 'idle' }}</span>
        </div>

        <div class="space-y-2 text-sm text-parchment">
          <div>总数：{{ progress.total }}，已处理：{{ progress.processed }}，成功：{{ progress.success }}，失败：{{ progress.failed }}</div>
          <div v-if="progress.currentAppName">当前：{{ progress.currentAppName }}</div>
          <div v-if="job?.status === 'queued'" class="text-warning">
            排队中：前方 {{ job?.queue?.ahead ?? 0 }} 个任务（队列位次 {{ job?.queue?.position ?? '-' }} / {{ job?.queue?.queuedTotal ?? '-' }}）
          </div>
        </div>
        <div class="mt-3 h-2 rounded bg-charcoal">
          <div class="h-2 rounded bg-signal transition-all duration-300" :style="{ width: `${Math.min(100, Math.max(0, progress.percent || 0))}%` }" />
        </div>
      </section>

      <section class="panel overflow-x-auto p-5">
        <h2 class="mb-3 text-2xl">结果表格</h2>
        <table class="table-shell min-w-[1200px]">
          <thead class="border-b border-charcoal">
            <tr>
              <th>#</th>
              <th>输入名称</th>
              <th>状态</th>
              <th>Track ID</th>
              <th>Track Name</th>
              <th>Bundle ID</th>
              <th>开发者</th>
              <th>隐私政策</th>
              <th>错误信息</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="`${row.index}-${row.appName}`" class="border-b border-charcoal/50 last:border-none">
              <td>{{ row.index }}</td>
              <td>{{ row.appName }}</td>
              <td>
                <span class="badge" :class="row.status === 'success' ? 'border-signal/50 text-signal' : row.status === 'stopped' ? 'border-charcoal text-slate' : 'border-danger/50 text-danger'">
                  {{ row.status }}
                </span>
              </td>
              <td>{{ row.trackId ?? '-' }}</td>
              <td>{{ row.trackName || '-' }}</td>
              <td>{{ row.bundleId || '-' }}</td>
              <td>{{ row.developerName || '-' }}</td>
              <td>
                <a v-if="row.privacyPolicyUrl" :href="row.privacyPolicyUrl" target="_blank" class="text-signal underline">查看</a>
                <span v-else>-</span>
              </td>
              <td>
                <div class="text-xs text-danger">{{ row.errorCode || '-' }}</div>
                <div class="text-xs text-slate">{{ row.errorMessage || '' }}</div>
              </td>
            </tr>
            <tr v-if="rows.length === 0">
              <td colspan="9" class="py-8 text-center text-sm text-slate">暂无结果，请先查询任务或创建新任务。</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </AdminLayout>
</template>
