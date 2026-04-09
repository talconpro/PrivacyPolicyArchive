<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, getApiErrorMessage } from '@/api/client'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'

const q = ref('')
const status = ref('')
const fetchStatus = ref('')
const analysisStatus = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const items = ref<any[]>([])
const selected = ref<string[]>([])
const message = ref('')
const busy = ref(false)
const pendingAction = ref<'process' | 'approve' | 'reject' | 'send_back' | ''>('')
const adminNote = ref('')

const allChecked = computed(() => items.value.length > 0 && selected.value.length === items.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const labelMap: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  review_ready: '待审核',
  needs_revision: '待补充',
  approved: '已通过',
  rejected: '已拒绝',
  failed: '失败',
  superseded: '已替代',
  idle: '未开始',
  running: '进行中',
  queued: '排队中',
  success: '成功'
}

const badgeClass = (value: string) => {
  if (value === 'approved' || value === 'success') return 'text-signal border-signal/50'
  if (value === 'review_ready' || value === 'processing' || value === 'running' || value === 'queued') return 'text-warning border-warning/50'
  if (value === 'rejected' || value === 'failed') return 'text-danger border-danger/50'
  if (value === 'needs_revision') return 'text-info border-info/50'
  return 'text-slate border-charcoal'
}

const load = async () => {
  const res = await api.get('/admin/submissions', {
    params: {
      q: q.value,
      status: status.value,
      fetchStatus: fetchStatus.value,
      analysisStatus: analysisStatus.value,
      page: page.value,
      pageSize: pageSize.value
    }
  })
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

const runBulk = async () => {
  if (!pendingAction.value) return

  try {
    busy.value = true
    await api.post('/admin/submissions/bulk-action', {
      ids: selected.value,
      action: pendingAction.value,
      adminNote: adminNote.value
    })
    message.value = `批量 ${pendingAction.value} 已完成`
    pendingAction.value = ''
    adminNote.value = ''
    await load()
  } catch (e) {
    message.value = getApiErrorMessage(e)
    pendingAction.value = ''
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
          <div class="label-overline">Submission Workflow</div>
          <h1 class="text-3xl">提交审核工作台</h1>
        </div>
        <router-link class="btn-ghost" to="/admin/jobs">查看任务日志</router-link>
      </div>

      <div class="panel space-y-4 p-4">
        <div class="grid gap-3 md:grid-cols-5">
          <input v-model="q" class="input-base" placeholder="搜索 App / URL / 邮箱" />
          <select v-model="status" class="select-base">
            <option value="">全部状态</option>
            <option value="pending">待处理</option>
            <option value="processing">处理中</option>
            <option value="review_ready">待审核</option>
            <option value="needs_revision">待补充</option>
            <option value="approved">已通过</option>
            <option value="rejected">已拒绝</option>
            <option value="failed">失败</option>
            <option value="superseded">已替代</option>
          </select>
          <select v-model="fetchStatus" class="select-base">
            <option value="">全部抓取状态</option>
            <option value="idle">未开始</option>
            <option value="running">进行中</option>
            <option value="success">成功</option>
            <option value="failed">失败</option>
          </select>
          <select v-model="analysisStatus" class="select-base">
            <option value="">全部分析状态</option>
            <option value="idle">未开始</option>
            <option value="queued">排队中</option>
            <option value="success">成功</option>
            <option value="failed">失败</option>
          </select>
          <button class="btn-primary" @click="page=1; load()">查询</button>
        </div>

        <div class="grid gap-3 md:grid-cols-[1fr,auto,auto,auto,auto]">
          <input v-model="adminNote" class="input-base" placeholder="批量动作管理员备注（退回补充必填）" />
          <button class="btn-ghost" :disabled="busy" @click="selected.length ? pendingAction='process' : message='请先勾选提交'">批量处理</button>
          <button class="btn-primary" :disabled="busy" @click="selected.length ? pendingAction='approve' : message='请先勾选提交'">批量通过</button>
          <button class="btn-danger" :disabled="busy" @click="selected.length ? pendingAction='reject' : message='请先勾选提交'">批量拒绝</button>
          <button class="btn-ghost" :disabled="busy" @click="selected.length ? pendingAction='send_back' : message='请先勾选提交'">批量退回</button>
        </div>

        <p v-if="message" class="text-sm text-parchment">{{ message }}</p>
      </div>

      <div class="panel overflow-x-auto p-4">
        <table class="table-shell min-w-[1080px]">
          <thead class="border-b border-charcoal">
            <tr>
              <th><input type="checkbox" :checked="allChecked" @change="toggleAll" /></th>
              <th>App</th>
              <th>审核状态</th>
              <th>抓取状态</th>
              <th>分析状态</th>
              <th>创建时间</th>
              <th>备注</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id" class="border-b border-charcoal/50 last:border-none">
              <td><input type="checkbox" :checked="selected.includes(item.id)" @change="toggleOne(item.id)" /></td>
              <td>
                <div class="font-medium">{{ item.appName }}</div>
                <a :href="item.privacyUrl" target="_blank" class="text-xs text-signal">{{ item.privacyUrl }}</a>
              </td>
              <td><span class="badge" :class="badgeClass(item.status)">{{ labelMap[item.status] || item.status }}</span></td>
              <td><span class="badge" :class="badgeClass(item.fetchStatus)">{{ labelMap[item.fetchStatus] || item.fetchStatus }}</span></td>
              <td><span class="badge" :class="badgeClass(item.analysisStatus)">{{ labelMap[item.analysisStatus] || item.analysisStatus }}</span></td>
              <td class="text-slate">{{ item.createdAtLabel }}</td>
              <td class="max-w-[240px] text-xs text-slate">{{ item.adminNote || item.processingError || item.remark || '-' }}</td>
              <td><router-link class="btn-ghost" :to="`/admin/submissions/${item.id}`">详情</router-link></td>
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
      title="确认批量提交操作"
      :description="`即将执行 ${pendingAction}，影响 ${selected.length} 条。`"
      confirm-text="确认执行"
      @close="pendingAction = ''"
      @confirm="runBulk"
    />
  </AdminLayout>
</template>
