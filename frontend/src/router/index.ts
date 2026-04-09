import {createRouter, createWebHashHistory} from 'vue-router'
import { api } from '../api/client'
import { settings } from '../config/settings'

import HomePage from '../pages/HomePage.vue'
import BrowsePage from '../pages/BrowsePage.vue'
import CategoryPage from '../pages/CategoryPage.vue'
import ComparePage from '../pages/ComparePage.vue'
import AppDetailPage from '../pages/AppDetailPage.vue'
import SubmitPage from '../pages/SubmitPage.vue'
import DisclaimerPage from '../pages/DisclaimerPage.vue'
import AppealPage from '../pages/AppealPage.vue'
import AdminLoginPage from '../pages/admin/AdminLoginPage.vue'
import AdminDashboardPage from '../pages/admin/AdminDashboardPage.vue'
import AdminAppsPage from '../pages/admin/AdminAppsPage.vue'
import AdminAppCreatePage from '../pages/admin/AdminAppCreatePage.vue'
import AdminAppEditPage from '../pages/admin/AdminAppEditPage.vue'
import AdminAnalysesPage from '../pages/admin/AdminAnalysesPage.vue'
import AdminAnalysisEditPage from '../pages/admin/AdminAnalysisEditPage.vue'
import AdminSubmissionsPage from '../pages/admin/AdminSubmissionsPage.vue'
import AdminSubmissionDetailPage from '../pages/admin/AdminSubmissionDetailPage.vue'
import AdminJobsPage from '../pages/admin/AdminJobsPage.vue'
import AdminAnalyzerPage from '../pages/admin/AdminAnalyzerPage.vue'
import AdminAppStoreBatchPage from '../pages/admin/AdminAppStoreBatchPage.vue'
import AdminSiteSettingsPage from '../pages/admin/AdminSiteSettingsPage.vue'
import AdminAppealsPage from '../pages/admin/AdminAppealsPage.vue'
import AdminAppealDetailPage from '../pages/admin/AdminAppealDetailPage.vue'

const routes = [
  { path: '/', component: HomePage, meta: { title: '首页' } },
  { path: '/browse', component: BrowsePage, meta: { title: '浏览' } },
  { path: '/categories/:category', component: CategoryPage, meta: { title: '分类' } },
  { path: '/compare', component: ComparePage, meta: { title: '对比' } },
  { path: '/apps/:slug', component: AppDetailPage, meta: { title: '应用详情' } },
  { path: '/submit', component: SubmitPage, meta: { title: '提交 App' } },
  { path: '/disclaimer', component: DisclaimerPage, meta: { title: '免责声明' } },
  { path: '/appeal', component: AppealPage, meta: { title: '申诉通道' } },
  { path: '/admin/login', component: AdminLoginPage, meta: { title: '后台登录' } },
  { path: '/admin', component: AdminDashboardPage, meta: { title: '后台概览' } },
  { path: '/admin/apps', component: AdminAppsPage, meta: { title: 'App 管理' } },
  { path: '/admin/apps/new', component: AdminAppCreatePage, meta: { title: '新增 App' } },
  { path: '/admin/apps/:id', component: AdminAppEditPage, meta: { title: '编辑 App' } },
  { path: '/admin/analyses', component: AdminAnalysesPage, meta: { title: '分析结果' } },
  { path: '/admin/analyses/:id', component: AdminAnalysisEditPage, meta: { title: '编辑分析' } },
  { path: '/admin/submissions', component: AdminSubmissionsPage, meta: { title: '提交审核' } },
  { path: '/admin/appeals', component: AdminAppealsPage, meta: { title: '开发者申诉' } },
  { path: '/admin/appeals/:id', component: AdminAppealDetailPage, meta: { title: '申诉详情' } },
  { path: '/admin/submissions/:id', component: AdminSubmissionDetailPage, meta: { title: '审核详情' } },
  { path: '/admin/tools/analyzer', component: AdminAnalyzerPage, meta: { title: '分析工作台' } },
  { path: '/admin/tools/appstore-id', component: AdminAppStoreBatchPage, meta: { title: '批量抓取 App Store ID' } },
  { path: '/admin/site-settings', component: AdminSiteSettingsPage, meta: { title: '站点设置' } },
  { path: '/admin/jobs', component: AdminJobsPage, meta: { title: '任务队列' } },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to) {
    if (to.hash) {
      return {
        el: to.hash,
        top: 88,
        behavior: 'smooth',
      }
    }
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  if (!to.path.startsWith('/admin') || to.path === '/admin/login') return true

  try {
    const res = await api.get('/auth/me')
    if (!res.data?.user) {
      return '/admin/login'
    }
    return true
  } catch {
    return '/admin/login'
  }
})

router.afterEach((to) => {
  const pageTitle = typeof to.meta?.title === 'string' ? to.meta.title : ''
  document.title = pageTitle ? `${pageTitle} - ${settings.siteName}` : settings.siteName
})
