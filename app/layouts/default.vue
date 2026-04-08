<template>
  <div class="min-h-screen flex flex-col">
    <SiteHeader />

    <main class="container-shell flex-1 py-8">
      <slot />
    </main>

    <footer class="mt-auto border-t border-charcoal/60 bg-carbon/40">
      <div class="container-shell space-y-1 py-4 text-xs text-slate">
        <div>
          免责声明：本网站提供的内容仅供参考，不构成法律、合规或专业意见。
          <NuxtLink to="/disclaimer" class="ml-2 text-signal hover:underline">查看完整声明</NuxtLink>
          <NuxtLink to="/appeal" class="ml-2 text-signal hover:underline">开发者申诉通道</NuxtLink>
        </div>
        <div>AI 分析声明：本页面部分内容由人工智能生成，可能存在理解偏差或表述不准确的情况，请结合原文进行判断。</div>
      </div>
    </footer>
  </div>
</template>
