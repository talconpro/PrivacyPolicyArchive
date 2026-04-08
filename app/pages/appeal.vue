<script setup lang="ts">
useSeoMeta({
  title: '开发者申诉通道',
  description: '开发者可通过官方邮箱提交内容更正、下线或侵权申诉，我们将在 3 个工作日内处理。'
})
</script>

<template>
  <div class="space-y-6">
    <section class="panel-accent p-6">
      <div class="label-overline">Developer Appeal</div>
      <h1 class="mt-2 text-3xl tracking-[-0.03em]">开发者申诉通道</h1>
      <p class="mt-4 text-base leading-7 text-parchment">
        如您是应用开发者或权利方，认为本网站页面存在信息不准确、更新不及时、内容侵权或其他需要更正的情况，可通过以下方式联系我们。
      </p>
    </section>

    <section class="panel p-6 space-y-4">
      <div>
        <h2 class="text-xl">官方邮箱</h2>
        <p class="mt-2 text-parchment">
          <a href="mailto:talconpro@outlook.com" class="text-signal hover:underline">talconpro@outlook.com</a>
        </p>
      </div>

      <div>
        <h2 class="text-xl">SLA 处理时效</h2>
        <p class="mt-2 text-parchment">我们将在收到申诉后 3 个工作日内完成初步核实与反馈。</p>
      </div>

      <div>
        <h2 class="text-xl">建议提交信息</h2>
        <p class="mt-2 text-parchment">
          请在邮件中提供应用名称、页面链接、具体问题说明及可验证材料，以便我们更快处理。
        </p>
      </div>
    </section>
  </div>
</template>
