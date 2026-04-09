<script setup lang="ts">
defineProps<{
  open: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
}>()

const emit = defineEmits<{
  close: []
  confirm: []
}>()
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4" @click.self="emit('close')">
    <div class="panel w-full max-w-md p-5">
      <h3 class="text-lg font-semibold">{{ title }}</h3>
      <p v-if="description" class="mt-2 text-sm text-parchment">{{ description }}</p>
      <div class="mt-5 flex justify-end gap-2">
        <button class="btn-ghost" @click="emit('close')">{{ cancelText || '取消' }}</button>
        <button class="btn-danger" @click="emit('confirm')">{{ confirmText || '确认' }}</button>
      </div>
    </div>
  </div>
</template>
