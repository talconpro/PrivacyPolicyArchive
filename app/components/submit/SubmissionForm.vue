<script setup lang="ts">
const form = reactive({ appName: '', privacyUrl: '', termsUrl: '', remark: '', submitterEmail: '', captchaToken: '' })
const pending = ref(false)
const result = ref<string>('')
async function submit() {
  pending.value = true
  result.value = ''
  try {
    await $fetch('/api/submissions', { method: 'POST', body: form })
    result.value = '提交成功，系统会自动抓取、分析，并进入待审核队列。'
    Object.assign(form, { appName: '', privacyUrl: '', termsUrl: '', remark: '', submitterEmail: '', captchaToken: '' })
  } catch (error: any) {
    result.value = error?.data?.statusMessage || '提交失败'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="panel p-6">
    <div class="mb-6 text-2xl font-semibold">提交未收录 App</div>
    <div class="grid gap-4 md:grid-cols-2">
      <input v-model="form.appName" class="input-base" placeholder="App 名称 *">
      <input v-model="form.submitterEmail" class="input-base" placeholder="邮箱（可选）">
      <input v-model="form.privacyUrl" class="input-base md:col-span-2" placeholder="隐私政策链接 *">
      <input v-model="form.termsUrl" class="input-base md:col-span-2" placeholder="用户协议链接（可选）">
      <textarea v-model="form.remark" class="textarea-base md:col-span-2" placeholder="备注（可选）" />
      <input v-model="form.captchaToken" class="input-base md:col-span-2" placeholder="预留验证码 token（接入 Turnstile 时使用）">
    </div>
    <div class="mt-5 flex items-center gap-4">
      <button class="btn-primary" :disabled="pending" @click="submit">{{ pending ? '提交中...' : '提交' }}</button>
      <span class="text-sm text-slate">提交后会进入自动抓取与 AI 分析流程。</span>
    </div>
    <p v-if="result" class="mt-4 text-sm text-mint">{{ result }}</p>
  </div>
</template>
