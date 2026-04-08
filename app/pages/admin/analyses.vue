<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
const filters = reactive({ q: '', page: 1, pageSize: 20 })
const query = computed(() => ({ ...filters }))
const selectedIds = ref<string[]>([])
const notice = ref('')
const busy = ref(false)
const { data, refresh, pending } = await useAsyncData('admin-analyses', () => $fetch('/api/admin/analyses', { query: query.value }), { watch: [query] })
watch(() => [data.value?.page, data.value?.items?.length], () => { selectedIds.value = [] })
const allChecked = computed({ get(){const items=data.value?.items||[];return items.length>0&&items.every((item:any)=>selectedIds.value.includes(item.id))}, set(value:boolean){const items=data.value?.items||[];selectedIds.value=value?items.map((item:any)=>item.id):[]}})
function parseError(error:any){return error?.data?.message||error?.data?.statusMessage||'操作失败'}
async function runBulk(action:'restore_ai'|'recalculate_risk'){if(!selectedIds.value.length){notice.value='请先选择至少一条记录';return}const actionLabel=action==='restore_ai'?'恢复 AI 初稿':'重算风险';if(!window.confirm(`确认批量${actionLabel}，共 ${selectedIds.value.length} 条？`))return;busy.value=true;notice.value='';try{const result=await $fetch('/api/admin/analyses/bulk-action',{method:'POST',body:{ids:selectedIds.value,action}});notice.value=`批量完成：成功 ${result.success}，失败 ${result.failed}`;await refresh()}catch(error:any){notice.value=parseError(error)}finally{busy.value=false}}
async function runOne(id:string, action:'restore_ai'|'recalculate_risk'){
  const actionLabel = action === 'restore_ai' ? '恢复 AI 初稿' : '重算风险'
  if(!window.confirm(`确认${actionLabel}？`)) return
  busy.value = true
  notice.value = ''
  try{
    if(action === 'restore_ai'){
      await $fetch(`/api/admin/analyses/${id}/restore`, { method: 'POST' })
    } else {
      await $fetch('/api/admin/analyses/bulk-action', { method: 'POST', body: { ids: [id], action: 'recalculate_risk' } })
    }
    notice.value = '操作成功'
    await refresh()
  }catch(error:any){
    notice.value = parseError(error)
  }finally{
    busy.value = false
  }
}
function goPage(page:number){if(page<1)return;const total=data.value?.total||0;const pageSize=data.value?.pageSize||filters.pageSize;const maxPage=Math.max(1,Math.ceil(total/pageSize));if(page>maxPage)return;filters.page=page}
</script>
<template><div class="space-y-6"><div class="flex flex-wrap items-end justify-between gap-4"><div><div class="label-overline">Analysis editor</div><h1 class="text-3xl">分析结果管理</h1></div><div class="flex flex-wrap gap-2"><button class="btn-ghost" :disabled="busy" @click="runBulk('restore_ai')">批量恢复 AI 初稿</button><button class="btn-primary" :disabled="busy" @click="runBulk('recalculate_risk')">批量重算风险</button></div></div><div class="panel p-4 space-y-3"><input v-model="filters.q" class="input-base" placeholder="搜索应用名称 / slug / 类别" /><p v-if="notice" class="text-sm" :class="notice.includes('失败') ? 'text-danger' : 'text-mint'">{{ notice }}</p></div><div class="panel overflow-x-auto p-4"><table class="table-shell min-w-[880px]"><thead class="border-b border-charcoal"><tr><th><input v-model="allChecked" type="checkbox" /></th><th>应用</th><th>风险</th><th>状态</th><th>分析时间</th><th>一句话总结</th><th>操作</th></tr></thead><tbody><tr v-if="pending"><td colspan="7" class="px-3 py-8 text-center text-slate">加载中...</td></tr><tr v-for="app in data?.items || []" :key="app.id" class="border-b border-charcoal last:border-none"><td><input v-model="selectedIds" type="checkbox" :value="app.id" /></td><td class="font-medium">{{ app.name }}</td><td><RiskBadge :level="app.riskLevel" /></td><td>{{ app.status }}</td><td>{{ app.analyzedAtLabel }}</td><td class="max-w-[320px] truncate">{{ app.oneLiner || '-' }}</td><td><div class="flex flex-wrap items-center gap-2"><NuxtLink :to="`/admin/analyses/${app.id}`" class="text-signal">编辑</NuxtLink><button class="btn-ghost" :disabled="busy" @click="runOne(app.id,'restore_ai')">恢复初稿</button><button class="btn-ghost" :disabled="busy" @click="runOne(app.id,'recalculate_risk')">重算风险</button></div></td></tr></tbody></table><div class="mt-4 flex items-center justify-between text-sm text-slate"><div>共 {{ data?.total || 0 }} 条</div><div class="flex items-center gap-2"><button class="btn-ghost" @click="goPage((data?.page || 1) - 1)">上一页</button><span>第 {{ data?.page || 1 }} 页</span><button class="btn-ghost" @click="goPage((data?.page || 1) + 1)">下一页</button></div></div></div></div></template>
