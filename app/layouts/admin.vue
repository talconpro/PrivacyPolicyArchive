<template>
  <div class="min-h-screen bg-abyss">
    <div class="container-shell grid gap-6 py-8 lg:grid-cols-[260px,1fr]">
      <AdminSidebar />
      <main>
        <slot />
      </main>
    </div>
  </div>
</template>
