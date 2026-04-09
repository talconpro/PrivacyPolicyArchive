<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, getApiErrorMessage } from '@/api/client'

const router = useRouter()
const username = ref('admin')
const password = ref('')
const message = ref('')

const login = async () => {
  message.value = ''
  try {
    await api.post('/auth/login', { username: username.value, password: password.value })
    router.push('/admin')
  } catch (e) {
    message.value = getApiErrorMessage(e)
  }
}
</script>

<template>
  <div class="mx-auto max-w-md px-4 py-20">
    <div class="panel-accent space-y-3 p-6">
      <div class="label-overline">Admin</div>
      <h1 class="text-2xl font-bold">后台登录</h1>
      <input v-model="username" class="input-base" placeholder="管理员账号" />
      <input v-model="password" type="password" class="input-base" placeholder="密码" />
      <button class="btn-primary w-full" @click="login">登录</button>
      <p class="text-sm text-danger">{{ message }}</p>
    </div>
  </div>
</template>
