<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, getApiErrorMessage } from '@/api/client'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import RiskBadge from '@/components/ui/RiskBadge.vue'

const q = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const items = ref<any[]>([])
const message = ref('')
const busy = ref(false)
const selected = ref<string[]>([])
const pendingAction = ref<'restore_ai' | 'recalculate_risk' | ''>('')

const allChecked = computed(() => items.value.length > 0 && selected.value.length === items.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const load = async () => {
  const res = await api.get('/admin/analyses', { params: { q: q.value, page: page.value, pageSize: pageSize.value } })
  items.value = res.data.items
  total.value = res.data.total
  selected.value = selected.value.filter((id) => items.value.some((item) => item.id === id))
}

const toggleAll = () => {
  selected.value = allChecked.value ? [] : items.value.map((item) => item.id)
}

const toggleOne = (id: string) => {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((item) => item !== id)
    : [...selected.value, id]
}

const doBulk = async () => {
  try {
    busy.value = true
    await api.post('/admin/analyses/bulk-action', { ids: selected.value, action: pendingAction.value })
    message.value = '批量操作完成'
    pendingAction.value = ''
    await load()
  } catch (e) {
    message.value = getApiErrorMessage(e)
    pendingAction.value = ''
  } finally {
    busy.value = false
  }
}

const runOne = async (id: string, action: 'restore_ai' | 'recalculate_risk') => {
  const actionLabel = action === 'restore_ai' ? '恢复 AI 初稿' : '重算风险'
  if (!window.confirm(`确认${actionLabel}？`)) return
  try {
    busy.value = true
    if (action === 'restore_ai') {
      await api.post(`/admin/analyses/${id}/restore`)
    } else {
      await api.post('/admin/analyses/bulk-action', { ids: [id], action: 'recalculate_risk' })
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
          <div class="label-overline">Analysis Editing</div>
          <h1 class="text-3xl">分析结果管理</h1>
        </div>
      </div>

      <div class="panel space-y-4 p-4">
        <div class="flex gap-3">
          <input v-model="q" class="input-base" placeholder="搜索分析记录（名称/分类/slug）" />
          <button class="btn-primary shrink-0" @click="page = 1; load()">查询</button>
        </div>

        <div class="flex flex-wrap gap-2">
          <button class="btn-ghost" :disabled="busy" @click="selected.length ? pendingAction = 'restore_ai' : message = '请先勾选记录'">批量恢复 AI 初稿</button>
          <button class="btn-primary" :disabled="busy" @click="selected.length ? pendingAction = 'recalculate_risk' : message = '请先勾选记录'">批量重算风险</button>
        </div>

        <p v-if="message" class="text-sm text-parchment">{{ message }}</p>
      </div>

      <div class="panel overflow-x-auto p-4">
        <table class="table-shell min-w-[980px]">
          <thead class="border-b border-charcoal">
            <tr>
              <th><input type="checkbox" :checked="allChecked" @change="toggleAll" /></th>
              <th>应用</th>
              <th>风险</th>
              <th>状态</th>
              <th>分析时间</th>
              <th>一句话总结</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id" class="border-b border-charcoal/50 last:border-none">
              <td><input type="checkbox" :checked="selected.includes(item.id)" @change="toggleOne(item.id)" /></td>
              <td class="font-medium">{{ item.name }}</td>
              <td><RiskBadge :level="item.riskLevel" /></td>
              <td>{{ item.status }}</td>
              <td class="text-slate">{{ item.analyzedAtLabel }}</td>
              <td class="max-w-[320px] truncate">{{ item.oneLiner || '-' }}</td>
              <td>
                <div class="flex flex-wrap gap-2">
                  <router-link class="btn-ghost" :to="`/admin/analyses/${item.id}`">编辑</router-link>
                  <button class="btn-ghost" :disabled="busy" @click="runOne(item.id, 'restore_ai')">恢复初稿</button>
                  <button class="btn-ghost" :disabled="busy" @click="runOne(item.id, 'recalculate_risk')">重算风险</button>
                </div>
              </td>
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
      title="确认批量分析操作"
      :description="`即将执行 ${pendingAction}，共 ${selected.length} 条。`"
      confirm-text="确认执行"
      @close="pendingAction = ''"
      @confirm="doBulk"
    />
  </AdminLayout>
</template>
