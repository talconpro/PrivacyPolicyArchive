<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api, getApiErrorMessage } from '@/api/client'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'

const route = useRoute()
const detail = ref<any>(null)
const adminNote = ref('')
const message = ref('')
const busy = ref(false)
const action = ref<'process' | 'approve' | 'reject' | 'send-back' | ''>('')

const labelMap: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  review_ready: '待审核',
  needs_revision: '待补充',
  approved: '已通过',
  rejected: '已拒绝',
  failed: '失败',
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
  const res = await api.get(`/admin/submissions/${route.params.id}`)
  detail.value = res.data
  adminNote.value = res.data.submission.adminNote || ''
}

const doAction = async () => {
  if (!action.value) return
  try {
    busy.value = true
    await api.post(`/admin/submissions/${route.params.id}/${action.value}`, { adminNote: adminNote.value })
    message.value = '操作成功'
    action.value = ''
    await load()
  } catch (e) {
    message.value = getApiErrorMessage(e)
    action.value = ''
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<template>
  <AdminLayout>
    <div v-if="detail" class="space-y-6">
      <div>
        <div class="label-overline">Submission Detail</div>
        <h1 class="text-3xl">{{ detail.submission.appName }}</h1>
        <div class="mt-2 text-sm text-slate">{{ detail.submission.createdAtLabel }}</div>
      </div>

      <div class="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <div class="panel space-y-4 p-5">
          <div class="grid gap-3 md:grid-cols-3">
            <div>
              <p class="text-xs text-slate">审核状态</p>
              <span class="badge" :class="badgeClass(detail.submission.status)">{{ labelMap[detail.submission.status] || detail.submission.status }}</span>
            </div>
            <div>
              <p class="text-xs text-slate">抓取状态</p>
              <span class="badge" :class="badgeClass(detail.submission.fetchStatus)">{{ labelMap[detail.submission.fetchStatus] || detail.submission.fetchStatus }}</span>
            </div>
            <div>
              <p class="text-xs text-slate">分析状态</p>
              <span class="badge" :class="badgeClass(detail.submission.analysisStatus)">{{ labelMap[detail.submission.analysisStatus] || detail.submission.analysisStatus }}</span>
            </div>
          </div>

          <div>
            <p class="text-sm text-slate">隐私政策</p>
            <a :href="detail.submission.privacyUrl" target="_blank" class="text-signal">{{ detail.submission.privacyUrl }}</a>
          </div>

          <div v-if="detail.submission.termsUrl">
            <p class="text-sm text-slate">用户协议</p>
            <a :href="detail.submission.termsUrl" target="_blank" class="text-signal">{{ detail.submission.termsUrl }}</a>
          </div>

          <div>
            <p class="text-sm text-slate">关联 App</p>
            <div class="mt-1 text-parchment">{{ detail.linkedApp?.name || '-' }}</div>
            <router-link v-if="detail.linkedApp?.id" :to="`/admin/apps/${detail.linkedApp.id}`" class="mt-2 inline-flex text-signal hover:underline">进入 App 编辑</router-link>
          </div>

          <div>
            <p class="text-sm text-slate">审核备注</p>
            <textarea v-model="adminNote" class="textarea-base mt-2" placeholder="填写审核结论或退回原因" />
          </div>

          <div class="flex flex-wrap gap-3">
            <button class="btn-ghost" :disabled="busy || detail.submission.status === 'processing'" @click="action='process'">处理</button>
            <button class="btn-primary" :disabled="busy" @click="action='approve'">通过并发布</button>
            <button class="btn-danger" :disabled="busy" @click="action='reject'">拒绝</button>
            <button class="btn-ghost" :disabled="busy" @click="action='send-back'">退回补充</button>
          </div>

          <p v-if="message" class="text-sm text-parchment">{{ message }}</p>
        </div>

        <div class="space-y-6">
          <div v-if="detail.submission.analysisDraft" class="panel p-5">
            <h2 class="text-2xl">自动分析草稿</h2>
            <pre class="mt-3 overflow-x-auto rounded-sm border border-charcoal bg-abyss p-4 text-xs text-parchment">{{ JSON.stringify(detail.submission.analysisDraft, null, 2) }}</pre>
          </div>

          <div v-if="detail.submission.extractedText" class="panel p-5">
            <h2 class="text-2xl">抓取文本预览</h2>
            <pre class="mt-3 max-h-[24rem] overflow-auto rounded-sm border border-charcoal bg-abyss p-4 text-xs whitespace-pre-wrap text-parchment">{{ detail.submission.extractedText }}</pre>
          </div>
        </div>
      </div>
    </div>

    <ConfirmDialog
      :open="action !== ''"
      title="确认操作"
      :description="`即将执行 ${action}。`"
      confirm-text="确认"
      @close="action = ''"
      @confirm="doAction"
    />
  </AdminLayout>
</template>
