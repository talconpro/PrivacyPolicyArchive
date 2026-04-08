import { z } from 'zod'

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
})

export const appEditorSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(160),
  category: z.string().min(1).max(80),
  developer: z.string().max(120).optional().nullable(),
  iconUrl: z.string().url().optional().nullable().or(z.literal('')),
  privacyPolicyUrl: z.string().url().optional().nullable().or(z.literal('')),
  termsOfServiceUrl: z.string().url().optional().nullable().or(z.literal('')),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  oneLiner: z.string().max(80),
  plainSummary: z.string().max(500),
  reviewNotes: z.string().max(2000).optional().nullable().or(z.literal('')),
  featured: z.boolean().default(false),
  warningPinned: z.boolean().default(false),
  status: z.enum(['draft', 'review_ready', 'published', 'archived']).default('draft'),
  isPublished: z.boolean().default(false)
})

export const analysisEditorSchema = z.object({
  risk_level: z.enum(['low', 'medium', 'high', 'critical']),
  one_liner: z.string().max(80),
  key_findings: z.array(z.string().min(1).max(120)).min(1).max(5),
  plain_summary: z.string().max(500),
  data_collected: z.array(z.string().min(1).max(100)).max(12),
  data_shared_with: z.array(z.string().min(1).max(100)).max(12),
  user_rights: z.array(z.string().min(1).max(100)).max(12),
  dispute: z.string().max(160)
})

export const LEGAL_DETERMINISTIC_TERMS = ['违法', '非法']

export function containsDeterministicLegalTerms(input: string) {
  return LEGAL_DETERMINISTIC_TERMS.some((term) => input.includes(term))
}

export const submissionReviewSchema = z.object({
  adminNote: z.string().max(2000).optional().or(z.literal('')),
  appId: z.string().optional().nullable().or(z.literal('')),
  action: z.enum(['approve', 'reject', 'send_back']).optional()
})

export const submissionBulkActionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  action: z.enum(['process', 'approve', 'reject', 'send_back']),
  adminNote: z.string().max(2000).optional().or(z.literal(''))
})

export const appBulkActionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  action: z.enum(['publish', 'archive', 'reanalyze'])
})

export const analysisBulkActionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  action: z.enum(['restore_ai', 'recalculate_risk'])
})
