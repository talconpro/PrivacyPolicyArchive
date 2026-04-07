import { z } from 'zod';

export const submitPayloadSchema = z
  .object({
    appName: z.string().trim().min(1).max(120),
    privacyUrl: z.string().trim().url(),
    termsUrl: z.string().trim().url().optional(),
    submitterEmail: z.string().trim().email().optional(),
    remark: z.string().trim().max(500).optional(),
    captchaId: z.string().trim().min(1),
    captchaAnswer: z.string().trim().min(1).max(32),
  })
  .strict();

export const submissionStatusQuerySchema = z
  .object({
    status: z
      .enum(['PENDING', 'PROCESSING', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'DUPLICATE'])
      .optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
  })
  .strict();

export const adminApprovePayloadSchema = z
  .object({
    adminNote: z.string().trim().max(500).optional(),
    override: z
      .object({
        oneLineSummary: z.string().trim().max(400).optional(),
        plainSummary: z.string().trim().max(8_000).optional(),
        riskScore: z.number().min(0).max(100).optional(),
        riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN']).optional(),
      })
      .optional(),
  })
  .strict();

export const adminRejectPayloadSchema = z
  .object({
    adminNote: z.string().trim().min(1).max(500),
  })
  .strict();

export type SubmitPayload = z.infer<typeof submitPayloadSchema>;
export type SubmissionStatusQuery = z.infer<typeof submissionStatusQuerySchema>;
export type AdminApprovePayload = z.infer<typeof adminApprovePayloadSchema>;
export type AdminRejectPayload = z.infer<typeof adminRejectPayloadSchema>;
