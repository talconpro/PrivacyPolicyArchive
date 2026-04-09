import { readonly, ref } from 'vue'
import { api } from '@/api/client'

export type SiteRuntimeSettings = {
  showAppIcon: boolean
  legalDisclaimerShort: string
  disclaimerNoAdviceNotice: string
  disclaimerAccuracyNotice: string
  disclaimerTrademarkNotice: string
  disclaimerRightsContactNotice: string
  dataSourceNotice: string
  aiAnalysisNotice: string
  iconUsageNotice: string
  contactEmail: string
  appealSlaDays: number
}

const state = ref<SiteRuntimeSettings>({
  showAppIcon: true,
  legalDisclaimerShort: '本网站内容仅供参考，不构成法律、合规或专业意见。',
  disclaimerNoAdviceNotice:
    '本网站不构成任何法律建议、合规建议或专业意见。用户在使用相关应用或作出决策前，应自行查阅官方隐私政策及相关法律文件。',
  disclaimerAccuracyNotice:
    '尽管我们努力确保信息的准确性与及时性，但由于数据来源、自动分析及信息更新等因素，相关内容可能存在不完整、不准确或滞后的情况。本网站不对任何因依赖本网站内容而产生的直接或间接损失承担责任。',
  disclaimerTrademarkNotice:
    '所有应用名称、商标及相关内容均归其各自权利人所有。本网站仅作信息性引用，不代表与相关公司存在任何关联、认可或合作关系。',
  disclaimerRightsContactNotice:
    '如相关权利方认为本网站内容存在不准确或侵权情况，请通过指定渠道联系我们，我们将在核实后及时处理。',
  dataSourceNotice: '本平台数据来源于公开可访问的应用隐私政策及相关页面，不涉及非公开数据采集。',
  aiAnalysisNotice: '部分内容由人工智能生成，可能存在理解偏差，请结合原文判断。',
  iconUsageNotice: '应用图标与商标归各自权利人所有，仅用于信息识别与引用，不代表合作、认可或官方背书。',
  contactEmail: 'talconpro@outlook.com',
  appealSlaDays: 3,
})

const loaded = ref(false)
const loading = ref(false)

export async function loadSiteRuntimeSettings(force = false) {
  if (loading.value) return
  if (loaded.value && !force) return

  loading.value = true
  try {
    const res = await api.get('/site-settings')
    const next = res.data?.settings || {}
    const sla = Number(next.appealSlaDays ?? state.value.appealSlaDays)

    state.value = {
      showAppIcon: Boolean(next.showAppIcon ?? state.value.showAppIcon),
      legalDisclaimerShort: String(next.legalDisclaimerShort || state.value.legalDisclaimerShort),
      disclaimerNoAdviceNotice: String(next.disclaimerNoAdviceNotice || state.value.disclaimerNoAdviceNotice),
      disclaimerAccuracyNotice: String(next.disclaimerAccuracyNotice || state.value.disclaimerAccuracyNotice),
      disclaimerTrademarkNotice: String(next.disclaimerTrademarkNotice || state.value.disclaimerTrademarkNotice),
      disclaimerRightsContactNotice: String(
        next.disclaimerRightsContactNotice || state.value.disclaimerRightsContactNotice,
      ),
      dataSourceNotice: String(next.dataSourceNotice || state.value.dataSourceNotice),
      aiAnalysisNotice: String(next.aiAnalysisNotice || state.value.aiAnalysisNotice),
      iconUsageNotice: String(next.iconUsageNotice || state.value.iconUsageNotice),
      contactEmail: String(next.contactEmail || state.value.contactEmail),
      appealSlaDays: Number.isFinite(sla) ? Math.max(1, Math.min(30, Math.floor(sla))) : state.value.appealSlaDays,
    }
    loaded.value = true
  } finally {
    loading.value = false
  }
}

export function useSiteRuntimeSettings() {
  return {
    settings: readonly(state),
    loaded: readonly(loaded),
    loading: readonly(loading),
  }
}
