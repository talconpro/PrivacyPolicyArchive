<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api, getApiErrorMessage } from '@/api/client'
import AdminLayout from '@/components/admin/AdminLayout.vue'

const route = useRoute()
const appData = ref<any>(null)
const form = ref<any>(null)
const message = ref('')
const loading = ref(false)
const busy = ref(false)

const load = async () => {
  loading.value = true
  message.value = ''
  try {
    const res = await api.get(`/admin/apps/${route.params.id}`)
    appData.value = res.data.app
    form.value = {
      name: appData.value.name || '',
      slug: appData.value.slug || '',
      category: appData.value.category || '',
      developer: appData.value.developer || '',
      iconUrl: appData.value.iconUrl || '',
      privacyPolicyUrl: appData.value.privacyPolicyUrl || '',
      termsOfServiceUrl: appData.value.termsOfServiceUrl || '',
      riskLevel: appData.value.riskLevel || 'medium',
      oneLiner: appData.value.oneLiner || '',
      plainSummary: appData.value.plainSummary || '',
      reviewNotes: appData.value.reviewNotes || '',
      featured: !!appData.value.featured,
      warningPinned: !!appData.value.warningPinned,
      status: appData.value.status || 'draft',
      isPublished: !!appData.value.isPublished
    }
  } catch (e) {
    appData.value = null
    form.value = null
    message.value = `加载失败：${getApiErrorMessage(e)}`
  } finally {
    loading.value = false
  }
}

const save = async () => {
  if (!form.value) return
  try {
    busy.value = true
    await api.patch(`/admin/apps/${route.params.id}`, form.value)
    message.value = '保存成功'
    await load()
  } catch (e) {
    message.value = getApiErrorMessage(e)
  } finally {
    busy.value = false
  }
}

const publish = async () => {
  if (!window.confirm('确认发布该应用吗？')) return
  try {
    busy.value = true
    await api.post(`/admin/apps/${route.params.id}/publish`)
    message.value = '发布成功'
    await load()
  } catch (e) {
    message.value = getApiErrorMessage(e)
  } finally {
    busy.value = false
  }
}

const reanalyze = async () => {
  if (!window.confirm('确认重新分析该应用吗？')) return
  try {
    busy.value = true
    await api.post(`/admin/apps/${route.params.id}/reanalyze`)
    message.value = '重分析完成'
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
    <div v-if="loading" class="panel p-6 text-sm text-slate">正在加载应用详情...</div>

    <div v-else-if="form" class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div class="label-overline">App Editing</div>
          <h1 class="text-3xl">{{ form.name || '应用编辑' }}</h1>
          <div class="mt-2 text-sm text-slate">状态：{{ form.status }} · 更新时间：{{ appData?.updatedAt }}</div>
        </div>
        <div class="flex gap-2">
          <button class="btn-ghost" :disabled="busy" @click="reanalyze">重新分析</button>
          <button class="btn-primary" :disabled="busy" @click="publish">发布应用</button>
        </div>
      </div>

      <p v-if="message" class="text-sm text-parchment">{{ message }}</p>

      <div class="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <div class="panel space-y-4 p-5">
          <h2 class="text-2xl">基本信息</h2>
          <div class="grid gap-3 md:grid-cols-2">
            <input v-model="form.name" class="input-base" placeholder="应用名称" />
            <input v-model="form.slug" class="input-base" placeholder="slug" />
            <input v-model="form.category" class="input-base" placeholder="分类" />
            <input v-model="form.developer" class="input-base" placeholder="开发商" />
            <input v-model="form.iconUrl" class="input-base md:col-span-2" placeholder="图标 URL" />
            <input v-model="form.privacyPolicyUrl" class="input-base md:col-span-2" placeholder="隐私政策 URL" />
            <input v-model="form.termsOfServiceUrl" class="input-base md:col-span-2" placeholder="服务条款 URL" />
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <select v-model="form.riskLevel" class="select-base">
              <option value="low">低风险</option>
              <option value="medium">中风险</option>
              <option value="high">高风险</option>
              <option value="critical">严重</option>
            </select>
            <select v-model="form.status" class="select-base">
              <option value="draft">草稿</option>
              <option value="review_ready">待审核</option>
              <option value="published">已发布</option>
              <option value="archived">已归档</option>
            </select>
          </div>

          <input v-model="form.oneLiner" class="input-base" placeholder="一句话结论" />
          <textarea v-model="form.plainSummary" class="textarea-base" placeholder="白话摘要" />
          <textarea v-model="form.reviewNotes" class="textarea-base" placeholder="审核备注" />

          <div class="grid gap-4 md:grid-cols-3 text-sm text-parchment">
            <label class="inline-flex items-center gap-2"><input v-model="form.featured" type="checkbox" /> 设为推荐</label>
            <label class="inline-flex items-center gap-2"><input v-model="form.warningPinned" type="checkbox" /> 置顶风险提示</label>
            <label class="inline-flex items-center gap-2"><input v-model="form.isPublished" type="checkbox" /> 已发布</label>
          </div>

          <button class="btn-primary" :disabled="busy" @click="save">保存修改</button>
        </div>

        <div class="space-y-6">
          <div class="panel p-5">
            <h2 class="text-2xl">版本记录</h2>
            <div class="mt-4 space-y-3">
              <div v-for="version in appData?.versions || []" :key="version.id" class="rounded-sm border border-charcoal p-3">
                <div class="font-medium">{{ version.versionLabel || '未命名版本' }}</div>
                <div class="text-xs text-slate">{{ version.createdAtLabel }}</div>
              </div>
              <div v-if="!(appData?.versions || []).length" class="text-sm text-slate">暂无版本记录</div>
            </div>
          </div>

          <div class="panel p-5">
            <h2 class="text-2xl">操作日志</h2>
            <div class="mt-4 space-y-3">
              <div v-for="log in appData?.logs || []" :key="log.id" class="rounded-sm border border-charcoal p-3">
                <div class="font-medium">{{ log.action }}</div>
                <div class="text-xs text-slate">{{ log.actor }} · {{ log.createdAtLabel }}</div>
              </div>
              <div v-if="!(appData?.logs || []).length" class="text-sm text-slate">暂无操作日志</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="panel p-6 text-sm text-danger">页面未获取到应用数据，请返回列表重试。</div>
  </AdminLayout>
</template>
