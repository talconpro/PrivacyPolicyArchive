<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, getApiErrorMessage } from '@/api/client'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import { loadSiteRuntimeSettings } from '@/composables/useSiteRuntimeSettings'

type FormState = {
  showAppIcon: boolean
  legalDisclaimerShort: string
  disclaimerNoAdviceNotice: string
  disclaimerAccuracyNotice: string
  disclaimerTrademarkNotice: string
  disclaimerRightsContactNotice: string
  dataSourceNotice: string
  aiAnalysisNotice: string
  iconUsageNotice: string
  contactEmail: string
  appealSlaDays: number
  smtpEnabled: boolean
  smtpHost: string
  smtpPort: number
  smtpUsername: string
  smtpPassword: string
  smtpSender: string
  smtpUseTls: boolean
  smtpUseSsl: boolean
  mailSubjectTemplate: string
  mailSignature: string
  mailCcEnabled: boolean
}

type TabKey = 'general' | 'disclaimer' | 'statements' | 'appeal' | 'notify'

const loading = ref(false)
const saving = ref(false)
const message = ref('')
const activeTab = ref<TabKey>('general')
const form = ref<FormState>({
  showAppIcon: true,
  legalDisclaimerShort: '',
  disclaimerNoAdviceNotice: '',
  disclaimerAccuracyNotice: '',
  disclaimerTrademarkNotice: '',
  disclaimerRightsContactNotice: '',
  dataSourceNotice: '',
  aiAnalysisNotice: '',
  iconUsageNotice: '',
  contactEmail: '',
  appealSlaDays: 3,
  smtpEnabled: true,
  smtpHost: '',
  smtpPort: 587,
  smtpUsername: '',
  smtpPassword: '',
  smtpSender: '',
  smtpUseTls: true,
  smtpUseSsl: false,
  mailSubjectTemplate: '【AppSignal】申诉处理结果通知：{statusLabel}',
  mailSignature: 'AppSignal 审核团队',
  mailCcEnabled: false,
})

const tabs: Array<{ key: TabKey; label: string; hint: string }> = [
  { key: 'general', label: '基础配置', hint: '站点展示策略与简版说明。' },
  { key: 'disclaimer', label: '免责声明正文', hint: '完整免责条款内容配置。' },
  { key: 'statements', label: '数据与 AI 声明', hint: '数据来源、AI 分析与图标引用说明。' },
  { key: 'appeal', label: '申诉与联系', hint: '联系邮箱与申诉处理 SLA 配置。' },
  { key: 'notify', label: '通知配置', hint: '申诉处理完成后的 SMTP 邮件通知配置。' },
]

const activeTabHint = computed(() => tabs.find((item) => item.key === activeTab.value)?.hint || '')

const tabClass = (key: TabKey) => {
  if (activeTab.value === key) return 'border-signal text-signal'
  return 'border-charcoal text-snow hover:border-signal hover:text-signal'
}

const syncForm = (settings: any) => {
  form.value = {
    showAppIcon: Boolean(settings?.showAppIcon),
    legalDisclaimerShort: String(settings?.legalDisclaimerShort || ''),
    disclaimerNoAdviceNotice: String(settings?.disclaimerNoAdviceNotice || ''),
    disclaimerAccuracyNotice: String(settings?.disclaimerAccuracyNotice || ''),
    disclaimerTrademarkNotice: String(settings?.disclaimerTrademarkNotice || ''),
    disclaimerRightsContactNotice: String(settings?.disclaimerRightsContactNotice || ''),
    dataSourceNotice: String(settings?.dataSourceNotice || ''),
    aiAnalysisNotice: String(settings?.aiAnalysisNotice || ''),
    iconUsageNotice: String(settings?.iconUsageNotice || ''),
    contactEmail: String(settings?.contactEmail || ''),
    appealSlaDays: Number(settings?.appealSlaDays || 3),
    smtpEnabled: Boolean(settings?.smtpEnabled),
    smtpHost: String(settings?.smtpHost || ''),
    smtpPort: Number(settings?.smtpPort || 587),
    smtpUsername: String(settings?.smtpUsername || ''),
    smtpPassword: String(settings?.smtpPassword || ''),
    smtpSender: String(settings?.smtpSender || ''),
    smtpUseTls: Boolean(settings?.smtpUseTls ?? true),
    smtpUseSsl: Boolean(settings?.smtpUseSsl ?? false),
    mailSubjectTemplate: String(settings?.mailSubjectTemplate || '【AppSignal】申诉处理结果通知：{statusLabel}'),
    mailSignature: String(settings?.mailSignature || 'AppSignal 审核团队'),
    mailCcEnabled: Boolean(settings?.mailCcEnabled),
  }
}

