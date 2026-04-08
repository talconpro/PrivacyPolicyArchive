<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
const route = useRoute()
const adminNote = ref('')
const notice = ref('')
const busy = ref(false)
const { data, refresh } = await useAsyncData(`admin-submission-${route.params.id}`, () => $fetch(`/api/admin/submissions/${route.params.id}`))
watchEffect(() => { adminNote.value = data.value?.submission?.adminNote || '' })
function parseError(error:any){ return error?.data?.message || error?.data?.statusMessage || '操作失败' }
async function run(action:'process'|'approve'|'reject'|'send_back') {
  busy.value = true
  notice.value = ''
  if (action === 'approve' && !window.confirm('确认通过并发布该提交对应 App？')) { busy.value = false; return }
  if (action === 'reject' && !window.confirm('确认拒绝该提交？')) { busy.value = false; return }
  if (action === 'send_back' && !adminNote.value.trim()) { notice.value = '退回补充信息时，备注不能为空'; busy.value = false; return }
  try {
    if (action === 'send_back') {
      await $fetch(`/api/admin/submissions/${route.params.id}/send-back`, { method: 'POST', body: { adminNote: adminNote.value } })
    } else {
      await $fetch(`/api/admin/submissions/${route.params.id}/${action}`, { method: 'POST', body: { adminNote: adminNote.value } })
    }
    notice.value = '操作成功'
    await refresh()
  } catch (error:any) {
    notice.value = parseError(error)
  } finally { busy.value = false }
}
</script>
<template>
  <div v-if="data?.submission" class="space-y-6">
    <div><div class="label-overline">Submission detail</div><h1 class="text-3xl">{{ data.submission.appName }}</h1><div class="mt-2 text-sm text-slate">{{ data.submission.status }} · {{ data.submission.createdAtLabel }}</div></div>
    <div class="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
      <div class="panel p-5 space-y-4">
        <div><div class="text-sm text-slate">隐私政策</div><a :href="data.submission.privacyUrl" target="_blank" class="text-signal">{{ data.submission.privacyUrl }}</a></div>
        <div v-if="data.submission.termsUrl"><div class="text-sm text-slate">用户协议</div><a :href="data.submission.termsUrl" target="_blank" class="text-signal">{{ data.submission.termsUrl }}</a></div>
        <div><div class="text-sm text-slate">处理状态</div><div class="mt-1 text-parchment">抓取 {{ data.submission.fetchStatus }} · 分析 {{ data.submission.analysisStatus }}</div></div>
        <div><div class="text-sm text-slate">审核备注</div><textarea v-model="adminNote" class="textarea-base mt-2" placeholder="填写审核结论或退回原因"></textarea></div>
        <div class="flex flex-wrap gap-3"><button class="btn-ghost" :disabled="busy || data.submission.status === 'processing'" @click="run('process')">处理</button><button class="btn-primary" :disabled="busy" @click="run('approve')">通过并发布</button><button class="btn-danger" :disabled="busy" @click="run('reject')">拒绝</button><button class="btn-ghost" :disabled="busy" @click="run('send_back')">退回补充</button></div>
        <p v-if="notice" class="text-sm" :class="notice.includes('失败') ? 'text-danger' : 'text-mint'">{{ notice }}</p>
      </div>
      <div class="space-y-6">
        <div v-if="data.linkedApp" class="panel p-5"><h2 class="text-2xl">关联 App</h2><div class="mt-3 text-parchment">{{ data.linkedApp.name }} · {{ data.linkedApp.status }}</div><NuxtLink :to="`/admin/apps/${data.linkedApp.id}`" class="mt-4 inline-flex text-signal">进入 App 编辑</NuxtLink></div>
        <div v-if="data.submission.analysisDraft" class="panel p-5"><h2 class="text-2xl">自动分析草稿</h2><pre class="mt-3 overflow-x-auto rounded-sm border border-charcoal bg-abyss p-4 text-xs text-parchment">{{ JSON.stringify(data.submission.analysisDraft, null, 2) }}</pre></div>
        <div v-if="data.submission.extractedText" class="panel p-5"><h2 class="text-2xl">抓取文本预览</h2><pre class="mt-3 max-h-[24rem] overflow-auto rounded-sm border border-charcoal bg-abyss p-4 text-xs text-parchment whitespace-pre-wrap">{{ data.submission.extractedText }}</pre></div>
      </div>
    </div>
  </div>
</template>
