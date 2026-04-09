import { createApp } from 'vue'
import App from '@/App.vue'
import { router } from '@/router'
import { settings } from '@/config/settings'
import '@/style.css'

document.title = settings.siteName

createApp(App).use(router).mount('#app')
