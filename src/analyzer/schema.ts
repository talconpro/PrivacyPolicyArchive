import { z } from 'zod';

export const analyzerRiskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN']);

export const redFlagSchema = z.enum([
  'DATA_SALE',
  'FORCED_ARBITRATION',
  'WIDESPREAD_THIRD_PARTY_SHARING',
  'DARK_PATTERN_CONSENT',
  'INDEFINITE_RETENTION',
]);

export const dataCollectionFlagsSchema = z
  .object({
    collectsPersonalData: z.boolean().default(false),
    collectsSensitiveData: z.boolean().default(false),
    automatedDecisionMaking: z.boolean().default(false),
  })
  .strict();

export const dataSharingFlagsSchema = z
  .object({
    sharesWithThirdParties: z.boolean().default(false),
    widespreadThirdPartySharing: z.boolean().default(false),
    crossBorderTransfer: z.boolean().default(false),
  })
  .strict();

export const userRightsFlagsSchema = z
  .object({
    accountDeletionSupported: z.boolean().default(false),
    userRightsDescribed: z.boolean().default(false),
  })
  .strict();

export const contractFlagsSchema = z
  .object({
    forcedArbitration: z.boolean().default(false),
    dataSaleDeclared: z.boolean().default(false),
  })
  .strict();

export const transparencyFlagsSchema = z
  .object({
    clearRetentionPolicy: z.boolean().default(false),
  })
  .strict();

export const minorProtectionFlagsSchema = z
  .object({
    targetsChildren: z.boolean().default(false),
    hasMinorProtectionMechanism: z.boolean().default(false),
  })
  .strict();

export const structuredFlagsSchema = z
  .object({
    dataCollectionFlags: dataCollectionFlagsSchema.default({}),
    dataSharingFlags: dataSharingFlagsSchema.default({}),
    userRightsFlags: userRightsFlagsSchema.default({}),
    contractFlags: contractFlagsSchema.default({}),
    transparencyFlags: transparencyFlagsSchema.default({}),
    minorProtectionFlags: minorProtectionFlagsSchema.default({}),
  })
  .strict();

export const userRightsSchema = z
  .object({
    access: z.boolean().default(false),
    deletion: z.boolean().default(false),
    correction: z.boolean().default(false),
    portability: z.boolean().default(false),
    optOutSale: z.boolean().default(false),
    optOutTargetedAds: z.boolean().default(false),
  })
  .strict();

export const llmAnalysisSchema = z
  .object({
    oneLineSummary: z.string().optional(),
    plainSummary: z.string().optional(),
    keyFindings: z.array(z.string()).optional(),
    dataCollected: z.array(z.string()).optional(),
    dataSharedWith: z.array(z.string()).optional(),
    userRights: userRightsSchema.partial().optional(),
    redFlags: z.array(redFlagSchema).optional(),
    structuredFlags: structuredFlagsSchema.partial().optional(),
    confidence: z.number().min(0).max(1).optional(),
    needsHumanReview: z.boolean().optional(),
    promptVersion: z.string().optional(),
  })
  .strict();

export const normalizedAnalysisSchema = z
  .object({
    oneLineSummary: z.string(),
    plainSummary: z.string(),
    keyFindings: z.array(z.string()),
    dataCollected: z.array(z.string()),
    dataSharedWith: z.array(z.string()),
    userRights: userRightsSchema,
    redFlags: z.array(redFlagSchema),
    structuredFlags: structuredFlagsSchema,
    confidence: z.number().min(0).max(1),
    needsHumanReview: z.boolean(),
    promptVersion: z.string(),
  })
  .strict();

export type AnalyzerRiskLevel = z.infer<typeof analyzerRiskLevelSchema>;
export type RedFlag = z.infer<typeof redFlagSchema>;
export type StructuredFlags = z.infer<typeof structuredFlagsSchema>;
export type UserRights = z.infer<typeof userRightsSchema>;
export type LlmAnalysisResult = z.infer<typeof llmAnalysisSchema>;
export type NormalizedAnalysisResult = z.infer<typeof normalizedAnalysisSchema>;
