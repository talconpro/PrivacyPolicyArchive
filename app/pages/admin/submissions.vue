<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const filters = reactive({ status: '', fetchStatus: '', analysisStatus: '', q: '', page: 1, pageSize: 20 })
const query = computed(() => ({ ...filters }))
const selectedIds = ref<string[]>([])
const batchNote = ref('')
const actionNotice = ref('')
const actionBusy = ref(false)

const { data, pending, refresh } = await useAsyncData('admin-submissions', () => $fetch('/api/admin/submissions', { query: query.value }), { watch: [query] })

watch(() => [data.value?.page, data.value?.items?.length], () => { selectedIds.value = [] })

const allChecked = computed({
  get() {
    const items = data.value?.items || []
    if (!items.length) return false
    return items.every((item: any) => selectedIds.value.includes(item.id))
  },
  set(value: boolean) {
    const items = data.value?.items || []
    selectedIds.value = value ? items.map((item: any) => item.id) : []
  }
})

function parseError(error: any) {
  return error?.data?.message || error?.data?.statusMessage || '操作失败'
}

async function runSingle(id: string, action: 'process' | 'approve' | 'reject' | 'send_back', note?: string) {
  actionBusy.value = true
  actionNotice.value = ''
  try {
    if (action === 'send_back') {
      await $fetch(`/api/admin/submissions/${id}/send-back`, { method: 'POST', body: { adminNote: note || '' } })
    } else {
      await $fetch(`/api/admin/submissions/${id}/${action}`, { method: 'POST', body: { adminNote: note || '' } })
    }
    actionNotice.value = '操作成功'
    await refresh()
  } catch (error: any) {
    actionNotice.value = parseError(error)
  } finally {
    actionBusy.value = false
  }
}

async function runBulk(action: 'process' | 'approve' | 'reject' | 'send_back') {
  if (!selectedIds.value.length) {
    actionNotice.value = '请先选择至少一条提交'
    return
  }
  if (action === 'send_back' && !batchNote.value.trim()) {
    actionNotice.value = '批量退回时备注不能为空'
    return
  }
  const actionLabel = action === 'process' ? '处理' : action === 'approve' ? '通过' : action === 'reject' ? '拒绝' : '退回'
  if (!window.confirm(`确认批量${actionLabel}，共 ${selectedIds.value.length} 条？`)) return

  actionBusy.value = true
  actionNotice.value = ''
  try {
    const result = await $fetch('/api/admin/submissions/bulk-action', { method: 'POST', body: { ids: selectedIds.value, action, adminNote: batchNote.value } })
    actionNotice.value = `批量完成：成功 ${result.success}，失败 ${result.failed}`
    await refresh()
  } catch (error: any) {
    actionNotice.value = parseError(error)
  } finally {
    actionBusy.value = false
  }
}

function goPage(page: number) {
  if (page < 1) return
  const total = data.value?.total || 0
  const pageSize = data.value?.pageSize || filters.pageSize
  const maxPage = Math.max(1, Math.ceil(total / pageSize))
  if (page > maxPage) return
  filters.page = page
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div class="label-overline">Submission workflow</div>
        <h1 class="text-3xl">提交审核工作台</h1>
      </div>
      <NuxtLink class="btn-ghost" to="/admin/jobs">查看任务日志</NuxtLink>
    </div>

    <div class="panel p-4 space-y-3">
      <div class="grid gap-3 md:grid-cols-5">
        <input v-model="filters.q" class="input-base md:col-span-2" placeholder="搜索应用名 / 隐私链接 / 邮箱" />
        <select v-model="filters.status" class="select-base">
          <option value="">全部状态</option>
          <option value="pending">pending</option><option value="processing">processing</option><option value="review_ready">review_ready</option>
          <option value="needs_revision">needs_revision</option><option value="approved">approved</option><option value="rejected">rejected</option>
          <option value="failed">failed</option><option value="superseded">superseded</option>
        </select>
        <select v-model="filters.fetchStatus" class="select-base"><option value="">全部抓取状态</option><option value="idle">idle</option><option value="running">running</option><option value="success">success</option><option value="failed">failed</option></select>
        <select v-model="filters.analysisStatus" class="select-base"><option value="">全部分析状态</option><option value="idle">idle</option><option value="queued">queued</option><option value="success">success</option><option value="failed">failed</option></select>
      </div>
      <div class="grid gap-3 md:grid-cols-[1fr,auto,auto,auto,auto]">
        <input v-model="batchNote" class="input-base" placeholder="批量备注（退回时必填）" />
        <button class="btn-ghost" :disabled="actionBusy" @click="runBulk('process')">批量处理</button>
        <button class="btn-primary" :disabled="actionBusy" @click="runBulk('approve')">批量通过</button>
        <button class="btn-danger" :disabled="actionBusy" @click="runBulk('reject')">批量拒绝</button>
        <button class="btn-ghost" :disabled="actionBusy" @click="runBulk('send_back')">批量退回</button>
      </div>
      <p v-if="actionNotice" class="text-sm" :class="actionNotice.includes('失败') ? 'text-danger' : 'text-mint'">{{ actionNotice }}</p>
    </div>

    <div class="panel overflow-x-auto p-4">
      <table class="table-shell min-w-[980px]"><thead class="border-b border-charcoal"><tr><th><input v-model="allChecked" type="checkbox" /></th><th>应用</th><th>状态</th><th>抓取/分析</th><th>提交时间</th><th>备注</th><th>操作</th></tr></thead>
      <tbody>
        <tr v-if="pending"><td colspan="7" class="px-3 py-8 text-center text-slate">加载中...</td></tr>
        <tr v-for="item in data?.items || []" :key="item.id" class="border-b border-charcoal last:border-none">
          <td><input v-model="selectedIds" type="checkbox" :value="item.id" /></td>
          <td><div class="font-medium">{{ item.appName }}</div><a :href="item.privacyUrl" target="_blank" class="text-xs text-signal">{{ item.privacyUrl }}</a></td>
          <td><span class="badge">{{ item.status }}</span></td><td class="text-sm">{{ item.fetchStatus }} / {{ item.analysisStatus }}</td><td class="text-sm">{{ item.createdAtLabel }}</td>
          <td class="max-w-[260px] text-xs text-slate">{{ item.adminNote || item.processingError || item.remark || '-' }}</td>
          <td><div class="flex flex-wrap gap-2"><NuxtLink :to="`/admin/submissions/${item.id}`" class="btn-ghost">详情</NuxtLink><button class="btn-ghost" :disabled="actionBusy || item.status === 'processing'" @click="runSingle(item.id, 'process')">处理</button><button class="btn-primary" :disabled="actionBusy" @click="runSingle(item.id, 'approve')">通过</button><button class="btn-danger" :disabled="actionBusy" @click="runSingle(item.id, 'reject')">拒绝</button><button class="btn-ghost" :disabled="actionBusy" @click="() => { const note = window.prompt('请输入退回原因（必填）', item.adminNote || ''); if (note) runSingle(item.id, 'send_back', note) }">退回</button></div></td>
        </tr>
      </tbody></table>
      <div class="mt-4 flex items-center justify-between text-sm text-slate"><div>共 {{ data?.total || 0 }} 条</div><div class="flex items-center gap-2"><button class="btn-ghost" @click="goPage((data?.page || 1) - 1)">上一页</button><span>第 {{ data?.page || 1 }} 页</span><button class="btn-ghost" @click="goPage((data?.page || 1) + 1)">下一页</button></div></div>
    </div>
  </div>
</template>
