<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const route = useRoute()
const saving = ref(false)
const publishing = ref(false)
const reanalyzing = ref(false)
const notice = ref('')
const noticeType = ref<'success' | 'error'>('success')

const { data, refresh, pending, error } = await useAsyncData(
  `admin-app-${route.params.id}`,
  () => $fetch(`/api/admin/apps/${route.params.id}`)
)

const form = reactive({
  name: '',
  slug: '',
  category: '',
  developer: '',
  iconUrl: '',
  privacyPolicyUrl: '',
  termsOfServiceUrl: '',
  riskLevel: 'medium',
  oneLiner: '',
  plainSummary: '',
  reviewNotes: '',
  featured: false,
  warningPinned: false,
  status: 'draft',
  isPublished: false
})

watchEffect(() => {
  const app = data.value?.app
  if (!app) return
  Object.assign(form, {
    name: app.name || '',
    slug: app.slug || '',
    category: app.category || '',
    developer: app.developer || '',
    iconUrl: app.iconUrl || '',
    privacyPolicyUrl: app.privacyPolicyUrl || '',
    termsOfServiceUrl: app.termsOfServiceUrl || '',
    riskLevel: app.riskLevel || 'medium',
    oneLiner: app.oneLiner || '',
    plainSummary: app.plainSummary || '',
    reviewNotes: app.reviewNotes || '',
    featured: !!app.featured,
    warningPinned: !!app.warningPinned,
    status: app.status || 'draft',
    isPublished: !!app.isPublished
  })
})

function setSuccess(message: string) {
  noticeType.value = 'success'
  notice.value = message
}

function setError(message: string) {
  noticeType.value = 'error'
  notice.value = message
}

function parseError(errorLike: any) {
  return errorLike?.data?.message || errorLike?.data?.statusMessage || '操作失败，请稍后重试'
}

function buildPayload() {
  return {
    ...form,
    name: form.name.trim(),
    slug: form.slug.trim(),
    category: form.category.trim(),
    developer: form.developer.trim(),
    iconUrl: form.iconUrl.trim(),
    privacyPolicyUrl: form.privacyPolicyUrl.trim(),
    termsOfServiceUrl: form.termsOfServiceUrl.trim(),
    oneLiner: form.oneLiner.trim(),
    plainSummary: form.plainSummary.trim(),
    reviewNotes: form.reviewNotes.trim()
  }
}

async function save() {
  if (saving.value || publishing.value || reanalyzing.value) return
  saving.value = true
  notice.value = ''
  try {
    await $fetch(`/api/admin/apps/${route.params.id}`, {
      method: 'PATCH',
      body: buildPayload()
    })
    await refresh()
    setSuccess('保存成功')
  } catch (err: any) {
    setError(parseError(err))
  } finally {
    saving.value = false
  }
}

async function publish() {
  if (saving.value || publishing.value || reanalyzing.value) return
  if (!window.confirm('确认发布该应用吗？')) return

  publishing.value = true
  notice.value = ''
  try {
    await $fetch(`/api/admin/apps/${route.params.id}/publish`, { method: 'POST' })
    await refresh()
    setSuccess('发布成功')
  } catch (err: any) {
    setError(parseError(err))
  } finally {
    publishing.value = false
  }
}

async function reanalyze() {
  if (saving.value || publishing.value || reanalyzing.value) return
  if (!window.confirm('确认重新分析该应用吗？')) return

  reanalyzing.value = true
  notice.value = ''
  try {
    await $fetch(`/api/admin/apps/${route.params.id}/reanalyze`, { method: 'POST' })
    await refresh()
    setSuccess('重分析已完成')
  } catch (err: any) {
    setError(parseError(err))
  } finally {
    reanalyzing.value = false
  }
}
</script>

