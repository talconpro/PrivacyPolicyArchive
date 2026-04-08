<script setup lang="ts">
const q = ref('')
const router = useRouter()
const submit = () => router.push(q.value ? `/browse?q=${encodeURIComponent(q.value)}` : '/browse')
</script>

<template>
  <section class="grid gap-6 py-8 lg:grid-cols-[1.2fr,.8fr] lg:py-6">
    <div class="flex h-full flex-col items-start justify-between">
      <div class="label-overline">Zero-friction privacy lookup</div>

      <div class="py-6">
        <h1 class="max-w-4xl whitespace-nowrap text-3xl font-normal leading-none tracking-[-0.03em] md:text-5xl">
          几秒看懂 App 的 <span class="text-signal">隐私风险</span>
        </h1>
        <p class="mt-5 max-w-2xl text-base leading-7 text-parchment">
          把冗长协议压缩成一句话结论、关键发现和风险评级，帮助用户在下载前快速判断值不值得装。
        </p>
      </div>

      <div class="flex w-full max-w-2xl gap-3">
        <input v-model="q" class="input-base w-full flex-1" placeholder="搜索微信、抖音、支付宝..." @keyup.enter="submit">
        <button class="btn-primary shrink-0" @click="submit">搜索</button>
      </div>
    </div>

    <div class="panel-accent h-full p-5">
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
