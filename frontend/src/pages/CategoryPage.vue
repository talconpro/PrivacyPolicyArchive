<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/api/client'
import AppCard from '@/components/app/AppCard.vue'

const route = useRoute()
const data = ref<any>({ items: [] })

onMounted(async () => {
  const res = await api.get('/search', { params: { category: route.params.category } })
  data.value = res.data
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <div class="label-overline">Category</div>
      <h1 class="text-4xl leading-none tracking-[-0.04em]">{{ route.params.category }}</h1>
    </div>
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <AppCard v-for="app in data.items || []" :key="app.id" :app="app" />
    </div>
  </div>
</template>
