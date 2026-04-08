export function toDateLabel(date?: Date | string | null) {
  if (!date) return '-'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
}

export function normalizeAnalysis(analysis: any = {}) {
  return {
    riskLevel: analysis.risk_level ?? 'medium',
    oneLiner: analysis.one_liner ?? 'No one-line summary yet',
    keyFindings: analysis.key_findings ?? [],
    plainSummary: analysis.plain_summary ?? 'No plain summary yet',
    dataCollected: analysis.data_collected ?? [],
    dataSharedWith: analysis.data_shared_with ?? [],
    userRights: analysis.user_rights ?? [],
    dispute: analysis.dispute ?? 'No dispute clause summary yet'
  }
}

export function slugifyName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
