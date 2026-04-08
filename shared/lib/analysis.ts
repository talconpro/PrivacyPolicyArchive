const SYSTEM_PROMPT = `You are a senior privacy-policy analyst. Output JSON only (no Markdown). Required fields: risk_level, one_liner, key_findings, plain_summary, data_collected, data_shared_with, user_rights, dispute. Rules: 1) risk_level must be one of low / medium / high / critical. 2) one_liner <= 30 Chinese characters. 3) key_findings must contain 3-5 items. 4) plain_summary must be plain-language Chinese and <= 200 Chinese characters. 5) Do not fabricate facts not mentioned in the policy. 6) Avoid deterministic legal judgments (e.g. "\u8fdd\u6cd5", "\u975e\u6cd5"); use neutral wording instead (e.g. "\u53ef\u80fd\u6d89\u53ca", "\u6761\u6b3e\u4e2d\u63d0\u53ca").`

export type PolicyAnalysis = {
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  one_liner: string
  key_findings: string[]
  plain_summary: string
  data_collected: string[]
  data_shared_with: string[]
  user_rights: string[]
  dispute: string
}

export function buildFallbackAnalysis(text: string): PolicyAnalysis {
  const short = text.replace(/\s+/g, ' ').slice(0, 160)
  const mentionsSharing = /(共享|第三方|合作方|出售)/.test(text)
  const mentionsLocation = /(位置|定位|通讯录|麦克风|相册|摄像头)/.test(text)
  const risk_level = mentionsSharing && mentionsLocation ? 'high' : mentionsLocation ? 'medium' : 'low'
  return {
    risk_level,
    one_liner: '自动分析结果，请人工复核。',
    key_findings: [
      '已抓取并完成协议文本预处理',
      mentionsSharing ? '检测到第三方共享相关表述' : '未发现明显第三方共享高风险表述',
      mentionsLocation ? '检测到位置/设备等敏感权限描述' : '敏感权限描述相对有限'
    ],
    plain_summary: short || '暂无足够文本生成摘要。',
    data_collected: mentionsLocation ? ['设备信息', '位置/权限信息'] : ['账号信息'],
    data_shared_with: mentionsSharing ? ['第三方服务商或合作方'] : [],
    user_rights: ['查询', '删除', '注销'],
    dispute: '请结合协议原文复核争议解决条款。'
  }
}

function safeJsonParse(content: string) {
  try {
    return JSON.parse(content)
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('模型返回中未找到 JSON')
    return JSON.parse(match[0])
  }
}

export async function analyzePolicyText(text: string, options?: {
  apiKey?: string
  baseUrl?: string
  model?: string
}) {
  const apiKey = options?.apiKey || process.env.NUXT_DEEPSEEK_API_KEY
  const baseUrl = options?.baseUrl || process.env.NUXT_DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
  const model = options?.model || process.env.NUXT_DEEPSEEK_MODEL || 'deepseek-chat'
  if (!apiKey) return buildFallbackAnalysis(text)

  const payload = {
    model,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `请分析以下隐私政策文本：

${text.slice(0, 120000)}` }
    ]
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    throw new Error(`DeepSeek 请求失败：${response.status} ${await response.text()}`)
  }

  const json = await response.json()
  const content = json?.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek 返回为空')
  const parsed = safeJsonParse(content)
  return {
    ...buildFallbackAnalysis(text),
    ...parsed
  } as PolicyAnalysis
}
