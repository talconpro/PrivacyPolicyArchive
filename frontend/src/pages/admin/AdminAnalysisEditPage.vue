<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api, getApiErrorMessage } from '@/api/client'
import AdminLayout from '@/components/admin/AdminLayout.vue'

const route = useRoute()
const appName = ref('')
const form = ref<any>(null)
const message = ref('')
const loading = ref(false)

const load = async () => {
  loading.value = true
  try {
    const res = await api.get(`/admin/analyses/${route.params.id}`)
    appName.value = res.data.app?.name || ''
    form.value = res.data.app.analysis || {
      risk_level: 'medium',
      one_liner: '',
      key_findings: [''],
      plain_summary: '',
      data_collected: [''],
      data_shared_with: [''],
      user_rights: [''],
      dispute: ''
    }
  } catch (e) {
    message.value = getApiErrorMessage(e)
  } finally {
    loading.value = false
  }
}

const normalizeList = (values: string[]) => values.map((item) => item.trim()).filter(Boolean)

const containsDeterministicLegalTerms = () => {
  const text = [
    form.value.one_liner,
    form.value.plain_summary,
    form.value.dispute,
    ...(form.value.key_findings || []),
    ...(form.value.data_collected || []),
    ...(form.value.data_shared_with || []),
    ...(form.value.user_rights || [])
  ].join(' ')
  return text.includes('违法') || text.includes('非法')
}

const save = async () => {
  try {
    if (containsDeterministicLegalTerms()) {
      message.value = '请避免使用“违法/非法”等确定性法律判断，建议改为“可能涉及/条款中提及”等中性表述。'
      return
    }

    const payload = {
      ...form.value,
      key_findings: normalizeList(form.value.key_findings || []),
      data_collected: normalizeList(form.value.data_collected || []),
      data_shared_with: normalizeList(form.value.data_shared_with || []),
      user_rights: normalizeList(form.value.user_rights || [])
    }
    await api.patch(`/admin/analyses/${route.params.id}`, payload)
    message.value = 'Saved'
  } catch (e) {
    message.value = getApiErrorMessage(e)
  }
}

const restore = async () => {
  if (!window.confirm('Restore AI draft?')) return
  try {
    await api.post(`/admin/analyses/${route.params.id}/restore`)
    message.value = 'Restored'
    await load()
  } catch (e) {
    message.value = getApiErrorMessage(e)
  }
}

onMounted(load)
</script>

<template>
  <AdminLayout>
    <div v-if="loading" class="panel p-6 text-sm text-slate">Loading analysis details...</div>

    <div v-else-if="form" class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div class="label-overline">Analysis Detail</div>
          <h1 class="text-3xl">{{ appName }} Analysis Editor</h1>
        </div>
        <div class="flex gap-2">
          <button class="btn-ghost" @click="restore">Restore AI Draft</button>
          <button class="btn-primary" @click="save">Save</button>
        </div>
      </div>

      <div class="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <div class="panel space-y-4 p-5">
          <div class="grid gap-4 md:grid-cols-2">
            <select v-model="form.risk_level" class="select-base">
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
            <input v-model="form.one_liner" class="input-base" placeholder="one-liner" />
          </div>

          <textarea v-model="form.plain_summary" class="textarea-base" placeholder="plain summary" />
          <textarea v-model="form.dispute" class="textarea-base" placeholder="dispute" />

          <div>
            <div class="mb-2 font-medium">Key Findings</div>
            <div class="space-y-2">
              <div v-for="(_, index) in form.key_findings" :key="index" class="flex gap-2">
                <input v-model="form.key_findings[index]" class="input-base" :placeholder="`Key finding ${Number(index) + 1}`" />
                <button class="btn-danger" @click="form.key_findings.splice(index, 1)">Delete</button>
              </div>
              <button class="btn-ghost" @click="form.key_findings.push('')">Add</button>
            </div>
          </div>
        </div>

        <div class="space-y-6">
          <div class="panel p-5">
            <div class="mb-2 font-medium">Data Collected</div>
            <div class="space-y-2">
              <input v-for="(_, index) in form.data_collected" :key="`col-${index}`" v-model="form.data_collected[index]" class="input-base" />
              <button class="btn-ghost" @click="form.data_collected.push('')">Add</button>
            </div>
          </div>

          <div class="panel p-5">
            <div class="mb-2 font-medium">Data Shared With</div>
            <div class="space-y-2">
              <input v-for="(_, index) in form.data_shared_with" :key="`share-${index}`" v-model="form.data_shared_with[index]" class="input-base" />
              <button class="btn-ghost" @click="form.data_shared_with.push('')">Add</button>
            </div>
          </div>

          <div class="panel p-5">
            <div class="mb-2 font-medium">User Rights</div>
            <div class="space-y-2">
              <input v-for="(_, index) in form.user_rights" :key="`right-${index}`" v-model="form.user_rights[index]" class="input-base" />
              <button class="btn-ghost" @click="form.user_rights.push('')">Add</button>
            </div>
          </div>
        </div>
      </div>

      <p v-if="message" class="text-sm text-parchment">{{ message }}</p>
    </div>
  </AdminLayout>
</template>
