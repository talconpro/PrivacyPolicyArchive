<script setup lang="ts">
definePageMeta({ layout: false })

const form = reactive({ username: '', password: '' })
const pending = ref(false)
const errorMessage = ref('')

function parseError(error: any) {
  return error?.data?.message || error?.data?.statusMessage || '登录失败'
}

async function submit() {
  pending.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: form })
    await navigateTo('/admin')
  } catch (error: any) {
    errorMessage.value = parseError(error)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-abyss">
    <div class="container-shell flex min-h-screen items-center justify-center py-10">
      <div class="panel-accent w-full max-w-md p-8">
        <div class="label-overline">Admin Access</div>
        <h1 class="mt-2 text-4xl leading-none tracking-[-0.04em]">管理员登录</h1>
        <p class="mt-3 text-sm text-parchment">使用后台账号密码登录。</p>
        <div class="mt-6 space-y-4">
          <input v-model="form.username" class="input-base" placeholder="用户名" />
          <input v-model="form.password" type="password" class="input-base" placeholder="密码" @keyup.enter="submit" />
          <button class="btn-primary w-full" :disabled="pending" @click="submit">{{ pending ? '登录中...' : '登录' }}</button>
        </div>
        <p v-if="errorMessage" class="mt-4 text-sm text-danger">{{ errorMessage }}</p>
      </div>
    </div>
  </div>
</template>