<template>
  <NuxtErrorBoundary>
    <template #error="{ error: renderError, clearError }">
      <div class="panel p-6 text-sm text-danger space-y-3">
        <div>页面渲染失败：{{ (renderError as any)?.message || '未知错误' }}</div>
        <button class="btn-ghost" @click="clearError()">重试渲染</button>
      </div>
    </template>

    <div v-if="pending" class="panel p-6 text-sm text-slate">正在加载应用详情...</div>

    <div v-else-if="error" class="panel p-6 text-sm text-danger">
      加载失败：{{ (error as any)?.data?.message || (error as any)?.message || '请刷新重试' }}
    </div>

    <div v-else-if="data?.app" class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div class="label-overline">应用编辑</div>
          <h1 class="text-3xl">{{ data.app.name }}</h1>
          <div class="mt-2 text-sm text-slate">状态：{{ data.app.status }} · 更新时间：{{ data.app.updatedAt }}</div>
        </div>
        <div class="flex flex-wrap gap-3">
          <button class="btn-ghost" :disabled="saving || publishing || reanalyzing || pending" @click="reanalyze">{{ reanalyzing ? '重分析中...' : '重新分析' }}</button>
          <button class="btn-primary" :disabled="saving || publishing || reanalyzing || pending" @click="publish">{{ publishing ? '发布中...' : '发布应用' }}</button>
        </div>
      </div>

      <div v-if="notice" class="panel p-4 text-sm" :class="noticeType === 'error' ? 'text-danger' : 'text-mint'">
        {{ notice }}
      </div>

      <div class="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <div class="panel p-5 space-y-4">
          <h2 class="text-2xl">基本信息</h2>

          <div class="grid gap-4 md:grid-cols-2">
            <input v-model="form.name" class="input-base" placeholder="应用名称" />
            <input v-model="form.slug" class="input-base" placeholder="slug" />
            <input v-model="form.category" class="input-base" placeholder="分类" />
            <input v-model="form.developer" class="input-base" placeholder="开发者" />
            <input v-model="form.iconUrl" class="input-base md:col-span-2" placeholder="图标 URL" />
            <input v-model="form.privacyPolicyUrl" class="input-base md:col-span-2" placeholder="隐私政策 URL" />
            <input v-model="form.termsOfServiceUrl" class="input-base md:col-span-2" placeholder="服务条款 URL" />
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <select v-model="form.riskLevel" class="select-base">
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
            <select v-model="form.status" class="select-base">
              <option value="draft">draft</option>
              <option value="review_ready">review_ready</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
          </div>

          <input v-model="form.oneLiner" class="input-base" placeholder="一句话结论" />
          <textarea v-model="form.plainSummary" class="textarea-base" placeholder="通俗摘要"></textarea>
          <textarea v-model="form.reviewNotes" class="textarea-base" placeholder="审核备注"></textarea>

          <div class="grid gap-4 md:grid-cols-3">
            <label class="flex items-center gap-2 text-sm"><input v-model="form.featured" type="checkbox" /> 设为推荐</label>
            <label class="flex items-center gap-2 text-sm"><input v-model="form.warningPinned" type="checkbox" /> 置顶风险提示</label>
            <label class="flex items-center gap-2 text-sm"><input v-model="form.isPublished" type="checkbox" /> 已发布</label>
          </div>

          <div class="flex items-center gap-4">
            <button class="btn-primary" :disabled="saving || publishing || reanalyzing || pending" @click="save">{{ saving ? '保存中...' : '保存修改' }}</button>
          </div>
        </div>

        <div class="space-y-6">
          <div class="panel p-5">
            <h2 class="text-2xl">版本记录</h2>
            <div class="mt-4 space-y-3">
              <div v-for="version in data.app.versions" :key="version.id" class="rounded-sm border border-charcoal p-3">
                <div class="font-medium">{{ version.versionLabel || '未命名版本' }}</div>
                <div class="text-xs text-slate">{{ version.createdAtLabel }}</div>
              </div>
            </div>
          </div>

          <div class="panel p-5">
            <h2 class="text-2xl">操作日志</h2>
            <div class="mt-4 space-y-3">
              <div v-for="log in data.app.logs" :key="log.id" class="rounded-sm border border-charcoal p-3">
                <div class="font-medium">{{ log.action }}</div>
                <div class="text-xs text-slate">{{ log.actor }} · {{ log.createdAtLabel }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="panel p-6 text-sm text-danger">页面未获取到应用数据，请返回列表重试。</div>
  </NuxtErrorBoundary>
</template>
