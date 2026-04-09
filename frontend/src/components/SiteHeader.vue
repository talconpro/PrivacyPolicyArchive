<script setup lang="ts">
import { settings } from '@/config/settings'
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-charcoal bg-abyss/90 backdrop-blur">
    <div class="page-shell flex items-center justify-between py-4">
      <router-link to="/" class="flex items-center gap-3">
        <div class="flex h-9 w-9 items-center justify-center rounded-md border border-signal text-signal shadow-[0_0_8px_rgba(0,217,146,.35)]">
          <svg class="text-signal" width="24" height="24" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path fill="currentColor" d="M16.757 9.303a.75.75 0 0 0-1.014-1.106l-5.47 5.015L8.28 11.22a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.037.023l6-5.5ZM20.25 5c-2.663 0-5.258-.943-7.8-2.85a.75.75 0 0 0-.9 0C9.008 4.057 6.413 5 3.75 5a.75.75 0 0 0-.75.75V11c0 5.001 2.958 8.676 8.725 10.948a.75.75 0 0 0 .55 0C18.042 19.676 21 16 21 11V5.75a.75.75 0 0 0-.75-.75ZM4.5 6.478c2.577-.152 5.08-1.09 7.5-2.8 2.42 1.71 4.923 2.648 7.5 2.8V11c0 4.256-2.453 7.379-7.5 9.442C6.953 18.379 4.5 15.256 4.5 11V6.478Z" />
          </svg>
        </div>
        <div>
          <div class="label-overline">{{ settings.siteShortName }}</div>
          <div class="text-sm text-parchment">{{ settings.siteTagline }}</div>
        </div>
      </router-link>
      <nav v-show="settings.navShow" class="hidden items-center gap-6 text-sm text-snow md:flex">
        <router-link to="/browse" class="hover:text-signal">浏览</router-link>
        <router-link to="/compare" class="hover:text-signal">对比</router-link>
        <router-link to="/submit" class="hover:text-signal">提交 App</router-link>
        <router-link to="/admin" class="btn-primary">{{ settings.adminEntryLabel }}</router-link>
      </nav>
      <nav class="flex items-center justify-between ">
        <a
            :href="settings.repositoryUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 text-white-700 "
        >
          <!-- GitHub SVG 图标 -->
          <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              class="w-8 h-8"
          >
            <path
                fill="currentColor"
                d="M12 2C6.477 2 2 6.484 2 12.02c0 4.426 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483
        0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.344-3.369-1.344-.455-1.157-1.11-1.466-1.11-1.466
        -.908-.62.069-.608.069-.608 1.004.07 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088
        2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951
        0-1.093.39-1.987 1.029-2.688-.103-.253-.446-1.272.098-2.65
        0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337
        1.909-1.296 2.747-1.026 2.747-1.026.546 1.378.203 2.397.1 2.65.64.701
        1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.944.359.31.678.921.678
        1.857 0 1.341-.012 2.422-.012 2.75 0 .268.18.58.688.481A10.02 10.02 0
        0022 12.02C22 6.484 17.523 2 12 2z"
                clip-rule="evenodd"
            />
          </svg>
        </a>
      </nav>
    </div>
  </header>
</template>
