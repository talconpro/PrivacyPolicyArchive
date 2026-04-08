import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.auditLog.deleteMany()
  await prisma.policyVersion.deleteMany()
  await prisma.crawlJob.deleteMany()
  await prisma.userSubmission.deleteMany()
  await prisma.app.deleteMany()

  const apps = [
    {
      slug: 'wechat',
      name: '微信',
      category: '社交',
      developer: '腾讯',
      privacyPolicyUrl: 'https://weixin.qq.com',
      riskLevel: 'high',
      status: 'published',
      featured: true,
      warningPinned: true,
      oneLiner: '收集范围广，第三方共享条款较宽泛。',
      plainSummary: '微信会收集账号、设备、日志、位置等多类信息，用于聊天、支付、风控与产品优化。部分共享场景写法较宽泛，普通用户需要重点关注。',
      isPublished: true,
      analyzedAt: new Date(),
      rawText: '示例隐私政策文本：收集设备信息、日志、位置，并可能与合作方共享。',
      contentHash: 'seed-wechat',
      analysis: {
        risk_level: 'high',
        one_liner: '收集范围广，第三方共享条款较宽泛。',
        key_findings: ['收集设备和日志数据', '涉及位置、通讯录等敏感信息场景', '共享条款较宽泛'],
        plain_summary: '微信会收集账号、设备、日志、位置等多类信息，用于聊天、支付、风控与产品优化。部分共享场景写法较宽泛。',
        data_collected: ['手机号', '设备标识', '位置', '聊天日志'],
        data_shared_with: ['支付合作方', '服务供应商'],
        user_rights: ['删除账号', '查询个人信息'],
        dispute: '以协议约定管辖地为准'
      }
    },
    {
      slug: 'douyin',
      name: '抖音',
      category: '视频/娱乐',
      developer: '字节跳动',
      privacyPolicyUrl: 'https://www.douyin.com',
      riskLevel: 'high',
      status: 'published',
      featured: true,
      oneLiner: '高度依赖行为数据与推荐系统画像。',
      plainSummary: '抖音围绕推荐系统收集较多行为、设备和日志数据，画像与个性化推荐说明较详细，但用户要特别留意推荐和广告相关处理。',
      isPublished: true,
      analyzedAt: new Date(),
      rawText: '示例隐私政策文本：为推荐内容，会收集浏览、点赞、评论等行为数据以及设备信息。',
      contentHash: 'seed-douyin',
      analysis: {
        risk_level: 'high',
        one_liner: '高度依赖行为数据与推荐系统画像。',
        key_findings: ['推荐画像依赖行为数据', '广告与商业化场景较多', '设备与日志信息收集较广'],
        plain_summary: '抖音围绕推荐系统收集较多行为、设备和日志数据，画像与个性化推荐说明较详细。',
        data_collected: ['浏览记录', '点赞评论', '设备信息'],
        data_shared_with: ['广告合作方', '云服务供应商'],
        user_rights: ['关闭个性化推荐', '申请删除'],
        dispute: '按照平台协议处理'
      }
    },
    {
      slug: 'alipay',
      name: '支付宝',
      category: '金融',
      developer: '蚂蚁集团',
      privacyPolicyUrl: 'https://render.alipay.com',
      riskLevel: 'medium',
      status: 'published',
      oneLiner: '金融合规说明较充分，但数据项较多。',
      plainSummary: '支付宝会收集身份、支付、设备和风控所需信息。因为金融业务场景复杂，说明通常较完整，但收集面也更广。',
      isPublished: true,
      analyzedAt: new Date(),
      rawText: '示例隐私政策文本：为了支付与风控，收集实名、设备、支付记录等信息。',
      contentHash: 'seed-alipay',
      analysis: {
        risk_level: 'medium',
        one_liner: '金融合规说明较充分，但数据项较多。',
        key_findings: ['风控与实名信息较多', '支付场景共享有合规依据', '用户权利说明相对完善'],
        plain_summary: '支付宝会收集身份、支付、设备和风控所需信息，因为金融业务场景复杂，说明通常较完整。',
        data_collected: ['身份信息', '支付记录', '设备信息'],
        data_shared_with: ['银行机构', '支付清算机构'],
        user_rights: ['查询', '更正', '删除'],
        dispute: '依据金融服务协议处理'
      }
    }
  ]

  for (const item of apps) {
    const app = await prisma.app.create({ data: { ...item, analysisSource: item.analysis, sourceType: 'seed' } })
    await prisma.policyVersion.create({
      data: {
        appId: app.id,
        versionLabel: 'Initial Seed',
        rawText: item.rawText!,
        contentHash: item.contentHash!,
        analysis: item.analysis,
        sourceUrl: item.privacyPolicyUrl
      }
    })
  }

  await prisma.userSubmission.create({
    data: {
      appName: '小红书',
      privacyUrl: 'https://www.xiaohongshu.com/privacy',
      ipHash: 'seed',
      status: 'pending'
    }
  })

  await prisma.userSubmission.create({
    data: {
      appName: '夸克',
      privacyUrl: 'https://www.quark.cn/privacy',
      ipHash: 'seed',
      status: 'review_ready',
      fetchStatus: 'success',
      analysisStatus: 'success',
      extractedText: '示例：会收集设备信息、日志和搜索记录。',
      suggestedRisk: 'medium',
      analysisDraft: {
        risk_level: 'medium',
        one_liner: '搜索与设备数据是重点。',
        key_findings: ['收集搜索记录', '收集设备信息', '用户需关注推荐与广告说明'],
        plain_summary: '主要围绕搜索和推荐能力处理数据。',
        data_collected: ['搜索记录', '设备信息'],
        data_shared_with: ['服务供应商'],
        user_rights: ['删除', '更正'],
        dispute: '以协议条款为准'
      }
    }
  })
}

main().finally(() => prisma.$disconnect())
