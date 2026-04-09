<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import RiskBadge from '@/components/ui/RiskBadge.vue'
import { api, getApiErrorMessage } from '@/api/client'
import { settings } from '@/config/settings'

const policyForm = reactive({
  appName: '',
  policyUrl: '',
  rawText: '',
})

const apkFile = ref<File | null>(null)
const policyLoading = ref(false)
const apkLoading = ref(false)
const saveLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const result = ref<any>(null)

const normalized = computed(() => result.value?.normalized || null)
const resultJson = computed(() => (result.value ? JSON.stringify(result.value, null, 2) : ''))
const apkMaxUploadMb = settings.apkMaxUploadMb

const onApkFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  apkFile.value = target.files?.[0] || null
}

const clearMessages = () => {
  errorMessage.value = ''
  successMessage.value = ''
}

const analyzePolicy = async () => {
  clearMessages()
  policyLoading.value = true
  try {
    const res = await api.post('/admin/tools/analyzer/policy-analyze', {
      appName: policyForm.appName,
      policyUrl: policyForm.policyUrl || undefined,
      rawText: policyForm.rawText || undefined,
    })
    result.value = res.data
    successMessage.value = '隐私政策分析完成。'
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    policyLoading.value = false
  }
}

const analyzeApk = async () => {
  clearMessages()
  if (!apkFile.value) {
    errorMessage.value = '请先选择 APK 文件。'
    return
  }

  apkLoading.value = true
  try {
    const formData = new FormData()
    formData.append('file', apkFile.value)

    const res = await api.post('/admin/tools/analyzer/apk-analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    result.value = res.data
    if (!policyForm.appName && res.data?.appName) {
      policyForm.appName = String(res.data.appName)
    }
    successMessage.value = 'APK 轻量分析完成。'
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    apkLoading.value = false
  }
}

const saveDraft = async () => {
  clearMessages()
  if (!result.value?.analysis) {
    errorMessage.value = '当前没有可保存的分析结果。'
    return
  }

  saveLoading.value = true
  try {
    const payload = {
      sourceType: result.value.sourceType,
      appName: result.value.appName || policyForm.appName,
      analysis: result.value.analysis,
      rawText: result.value.rawText,
      policyUrl: result.value.policyUrl,
      apkMeta: result.value.apkMeta,
    }
    const res = await api.post('/admin/tools/analyzer/save-draft', payload)
    const app = res.data?.app || {}
    successMessage.value = `已保存为草稿 App：${app.name || payload.appName}`
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error)
  } finally {
    saveLoading.value = false
  }
}
</script>

<template>
  <AdminLayout>
    <div class="space-y-6">
      <div>
        <div class="label-overline">Analyzer Workspace</div>
        <h1 class="text-4xl leading-none tracking-[-0.04em]">分析工作台</h1>
        <p class="mt-3 text-sm text-parchment">支持隐私政策 URL / 文本分析与 APK 权限轻量分析，分析结果可选择保存为草稿。</p>
      </div>

      <div class="grid gap-4 xl:grid-cols-2">
        <section class="panel p-5">
          <h2 class="text-2xl">隐私政策分析</h2>
          <div class="mt-4 space-y-3">
            <input v-model="policyForm.appName" class="input-base" placeholder="App 名称" />
            <input v-model="policyForm.policyUrl" class="input-base" placeholder="隐私政策 URL（可选）" />
            <textarea v-model="policyForm.rawText" class="textarea-base" placeholder="或直接粘贴隐私政策全文（可选）" />
          </div>
          <div class="mt-4">
            <button class="btn-primary" :disabled="policyLoading" @click="analyzePolicy">
              {{ policyLoading ? '分析中...' : '开始分析隐私政策' }}
            </button>
          </div>
        </section>

        <section class="panel p-5">
          <h2 class="text-2xl">APK 自动分析</h2>
          <p class="mt-2 text-sm text-slate">当前为轻量权限分析：解析包名、版本和权限清单。</p>
          <div class="mt-4 space-y-3">
            <input type="file" accept=".apk" class="input-base" @change="onApkFileChange" />
            <div class="text-xs text-slate">仅支持 .apk，文件大小不超过 {{ apkMaxUploadMb }}MB。</div>
          </div>
          <div class="mt-4">
            <button class="btn-primary" :disabled="apkLoading" @click="analyzeApk">
              {{ apkLoading ? '分析中...' : '上传并分析 APK' }}
            </button>
          </div>
        </section>
      </div>

      <div v-if="errorMessage" class="panel border-danger/40 p-4 text-sm text-danger">
        {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="panel border-signal/40 p-4 text-sm text-mint">
        {{ successMessage }}
      </div>

      <section class="panel p-5">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl">输出结果</h2>
            <p class="mt-1 text-xs text-slate">先看结构化结果，再展开查看原始 JSON。</p>
          </div>
          <button class="btn-ghost" :disabled="saveLoading || !result" @click="saveDraft">
            {{ saveLoading ? '保存中...' : '保存为草稿 App' }}
          </button>
        </div>

        <div v-if="result" class="space-y-4">
          <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-center">
            <div>
              <div class="text-xl font-semibold">{{ result.appName || policyForm.appName || '未命名应用' }}</div>
              <div class="mt-1 text-sm text-slate">来源：{{ result.sourceType === 'apk' ? 'APK 轻量分析' : '隐私政策分析' }}</div>
            </div>
            <RiskBadge v-if="normalized" :level="normalized.riskLevel" />
          </div>

          <div v-if="normalized" class="grid gap-4 xl:grid-cols-2">
            <div class="rounded-sm border border-charcoal p-4">
              <div class="label-overline">One-liner</div>
              <p class="mt-2 text-parchment">{{ normalized.oneLiner }}</p>
            </div>
            <div class="rounded-sm border border-charcoal p-4">
              <div class="label-overline">Summary</div>
              <p class="mt-2 text-parchment">{{ normalized.plainSummary }}</p>
            </div>
          </div>

          <div v-if="normalized?.keyFindings?.length" class="rounded-sm border border-charcoal p-4">
            <div class="label-overline">Key Findings</div>
            <ul class="mt-2 space-y-2 text-sm text-parchment">
              <li v-for="(item, index) in normalized.keyFindings" :key="index">• {{ item }}</li>
            </ul>
          </div>

          <div v-if="result.apkMeta" class="rounded-sm border border-charcoal p-4 text-sm">
            <div class="label-overline">APK Meta</div>
            <div class="mt-2 grid gap-2 md:grid-cols-2 text-parchment">
              <div>包名：{{ result.apkMeta.packageName || '-' }}</div>
              <div>版本：{{ result.apkMeta.versionName || '-' }}</div>
              <div>总权限数：{{ result.apkMeta.permissionCount || 0 }}</div>
              <div>敏感权限数：{{ result.apkMeta.sensitivePermissionCount || 0 }}</div>
            </div>
          </div>

          <details class="rounded-sm border border-charcoal p-4">
            <summary class="cursor-pointer text-sm text-snow">查看原始 JSON</summary>
            <pre class="mt-3 max-h-[420px] overflow-auto rounded-sm bg-abyss p-3 text-xs text-parchment">{{ resultJson }}</pre>
          </details>
        </div>

        <div v-else class="rounded-sm border border-charcoal p-6 text-sm text-slate">
          等待分析结果...
        </div>
      </section>
    </div>
  </AdminLayout>
</template>
