<template>
  <header class="sticky top-0 z-50 border-b border-charcoal bg-abyss/90 backdrop-blur">
    <div class="container-shell flex items-center justify-between py-4">
      <NuxtLink to="/" class="flex items-center gap-3">
        <div class="flex h-9 w-9 items-center justify-center rounded-md border border-signal text-signal shadow-[0_0_8px_rgba(0,217,146,.35)]">
          <svg class="text-signal" width="24" height="24" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path fill="currentColor" d="M16.757 9.303a.75.75 0 0 0-1.014-1.106l-5.47 5.015L8.28 11.22a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.037.023l6-5.5ZM20.25 5c-2.663 0-5.258-.943-7.8-2.85a.75.75 0 0 0-.9 0C9.008 4.057 6.413 5 3.75 5a.75.75 0 0 0-.75.75V11c0 5.001 2.958 8.676 8.725 10.948a.75.75 0 0 0 .55 0C18.042 19.676 21 16 21 11V5.75a.75.75 0 0 0-.75-.75ZM4.5 6.478c2.577-.152 5.08-1.09 7.5-2.8 2.42 1.71 4.923 2.648 7.5 2.8V11c0 4.256-2.453 7.379-7.5 9.442C6.953 18.379 4.5 15.256 4.5 11V6.478Z" /></svg>        </div>
        <div>
          <div class="label-overline">AppSignal</div>
          <div class="text-sm text-parchment">应用信号</div>
        </div>
      </NuxtLink>
      <nav class="hidden items-center gap-6 text-sm text-snow md:flex">
        <NuxtLink to="/browse" class="hover:text-signal">浏览</NuxtLink>
        <NuxtLink to="/submit" class="hover:text-signal">提交 App</NuxtLink>
        <NuxtLink to="/admin" class="btn-primary">后台</NuxtLink>
      </nav>
    </div>
  </header>
</template>
