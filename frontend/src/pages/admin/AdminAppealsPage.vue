<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, getApiErrorMessage } from '@/api/client'
import AdminLayout from '@/components/admin/AdminLayout.vue'

const q = ref('')
const status = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const items = ref<any[]>([])
const loading = ref(false)
const message = ref('')

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const load = async () => {
  loading.value = true
  message.value = ''
  try {
    const res = await api.get('/admin/appeals', {
      params: {
        q: q.value,
        status: status.value,
        page: page.value,
        pageSize: pageSize.value,
      },
    })
    items.value = res.data.items || []
    total.value = Number(res.data.total || 0)
  } catch (error) {
    message.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

const saveRow = async (row: any) => {
  try {
    loading.value = true
    await api.patch(`/admin/appeals/${row.id}`, {
      status: row.status,
      adminNote: row.adminNote || '',
    })
    message.value = '申诉处理状态已更新'
    await load()
  } catch (error) {
    message.value = getApiErrorMessage(error)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <AdminLayout>
    <div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div class="label-overline">Appeal Tickets</div>
          <h1 class="text-3xl">开发者申诉</h1>
        </div>
      </div>

      <div class="panel space-y-4 p-4">
        <div class="grid gap-3 md:grid-cols-4">
          <input v-model="q" class="input-base" placeholder="搜索应用名 / 邮箱 / 描述关键词">
          <select v-model="status" class="select-base">
            <option value="">全部状态</option>
            <option value="pending">待处理</option>
            <option value="processing">处理中</option>
            <option value="resolved">已解决</option>
            <option value="rejected">已驳回</option>
          </select>
          <button class="btn-primary" :disabled="loading" @click="page=1; load()">查询</button>
          <button class="btn-ghost" :disabled="loading" @click="q=''; status=''; page=1; load()">重置</button>
        </div>
        <p v-if="message" class="text-sm text-parchment">{{ message }}</p>
      </div>

      <div class="panel overflow-x-auto p-4">
        <table class="table-shell min-w-[1200px]">
          <thead class="border-b border-charcoal">
            <tr>
              <th>应用</th>
              <th>问题类型</th>
              <th>说明</th>
              <th>证据</th>
              <th>联系邮箱</th>
              <th>状态</th>
              <th>管理员备注</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id" class="border-b border-charcoal/50 last:border-none">
              <td class="max-w-[160px]">
                <div class="font-medium">{{ item.appName }}</div>
                <a v-if="item.pageUrl" :href="item.pageUrl" target="_blank" class="text-xs text-signal hover:underline">
                  页面链接
                </a>
                <div class="mt-1">
                  <router-link :to="`/admin/appeals/${item.id}`" class="text-xs text-signal hover:underline">
                    查看详情
                  </router-link>
                </div>
              </td>
              <td class="text-xs">{{ item.issueType }}</td>
              <td class="max-w-[320px] text-xs text-parchment">{{ item.description }}</td>
              <td class="max-w-[260px] text-xs">
                <div class="space-y-1">
                  <a
                    v-for="(url, idx) in (item.evidenceUrls || [])"
                    :key="idx"
                    :href="url"
                    target="_blank"
                    class="block truncate text-signal hover:underline"
                  >
                    {{ url }}
                  </a>
                  <span v-if="!(item.evidenceUrls || []).length" class="text-slate">-</span>
                </div>
              </td>
              <td class="text-xs">{{ item.contactEmail }}</td>
              <td>
                <select v-model="item.status" class="select-base min-w-[130px]">
                  <option value="pending">待处理</option>
                  <option value="processing">处理中</option>
                  <option value="resolved">已解决</option>
                  <option value="rejected">已驳回</option>
                </select>
              </td>
              <td class="max-w-[220px]">
                <textarea v-model="item.adminNote" class="textarea-base min-h-[80px] text-xs" />
              </td>
              <td class="text-xs text-slate">{{ item.createdAtLabel }}</td>
              <td>
                <div class="flex flex-col gap-2">
                  <button class="btn-primary" :disabled="loading" @click="saveRow(item)">保存</button>
                  <router-link :to="`/admin/appeals/${item.id}`" class="btn-ghost text-center">详情</router-link>
                </div>
              </td>
            </tr>
            <tr v-if="items.length === 0">
              <td colspan="9" class="py-8 text-center text-sm text-slate">
                暂无申诉记录
              </td>
            </tr>
          </tbody>
        </table>

        <div class="mt-4 flex items-center justify-between text-sm text-slate">
          <span>第 {{ page }} / {{ totalPages }} 页 · 共 {{ total }} 条</span>
          <div class="flex gap-2">
            <button class="btn-ghost" :disabled="loading || page <= 1" @click="page--; load()">上一页</button>
            <button class="btn-ghost" :disabled="loading || page >= totalPages" @click="page++; load()">下一页</button>
          </div>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>
