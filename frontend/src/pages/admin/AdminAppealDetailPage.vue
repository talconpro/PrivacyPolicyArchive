<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api, getApiErrorMessage } from '@/api/client'
import AdminLayout from '@/components/admin/AdminLayout.vue'

const route = useRoute()

const loading = ref(false)
const busy = ref(false)
const message = ref('')
const detail = ref<any>(null)
const timeline = ref<any[]>([])
const mailEnabled = ref(false)

const formStatus = ref<'pending' | 'processing' | 'resolved' | 'rejected'>('pending')
const formAdminNote = ref('')

const statusLabel: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
  rejected: '已驳回',
}

const issueTypeLabel: Record<string, string> = {
  inaccurate_info: '信息不准确',
  infringement: '侵权投诉',
  outdated_content: '内容过期/滞后',
  other: '其他问题',
}

const statusBadgeClass = (status: string) => {
  if (status === 'resolved') return 'border-signal/50 text-signal'
  if (status === 'processing') return 'border-warning/50 text-warning'
  if (status === 'rejected') return 'border-danger/50 text-danger'
  return 'border-charcoal text-slate'
}

const load = async () => {
  loading.value = true
  message.value = ''
  try {
    const res = await api.get(`/admin/appeals/${route.params.id}`)
    detail.value = res.data.item
    timeline.value = res.data.timeline || []
    mailEnabled.value = Boolean(res.data.mailEnabled)
    formStatus.value = res.data.item?.status || 'pending'
    formAdminNote.value = res.data.item?.adminNote || ''
  } catch (error) {
    message.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

const save = async () => {
  if (!detail.value) return
  busy.value = true
  message.value = ''
  try {
    const res = await api.patch(`/admin/appeals/${route.params.id}`, {
      status: formStatus.value,
      adminNote: formAdminNote.value,
    })
    const notice = res.data?.emailNotice
    if (notice?.attempted) {
      message.value = notice.sent ? '保存成功，邮件已发送。' : `保存成功，但邮件发送失败：${notice.message || '未知错误'}`
    } else if (formStatus.value === 'resolved' || formStatus.value === 'rejected') {
      message.value = `保存成功。邮件未发送（${notice?.message || '未配置 SMTP'}）。`
    } else {
      message.value = '保存成功。'
    }
    await load()
  } catch (error) {
    message.value = getApiErrorMessage(error)
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<template>
  <AdminLayout>
    <div v-if="detail" class="space-y-6">
      <div class="flex items-center justify-between gap-4">
        <div>
          <div class="label-overline">Appeal Detail</div>
          <h1 class="text-3xl">申诉详情</h1>
          <p class="mt-2 text-sm text-slate">工单 ID：{{ detail.id }}</p>
        </div>
        <router-link to="/admin/appeals" class="btn-ghost">返回列表</router-link>
      </div>

      <div class="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
        <section class="panel space-y-4 p-5">
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <div class="text-xs text-slate">应用名称</div>
              <div class="mt-1 text-base text-parchment">{{ detail.appName }}</div>
            </div>
            <div>
              <div class="text-xs text-slate">问题类型</div>
              <div class="mt-1 text-base text-parchment">{{ issueTypeLabel[detail.issueType] || detail.issueType }}</div>
            </div>
            <div>
              <div class="text-xs text-slate">联系邮箱</div>
              <div class="mt-1 text-base text-parchment">{{ detail.contactEmail }}</div>
            </div>
            <div>
              <div class="text-xs text-slate">当前状态</div>
              <div class="mt-1">
                <span class="badge" :class="statusBadgeClass(detail.status)">
                  {{ statusLabel[detail.status] || detail.status }}
                </span>
              </div>
            </div>
          </div>

          <div v-if="detail.pageUrl">
            <div class="text-xs text-slate">关联页面</div>
            <a :href="detail.pageUrl" target="_blank" class="mt-1 inline-flex text-sm text-signal hover:underline">
              {{ detail.pageUrl }}
            </a>
          </div>

          <div>
            <div class="text-xs text-slate">详细说明</div>
            <p class="mt-1 whitespace-pre-wrap text-sm leading-6 text-parchment">{{ detail.description }}</p>
          </div>

          <div>
            <div class="text-xs text-slate">证据链接</div>
            <div class="mt-2 space-y-1">
              <a
                v-for="(url, idx) in detail.evidenceUrls || []"
                :key="idx"
                :href="url"
                target="_blank"
                class="block truncate text-sm text-signal hover:underline"
              >
                {{ url }}
              </a>
              <div v-if="!(detail.evidenceUrls || []).length" class="text-sm text-slate">暂无证据链接</div>
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm text-slate">处理状态</label>
              <select v-model="formStatus" class="select-base">
                <option value="pending">待处理</option>
                <option value="processing">处理中</option>
                <option value="resolved">已解决</option>
                <option value="rejected">已驳回</option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="text-sm text-slate">邮件通知</label>
              <div class="mt-2 text-sm" :class="mailEnabled ? 'text-signal' : 'text-warning'">
                {{ mailEnabled ? '已启用（处理完成会自动发送）' : '未启用（请配置 SMTP 后自动发送）' }}
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-sm text-slate">管理员备注</label>
            <textarea
              v-model="formAdminNote"
              class="textarea-base min-h-[120px]"
              placeholder="填写处理结论、依据与后续建议"
            />
          </div>

          <div class="flex items-center gap-3">
            <button class="btn-primary" :disabled="busy || loading" @click="save">
              {{ busy ? '保存中...' : '保存处理结果' }}
            </button>
            <span v-if="message" class="text-sm text-parchment">{{ message }}</span>
          </div>
        </section>

        <section class="panel p-5">
          <h2 class="text-2xl">操作历史时间线</h2>
          <div class="mt-4 space-y-4">
            <div v-for="(event, idx) in timeline" :key="`${event.type}-${idx}-${event.at || ''}`" class="relative pl-6">
              <div class="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-signal" />
              <div class="text-sm text-snow">{{ event.title }}</div>
              <div class="mt-1 text-xs text-slate">
                {{ event.atLabel || event.at || '-' }} · {{ event.actor || 'system' }}
              </div>
              <p v-if="event.description" class="mt-1 text-sm leading-6 text-parchment">{{ event.description }}</p>
            </div>
            <div v-if="timeline.length === 0" class="text-sm text-slate">暂无时间线记录</div>
          </div>
        </section>
      </div>
    </div>

    <div v-else class="panel p-5">
      <p class="text-sm text-slate">{{ loading ? '加载中...' : (message || '未找到申诉记录') }}</p>
    </div>
  </AdminLayout>
</template>
