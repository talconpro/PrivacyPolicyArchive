<script setup lang="ts">
const route = useRoute()
const { data } = await useAsyncData(`category-${route.params.category}`, () => $fetch('/api/search', { query: { category: route.params.category } }))
</script>

<template>
  <div class="space-y-6">
    <div>
      <div class="label-overline">Category</div>
      <h1 class="text-4xl leading-none tracking-[-0.04em]">{{ route.params.category }}</h1>
    </div>
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <AppCard v-for="app in data?.items || []" :key="app.id" :app="app" />
    </div>
  </div>
</template>
