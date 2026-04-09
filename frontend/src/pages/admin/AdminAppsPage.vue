<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, getApiErrorMessage } from '@/api/client'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'

type BulkAction = 'publish' | 'archive' | 'reanalyze' | 'delete' | ''

const q = ref('')
const statusValues = ref<string[]>([])
const risk = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const items = ref<any[]>([])
const message = ref('')
const busy = ref(false)
const selected = ref<string[]>([])
const pendingAction = ref<BulkAction>('')

const statusOptions = [
  { value: 'draft', label: '草稿' },
  { value: 'review_ready', label: '待审核' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' },
]

const statusLabelMap: Record<string, string> = {
  draft: '草稿',
  review_ready: '待审核',
  published: '已发布',
  archived: '已归档',
}

const riskLabelMap: Record<string, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
  critical: '严重',
}

const actionLabelMap: Record<Exclude<BulkAction, ''>, string> = {
  publish: '批量发布',
  archive: '批量归档',
  reanalyze: '批量重分析',
  delete: '批量删除',
}

const allChecked = computed(() => items.value.length > 0 && selected.value.length === items.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const statusFilterLabel = computed(() => {
  if (statusValues.value.length === 0) return '全部状态'
  return statusOptions
    .filter((item) => statusValues.value.includes(item.value))
    .map((item) => item.label)
    .join('、')
})

const statusClass = (value: string) => {
  if (value === 'published') return 'text-signal border-signal/50'
  if (value === 'review_ready') return 'text-warning border-warning/50'
  if (value === 'archived') return 'text-slate border-charcoal'
  return 'text-parchment border-charcoal'
}

const riskClass = (value: string) => {
  if (value === 'critical') return 'text-danger border-danger/50'
  if (value === 'high') return 'text-red-400 border-red-400/50'
  if (value === 'medium') return 'text-warning border-warning/50'
  if (value === 'low') return 'text-signal border-signal/50'
  return 'text-slate border-charcoal'
}

const load = async () => {
  const res = await api.get('/admin/apps', {
    params: {
      q: q.value,
      statuses: statusValues.value.join(','),
      risk: risk.value,
      page: page.value,
      pageSize: pageSize.value,
    },
  })
  items.value = res.data.items || []
  total.value = Number(res.data.total || 0)
  selected.value = selected.value.filter((id) => items.value.some((item) => item.id === id))
}

const toggleStatus = (value: string) => {
  statusValues.value = statusValues.value.includes(value)
    ? statusValues.value.filter((item) => item !== value)
    : [...statusValues.value, value]
}

const resetFilters = async () => {
  q.value = ''
  statusValues.value = []
  risk.value = ''
  page.value = 1
  await load()
}

const toggleAll = () => {
  selected.value = allChecked.value ? [] : items.value.map((item) => item.id)
}

const toggleOne = (id: string) => {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((item) => item !== id)
    : [...selected.value, id]
}

const openBulk = (action: Exclude<BulkAction, ''>) => {
  if (selected.value.length === 0) {
    message.value = '请先勾选要操作的应用。'
    return
  }
  pendingAction.value = action
}

const closeBulkDialog = () => {
  pendingAction.value = ''
}

const confirmBulk = async () => {
  if (!pendingAction.value) return
  try {
    busy.value = true
    await api.post('/admin/apps/bulk-action', { ids: selected.value, action: pendingAction.value })
    message.value = `${actionLabelMap[pendingAction.value as Exclude<BulkAction, ''>]}完成`
    pendingAction.value = ''
    await load()
  } catch (e) {
    message.value = getApiErrorMessage(e)
    pendingAction.value = ''
  } finally {
    busy.value = false
  }
}

const runOne = async (id: string, action: Exclude<BulkAction, ''>) => {
  const actionLabel = actionLabelMap[action].replace('批量', '')
  if (!window.confirm(`确认${actionLabel}该应用？`)) return

  try {
    busy.value = true
    if (action === 'publish') {
      await api.post(`/admin/apps/${id}/publish`)
    } else if (action === 'reanalyze') {
      await api.post(`/admin/apps/${id}/reanalyze`)
    } else if (action === 'archive') {
      await api.post('/admin/apps/bulk-action', { ids: [id], action: 'archive' })
    } else {
      await api.delete(`/admin/apps/${id}`)
      selected.value = selected.value.filter((item) => item !== id)
    }
    message.value = `${actionLabel}成功`
    await load()
  } catch (e) {
    message.value = getApiErrorMessage(e)
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<template>
  <AdminLayout>
    <div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div class="label-overline">App Editing</div>
          <h1 class="text-3xl">App 管理</h1>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-sm text-slate">支持多状态筛选、批量操作和删除</div>
          <router-link to="/admin/apps/new" class="btn-primary">新增 App</router-link>
        </div>
      </div>

      <div class="panel space-y-4 p-4">
        <div class="grid gap-3 md:grid-cols-3">
          <input v-model="q" class="input-base" placeholder="搜索名称 / slug / 开发商" />

          <select v-model="risk" class="select-base">
            <option value="">全部风险</option>
            <option value="low">低风险</option>
            <option value="medium">中风险</option>
            <option value="high">高风险</option>
            <option value="critical">严重</option>
          </select>

          <div class="flex flex-wrap gap-2">
            <button class="btn-primary" @click="page = 1; load()">查询</button>
            <button class="btn-ghost" @click="resetFilters">重置</button>
          </div>
        </div>

        <div class="rounded-sm border border-charcoal p-3">
          <div class="mb-2 text-sm text-slate">状态多选：{{ statusFilterLabel }}</div>
          <div class="flex flex-wrap gap-3 text-sm">
            <label v-for="item in statusOptions" :key="item.value" class="inline-flex items-center gap-2">
              <input
                type="checkbox"
                :checked="statusValues.includes(item.value)"
                @change="toggleStatus(item.value)"
              />
              <span>{{ item.label }}</span>
            </label>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button class="btn-primary" :disabled="busy" @click="openBulk('publish')">批量发布</button>
          <button class="btn-danger" :disabled="busy" @click="openBulk('archive')">批量归档</button>
          <button class="btn-ghost" :disabled="busy" @click="openBulk('reanalyze')">批量重分析</button>
          <button class="btn-danger" :disabled="busy" @click="openBulk('delete')">批量删除</button>
        </div>

        <p v-if="message" class="text-sm text-parchment">{{ message }}</p>
      </div>

      <div class="panel overflow-x-auto p-4">
        <table class="table-shell min-w-[1100px]">
          <thead class="border-b border-charcoal">
            <tr>
              <th><input type="checkbox" :checked="allChecked" @change="toggleAll" /></th>
              <th>名称</th>
              <th>分类</th>
              <th>风险</th>
              <th>状态</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id" class="border-b border-charcoal/50 last:border-none">
              <td><input type="checkbox" :checked="selected.includes(item.id)" @change="toggleOne(item.id)" /></td>
              <td>
                <div class="font-medium">{{ item.name }}</div>
                <div class="text-xs text-slate">{{ item.slug }}</div>
              </td>
              <td>{{ item.category || '-' }}</td>
              <td>
                <span class="badge" :class="riskClass(item.riskLevel)">
                  {{ riskLabelMap[item.riskLevel] || item.riskLevel || '未评级' }}
                </span>
              </td>
              <td>
                <span class="badge" :class="statusClass(item.status)">
                  {{ statusLabelMap[item.status] || item.status }}
                </span>
              </td>
              <td class="text-slate">{{ item.updatedAtLabel }}</td>
              <td>
                <div class="flex flex-wrap gap-2">
                  <router-link class="btn-ghost" :to="`/admin/apps/${item.id}`">编辑</router-link>
                  <button class="btn-ghost" :disabled="busy" @click="runOne(item.id, 'publish')">发布</button>
                  <button class="btn-ghost" :disabled="busy" @click="runOne(item.id, 'reanalyze')">重分析</button>
                  <button class="btn-danger" :disabled="busy" @click="runOne(item.id, 'archive')">归档</button>
                  <button class="btn-danger" :disabled="busy" @click="runOne(item.id, 'delete')">删除</button>
                </div>
              </td>
            </tr>
            <tr v-if="items.length === 0">
              <td colspan="7" class="py-8 text-center text-sm text-slate">暂无数据</td>
            </tr>
          </tbody>
        </table>

        <div class="mt-4 flex items-center justify-between text-sm text-slate">
          <span>第 {{ page }} / {{ totalPages }} 页 · 共 {{ total }} 条</span>
          <div class="flex gap-2">
            <button class="btn-ghost" :disabled="page <= 1" @click="page--; load()">上一页</button>
            <button class="btn-ghost" :disabled="page >= totalPages" @click="page++; load()">下一页</button>
          </div>
        </div>
      </div>
    </div>

    <ConfirmDialog
      :open="pendingAction !== ''"
      title="确认批量操作"
      :description="`即将执行 ${pendingAction ? actionLabelMap[pendingAction as Exclude<BulkAction, ''>] : ''}，影响 ${selected.length} 条记录。`"
      confirm-text="确认执行"
      @close="closeBulkDialog"
      @confirm="confirmBulk"
    />
  </AdminLayout>
</template>
