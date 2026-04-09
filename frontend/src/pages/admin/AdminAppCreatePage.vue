<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import { api, getApiErrorMessage } from '@/api/client'

const loading = ref(false)
const message = ref('')
const createdApp = ref<any>(null)

const sampleJson = {
  name: '示例应用',
  slug: 'sample-app',
  category: '工具',
  developer: '示例开发者',
  privacyPolicyUrl: 'https://example.com/privacy',
  termsOfServiceUrl: 'https://example.com/terms',
  rawText: '这里放隐私政策原文，可选。',
  analysis: {
    risk_level: 'medium',
    one_liner: '条款覆盖常见处理场景，建议核对敏感权限用途。',
    key_findings: ['列出数据收集类型', '说明第三方共享场景', '提供用户权利入口'],
    plain_summary: '这是一段白话摘要。',
    data_collected: ['设备信息', '账号信息'],
    data_shared_with: ['服务提供商'],
    user_rights: ['查询', '删除', '注销'],
    dispute: '争议处理以官方协议条款为准。',
  },
  status: 'draft',
  isPublished: false,
  sourceType: 'manual',
}

const jsonText = ref(JSON.stringify(sampleJson, null, 2))

const parsedPreview = computed(() => {
  try {
    return JSON.parse(jsonText.value)
  } catch {
    return null
  }
})

const fillTemplate = () => {
  jsonText.value = JSON.stringify(sampleJson, null, 2)
}

const submit = async () => {
  loading.value = true
  message.value = ''
  createdApp.value = null

  let payload: any
  try {
    payload = JSON.parse(jsonText.value)
  } catch {
    message.value = 'JSON 格式不正确，请检查后再提交。'
    loading.value = false
    return
  }

  try {
    const res = await api.post('/admin/apps/create-json', payload)
    createdApp.value = res.data?.app
    message.value = '新增 App 成功，已入库为可管理记录。'
  } catch (error) {
    message.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AdminLayout>
    <div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div class="label-overline">Create App</div>
          <h1 class="text-4xl leading-none tracking-[-0.04em]">新增 App</h1>
          <p class="mt-3 text-sm text-parchment">粘贴一份 JSON 即可创建 App（可选携带 analysis 与 rawText）。</p>
        </div>
        <button class="btn-ghost" @click="fillTemplate">填充示例 JSON</button>
      </div>

      <div class="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <section class="panel p-5">
          <div class="mb-3 text-lg font-semibold">JSON 输入</div>
          <textarea v-model="jsonText" class="textarea-base min-h-[460px] font-mono text-xs" />
          <div class="mt-4 flex gap-3">
            <button class="btn-primary" :disabled="loading" @click="submit">
              {{ loading ? '提交中...' : '提交入库' }}
            </button>
          </div>
        </section>

        <section class="space-y-4">
          <div class="panel p-5">
            <div class="text-lg font-semibold">JSON 要求</div>
            <ul class="mt-3 space-y-2 text-sm text-parchment">
              <li>• 必填：`name`</li>
              <li>• 建议：`slug`、`category`、`analysis`</li>
              <li>• 若带 `rawText`，会自动写入版本记录</li>
              <li>• 若不带 `analysis`，系统会按最低字段生成默认分析</li>
            </ul>
          </div>

          <div class="panel p-5">
            <div class="text-lg font-semibold">解析预览</div>
            <div class="mt-3 text-sm text-parchment" v-if="parsedPreview">
              <div>名称：{{ parsedPreview.name || '-' }}</div>
              <div>Slug：{{ parsedPreview.slug || '(自动生成)' }}</div>
              <div>状态：{{ parsedPreview.status || 'draft' }}</div>
            </div>
            <div class="mt-3 text-sm text-danger" v-else>当前 JSON 无法解析。</div>
          </div>

          <div v-if="message" class="panel p-4 text-sm" :class="createdApp ? 'text-mint border-signal/40' : 'text-danger border-danger/40'">
            {{ message }}
          </div>

          <div v-if="createdApp" class="panel p-5">
            <div class="text-lg font-semibold">创建结果</div>
            <div class="mt-3 space-y-1 text-sm text-parchment">
              <div>名称：{{ createdApp.name }}</div>
              <div>Slug：{{ createdApp.slug }}</div>
              <div>状态：{{ createdApp.status }}</div>
            </div>
            <RouterLink class="btn-ghost mt-4 inline-flex" :to="`/admin/apps/${createdApp.id}`">前往编辑页</RouterLink>
          </div>
        </section>
      </div>
    </div>
  </AdminLayout>
</template>
