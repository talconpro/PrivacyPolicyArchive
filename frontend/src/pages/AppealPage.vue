<script setup lang="ts">
import { reactive, ref } from 'vue'
import { api, getApiErrorMessage } from '@/api/client'
import { useSiteRuntimeSettings } from '@/composables/useSiteRuntimeSettings'

const { settings: runtimeSettings } = useSiteRuntimeSettings()

const loading = ref(false)
const message = ref('')
const successId = ref('')

const form = reactive({
  appName: '',
  pageUrl: '',
  issueType: 'inaccurate_info',
  description: '',
  evidenceRaw: '',
  contactEmail: '',
})

const submit = async () => {
  loading.value = true
  message.value = ''
  successId.value = ''
  try {
    const evidenceUrls = form.evidenceRaw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    const payload = {
      appName: form.appName,
      pageUrl: form.pageUrl || undefined,
      issueType: form.issueType,
      description: form.description,
      evidenceUrls,
      contactEmail: form.contactEmail,
    }
    const res = await api.post('/appeals', payload)
    successId.value = res.data?.id || ''
    message.value = '申诉已提交，我们会尽快处理。'
    form.appName = ''
    form.pageUrl = ''
    form.issueType = 'inaccurate_info'
    form.description = ''
    form.evidenceRaw = ''
  } catch (error) {
    message.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <section class="panel-accent p-6">
      <div class="label-overline">Developer Appeal</div>
      <h1 class="mt-2 text-3xl tracking-[-0.03em]">开发者申诉通道</h1>
      <p class="mt-4 text-base leading-7 text-parchment">
        如您是应用开发者或权利方，认为页面信息存在不准确、侵权或更新滞后，可直接提交申诉工单。
      </p>
      <p class="mt-2 text-sm text-slate">
        联系邮箱：{{ runtimeSettings.contactEmail }} ｜ 申诉 SLA：{{ runtimeSettings.appealSlaDays }} 个工作日
      </p>
    </section>

    <section class="panel space-y-4 p-6">
      <div class="grid gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <label class="text-sm text-slate">应用名称 *</label>
          <input v-model="form.appName" class="input-base" maxlength="120" placeholder="例如：支付宝">
        </div>
        <div class="space-y-2">
          <label class="text-sm text-slate">联系邮箱 *</label>
          <input v-model="form.contactEmail" class="input-base" maxlength="120" placeholder="your@email.com">
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <label class="text-sm text-slate">相关页面链接</label>
          <input v-model="form.pageUrl" class="input-base" maxlength="2000" placeholder="https://...">
        </div>
        <div class="space-y-2">
          <label class="text-sm text-slate">问题类型 *</label>
          <select v-model="form.issueType" class="select-base">
            <option value="inaccurate_info">信息不准确</option>
            <option value="infringement">侵权投诉</option>
            <option value="outdated_content">内容过期/滞后</option>
            <option value="other">其他问题</option>
          </select>
        </div>
      </div>

      <div class="space-y-2">
        <label class="text-sm text-slate">详细说明 *</label>
        <textarea
          v-model="form.description"
          class="textarea-base min-h-[140px]"
          maxlength="4000"
          placeholder="请描述具体问题、影响范围和建议修正方式。"
        />
      </div>

      <div class="space-y-2">
        <label class="text-sm text-slate">证据链接（可选，多行）</label>
        <textarea
          v-model="form.evidenceRaw"
          class="textarea-base min-h-[100px]"
          placeholder="每行一个 URL，例如截图、声明页、权利证明等。"
        />
      </div>

      <div class="flex items-center gap-3">
        <button class="btn-primary" :disabled="loading" @click="submit">
          {{ loading ? '提交中...' : '提交申诉' }}
        </button>
        <span v-if="message" class="text-sm text-parchment">{{ message }}</span>
      </div>
      <div v-if="successId" class="text-xs text-slate">工单编号：{{ successId }}</div>
    </section>
  </div>
</template>
