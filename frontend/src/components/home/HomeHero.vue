<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import RiskBadge from '@/components/ui/RiskBadge.vue'

const q = ref('')
const router = useRouter()

const submit = () => {
  router.push(q.value ? `/browse?q=${encodeURIComponent(q.value)}` : '/browse')
}
</script>

<template>
  <section class="grid gap-6 py-8 lg:grid-cols-[1.2fr,.8fr] lg:py-6">
    <div class="flex h-full flex-col items-start justify-between">
      <div class="label-overline">Zero-friction privacy lookup</div>

      <div class="py-6">
        <h1 class="max-w-4xl whitespace-nowrap text-[29px] font-normal leading-none tracking-[-0.03em] md:text-5xl">
          几秒看懂 App 的 <span class="text-signal">隐私保护政策</span>
        </h1>
        <p class="mt-5 max-w-2xl text-base leading-7 text-parchment">
          对隐私协议进行结构化提炼与摘要呈现，帮助用户高效理解关键条款内容。
        </p>
      </div>

      <div class="flex w-full max-w-2xl gap-3">
        <input v-model="q" class="input-base w-full flex-1" placeholder="搜索微信、抖音、支付宝..." @keyup.enter="submit">
        <button class="btn-primary shrink-0" @click="submit">搜索</button>
      </div>
    </div>

    <div class="panel-accent flex h-full flex-col justify-between p-5">
      <div class="label-overline">Sample analysis</div>
      <div class="mt-4 flex items-center justify-between">
        <div>
          <div class="text-xl font-semibold">示例 App</div>
          <div class="text-sm text-slate">社交 · 某科技公司</div>
        </div>
        <RiskBadge level="high" />
      </div>
      <p class="mt-4 text-sm text-parchment">收集设备标识符与位置数据，并保留较宽泛的第三方共享空间。</p>
      <ul class="mt-4 space-y-2 text-sm text-snow">
        <li>• 收集手机号、设备标识、位置、联系人等信息</li>
        <li>• 对外共享条件描述较宽泛</li>
        <li>• 用户删除与导出权利说明不够清晰</li>
      </ul>
    </div>
  </section>
</template>
