export type FrontendSettings = {
  siteName: string
  siteShortName: string
  siteTagline: string
  adminEntryLabel: string
  riskShow: boolean
  navShow: boolean
  repositoryUrl: string
  apkMaxUploadMb: number
}

export const settings: FrontendSettings = {
  // Site branding
  siteName: 'Privacy Policy Archive',
  siteShortName: 'AppSignal',
  siteTagline: '应用信号',

  // UI labels
  adminEntryLabel: '后台管理',

  // Home/Browse switches
  riskShow: false,
  navShow: false,

  // External links
  repositoryUrl: 'https://github.com/talconpro/PrivacyPolicyArchive#',

  // Analyzer fallback (actual limit should come from backend settings/api)
  apkMaxUploadMb: 300,
}
