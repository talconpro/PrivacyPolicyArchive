<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import SiteHeader from '@/components/SiteHeader.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import { loadSiteRuntimeSettings } from '@/composables/useSiteRuntimeSettings'

const route = useRoute()
const isAdmin = computed(() => route.path.startsWith('/admin'))

onMounted(() => {
  loadSiteRuntimeSettings()
})
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <SiteHeader v-if="!isAdmin" />

    <main class="flex-1" :class="isAdmin ? '' : 'page-shell py-8'">
      <router-view />
    </main>

    <SiteFooter v-if="!isAdmin" />
  </div>
</template>
