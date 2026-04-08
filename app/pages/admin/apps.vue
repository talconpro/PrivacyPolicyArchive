<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const filters = reactive({ q: '', status: '', risk: '', page: 1, pageSize: 20 })
const query = computed(() => ({ ...filters }))
const selectedIds = ref<string[]>([])
const notice = ref('')
const busy = ref(false)

const { data, refresh, pending } = await useAsyncData(
  'admin-apps',
  () => $fetch('/api/admin/apps', { query: query.value }),
  { watch: [query] }
)

watch(() => [data.value?.page, data.value?.items?.length], () => {
  selectedIds.value = []
})

const allChecked = computed({
  get() {
    const items = data.value?.items || []
    return items.length > 0 && items.every((item: any) => selectedIds.value.includes(item.id))
  },
  set(value: boolean) {
    const items = data.value?.items || []
    selectedIds.value = value ? items.map((item: any) => item.id) : []
  }
})

function parseError(error: any) {
  return error?.data?.message || error?.data?.statusMessage || '操作失败'
}

async function runBulk(action: 'publish' | 'archive' | 'reanalyze') {
  if (!selectedIds.value.length) {
    notice.value = '请先选择至少一条 App'
    return
  }

  const actionLabel = action === 'publish' ? '发布' : action === 'archive' ? '归档' : '重分析'
  if (!window.confirm(`确认批量${actionLabel}，共 ${selectedIds.value.length} 条？`)) return

  busy.value = true
  notice.value = ''
  try {
    const result = await $fetch('/api/admin/apps/bulk-action', {
      method: 'POST',
      body: { ids: selectedIds.value, action }
    })
    notice.value = `批量完成：成功 ${result.success}，失败 ${result.failed}`
    await refresh()
  } catch (error: any) {
    notice.value = parseError(error)
  } finally {
    busy.value = false
  }
}

async function runOne(id: string, action: 'publish' | 'archive' | 'reanalyze') {
  if (!window.confirm(`确认执行${action}操作？`)) return
  busy.value = true
  notice.value = ''
  try {
    if (action === 'publish') {
      await $fetch(`/api/admin/apps/${id}/publish`, { method: 'POST' })
    } else if (action === 'reanalyze') {
      await $fetch(`/api/admin/apps/${id}/reanalyze`, { method: 'POST' })
    } else {
      await $fetch(`/api/admin/apps/bulk-action`, { method: 'POST', body: { ids: [id], action: 'archive' } })
    }
    notice.value = '操作成功'
    await refresh()
  } catch (error: any) {
    notice.value = parseError(error)
  } finally {
    busy.value = false
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
        <div class="label-overline">App editing</div>
        <h1 class="text-3xl">App 管理</h1>
      </div>
      <div class="text-sm text-slate">支持批量发布、归档和重分析。</div>
    </div>

    <div class="panel p-4 space-y-3">
      <div class="grid gap-3 md:grid-cols-4">
        <input v-model="filters.q" class="input-base md:col-span-2" placeholder="搜索名称 / slug / 开发商" />
        <select v-model="filters.status" class="select-base">
          <option value="">全部状态</option>
          <option value="draft">draft</option>
          <option value="review_ready">review_ready</option>
          <option value="published">published</option>
          <option value="archived">archived</option>
        </select>
        <select v-model="filters.risk" class="select-base">
          <option value="">全部风险</option>
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
          <option value="critical">critical</option>
        </select>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="btn-primary" :disabled="busy" @click="runBulk('publish')">批量发布</button>
        <button class="btn-danger" :disabled="busy" @click="runBulk('archive')">批量归档</button>
        <button class="btn-ghost" :disabled="busy" @click="runBulk('reanalyze')">批量重分析</button>
      </div>
      <p v-if="notice" class="text-sm" :class="notice.includes('失败') ? 'text-danger' : 'text-mint'">{{ notice }}</p>
    </div>

    <div class="panel overflow-x-auto p-4">
      <table class="table-shell min-w-[900px]">
        <thead class="border-b border-charcoal">
          <tr>
            <th><input v-model="allChecked" type="checkbox" /></th>
            <th>名称</th>
            <th>类别</th>
<!--            <th>风险</th>-->
            <th>状态</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="pending"><td colspan="7" class="px-3 py-8 text-center text-slate">加载中...</td></tr>
          <tr v-for="app in data?.items || []" :key="app.id" class="border-b border-charcoal last:border-none">
            <td><input v-model="selectedIds" type="checkbox" :value="app.id" /></td>
            <td>
              <div class="font-medium">{{ app.name }}</div>
              <div class="text-xs text-slate">{{ app.slug }}</div>
            </td>
            <td>{{ app.category }}</td>
<!--            <td><RiskBadge :level="app.riskLevel" /></td>-->
            <td>{{ app.status }}</td>
            <td>{{ app.updatedAtLabel }}</td>
            <td>
              <div class="flex flex-wrap items-center gap-2">
                <NuxtLink :to="`/admin/apps/${app.id}`" class="text-signal">编辑</NuxtLink>
                <button class="btn-ghost" :disabled="busy" @click="runOne(app.id, 'publish')">发布</button>
                <button class="btn-ghost" :disabled="busy" @click="runOne(app.id, 'reanalyze')">重分析</button>
                <button class="btn-danger" :disabled="busy" @click="runOne(app.id, 'archive')">归档</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="mt-4 flex items-center justify-between text-sm text-slate">
        <div>共 {{ data?.total || 0 }} 条</div>
        <div class="flex items-center gap-2">
          <button class="btn-ghost" @click="goPage((data?.page || 1) - 1)">上一页</button>
          <span>第 {{ data?.page || 1 }} 页</span>
          <button class="btn-ghost" @click="goPage((data?.page || 1) + 1)">下一页</button>
        </div>
      </div>
    </div>
  </div>
</template>