const load = async () => {
  loading.value = true
  message.value = ''
  try {
    const res = await api.get('/admin/site-settings')
    syncForm(res.data?.settings || {})
  } catch (error) {
    message.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

const save = async () => {
  saving.value = true
  message.value = ''
  try {
    const payload = {
      ...form.value,
      appealSlaDays: Math.max(1, Math.min(30, Number(form.value.appealSlaDays || 3))),
      smtpPort: Math.max(1, Math.min(65535, Number(form.value.smtpPort || 587))),
    }
    const res = await api.patch('/admin/site-settings', payload)
    syncForm(res.data?.settings || {})
    await loadSiteRuntimeSettings(true)
    message.value = '站点设置已保存'
  } catch (error) {
    message.value = getApiErrorMessage(error)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <AdminLayout>
    <div class="space-y-6">
      <div>
        <div class="label-overline">Site Settings</div>
        <h1 class="text-3xl">站点设置</h1>
        <p class="mt-2 text-sm text-slate">统一管理免责声明、数据来源、AI 分析声明、联系方式与图标展示策略。</p>
      </div>

      <div class="panel space-y-4 p-5">
        <div class="space-y-4 border-b border-charcoal/70 pb-4">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="item in tabs"
              :key="item.key"
              class="rounded-sm border px-3 py-2 text-sm transition-colors"
              :class="tabClass(item.key)"
              :disabled="loading || saving"
              @click="activeTab = item.key"
            >
              {{ item.label }}
            </button>
          </div>
          <p class="text-xs text-slate">{{ activeTabHint }}</p>
        </div>

        <div v-show="activeTab === 'general'" class="space-y-4">
          <label class="flex items-center justify-between gap-3 rounded-sm border border-charcoal p-3">
            <div>
              <div class="text-sm font-medium">显示 App 图标</div>
              <div class="text-xs text-slate">关闭后，前台所有 App 卡片将不再显示图标。</div>
            </div>
            <input v-model="form.showAppIcon" type="checkbox" class="h-4 w-4" :disabled="loading || saving">
          </label>

          <div class="space-y-2">
            <label class="text-sm text-slate">简版免责声明（页脚第一行）</label>
            <textarea
              v-model="form.legalDisclaimerShort"
              class="input-base min-h-[86px] w-full resize-y"
              :disabled="loading || saving"
            />
          </div>
        </div>

        <div v-show="activeTab === 'disclaimer'" class="space-y-4">
          <div class="space-y-2">
            <label class="text-sm text-slate">免责声明正文：非法律建议</label>
            <textarea
              v-model="form.disclaimerNoAdviceNotice"
              class="input-base min-h-[90px] w-full resize-y"
              :disabled="loading || saving"
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm text-slate">免责声明正文：准确性与责任限制</label>
            <textarea
              v-model="form.disclaimerAccuracyNotice"
              class="input-base min-h-[100px] w-full resize-y"
              :disabled="loading || saving"
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm text-slate">免责声明正文：商标与关联关系</label>
            <textarea
              v-model="form.disclaimerTrademarkNotice"
              class="input-base min-h-[90px] w-full resize-y"
              :disabled="loading || saving"
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm text-slate">免责声明正文：权利方反馈处理</label>
            <textarea
              v-model="form.disclaimerRightsContactNotice"
              class="input-base min-h-[90px] w-full resize-y"
              :disabled="loading || saving"
            />
          </div>
        </div>

        <div v-show="activeTab === 'statements'" class="space-y-4">
          <div class="space-y-2">
            <label class="text-sm text-slate">数据来源声明</label>
            <textarea
              v-model="form.dataSourceNotice"
              class="input-base min-h-[86px] w-full resize-y"
              :disabled="loading || saving"
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm text-slate">AI 分析声明</label>
            <textarea
              v-model="form.aiAnalysisNotice"
              class="input-base min-h-[86px] w-full resize-y"
              :disabled="loading || saving"
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm text-slate">图标声明</label>
            <textarea
              v-model="form.iconUsageNotice"
              class="input-base min-h-[86px] w-full resize-y"
              :disabled="loading || saving"
            />
          </div>

          <div class="rounded-sm border border-warning/40 bg-warning/5 p-3 text-xs text-parchment">
            建议：对外声明尽量使用中性、事实性语言，避免出现确定性法律判断词。
          </div>
        </div>

        <div v-show="activeTab === 'appeal'" class="space-y-4">
          <div class="grid gap-3 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm text-slate">联系邮箱</label>
              <input
                v-model="form.contactEmail"
                class="input-base"
                :disabled="loading || saving"
                placeholder="talconpro@outlook.com"
              >
            </div>
            <div class="space-y-2">
              <label class="text-sm text-slate">申诉 SLA（天）</label>
              <input
                v-model.number="form.appealSlaDays"
                type="number"
                min="1"
                max="30"
                class="input-base"
                :disabled="loading || saving"
              >
            </div>
          </div>
          <p class="text-xs text-slate">
            建议配置为工作邮箱，并确保 SLA 与页面对外承诺一致。
          </p>
        </div>

        <div v-show="activeTab === 'notify'" class="space-y-4">
          <label class="flex items-center justify-between gap-3 rounded-sm border border-charcoal p-3">
            <div>
              <div class="text-sm font-medium">启用申诉处理邮件通知</div>
              <div class="text-xs text-slate">当申诉状态变为“已解决/已驳回”时自动发送邮件。</div>
            </div>
            <input v-model="form.smtpEnabled" type="checkbox" class="h-4 w-4" :disabled="loading || saving">
          </label>

          <div class="grid gap-3 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm text-slate">SMTP Host</label>
              <input v-model="form.smtpHost" class="input-base" :disabled="loading || saving" placeholder="smtp.example.com">
            </div>
            <div class="space-y-2">
              <label class="text-sm text-slate">SMTP Port</label>
              <input
                v-model.number="form.smtpPort"
                type="number"
                min="1"
                max="65535"
                class="input-base"
                :disabled="loading || saving"
              >
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm text-slate">SMTP Username</label>
              <input v-model="form.smtpUsername" class="input-base" :disabled="loading || saving" placeholder="username">
            </div>
            <div class="space-y-2">
              <label class="text-sm text-slate">SMTP Sender</label>
              <input
                v-model="form.smtpSender"
                class="input-base"
                :disabled="loading || saving"
                placeholder="noreply@example.com"
              >
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-sm text-slate">SMTP Password</label>
            <input
              v-model="form.smtpPassword"
              type="password"
              class="input-base"
              :disabled="loading || saving"
              placeholder="App Password / SMTP Password"
            >
          </div>

          <div class="space-y-2">
            <label class="text-sm text-slate">邮件主题模板</label>
            <input
              v-model="form.mailSubjectTemplate"
              class="input-base"
              :disabled="loading || saving"
              placeholder="【AppSignal】申诉处理结果通知：{statusLabel}"
            >
            <p class="text-xs text-slate">
              可用变量：<code>{appName}</code>、<code>{ticketId}</code>、<code>{statusLabel}</code>、<code>{status}</code>
            </p>
          </div>

          <div class="space-y-2">
            <label class="text-sm text-slate">邮件签名</label>
            <input
              v-model="form.mailSignature"
              class="input-base"
              :disabled="loading || saving"
              placeholder="AppSignal 审核团队"
            >
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <label class="flex items-center gap-2 rounded-sm border border-charcoal p-3 text-sm">
              <input v-model="form.smtpUseTls" type="checkbox" class="h-4 w-4" :disabled="loading || saving">
              <span>TLS (STARTTLS)</span>
            </label>
            <label class="flex items-center gap-2 rounded-sm border border-charcoal p-3 text-sm">
              <input v-model="form.smtpUseSsl" type="checkbox" class="h-4 w-4" :disabled="loading || saving">
              <span>SSL (SMTPS)</span>
            </label>
          </div>

          <label class="flex items-center gap-2 rounded-sm border border-charcoal p-3 text-sm">
            <input v-model="form.mailCcEnabled" type="checkbox" class="h-4 w-4" :disabled="loading || saving">
            <span>处理完成时抄送到站点联系邮箱（{{ form.contactEmail || '未设置' }}）</span>
          </label>

          <p class="text-xs text-slate">
            提示：如使用 SSL，请关闭 TLS；如使用 587 端口，通常开启 TLS。
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button class="btn-primary" :disabled="loading || saving" @click="save">
            {{ saving ? '保存中...' : '保存设置' }}
          </button>
          <button class="btn-ghost" :disabled="loading || saving" @click="load">重新加载</button>
          <span v-if="message" class="text-sm text-parchment">{{ message }}</span>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>
