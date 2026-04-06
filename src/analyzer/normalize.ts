import {
  llmAnalysisSchema,
  normalizedAnalysisSchema,
  type LlmAnalysisResult,
  type NormalizedAnalysisResult,
} from './schema';

const DEFAULT_ANALYSIS: NormalizedAnalysisResult = {
  oneLineSummary: 'Summary unavailable.',
  plainSummary: 'Policy analysis fallback was used due to parsing or validation issues.',
  keyFindings: [],
  dataCollected: [],
  dataSharedWith: [],
  userRights: {
    access: false,
    deletion: false,
    correction: false,
    portability: false,
    optOutSale: false,
    optOutTargetedAds: false,
  },
  redFlags: [],
  structuredFlags: {
    dataCollectionFlags: {
      collectsPersonalData: false,
      collectsSensitiveData: false,
      automatedDecisionMaking: false,
    },
    dataSharingFlags: {
      sharesWithThirdParties: false,
      widespreadThirdPartySharing: false,
      crossBorderTransfer: false,
    },
    userRightsFlags: {
      accountDeletionSupported: false,
      userRightsDescribed: false,
    },
    contractFlags: {
      forcedArbitration: false,
      dataSaleDeclared: false,
    },
    transparencyFlags: {
      clearRetentionPolicy: false,
    },
    minorProtectionFlags: {
      targetsChildren: false,
      hasMinorProtectionMechanism: false,
    },
  },
  confidence: 0.5,
  needsHumanReview: true,
  promptVersion: 'unknown',
};

function mergeWithDefaults(partial: LlmAnalysisResult): NormalizedAnalysisResult {
  return {
    ...DEFAULT_ANALYSIS,
    ...partial,
    userRights: {
      ...DEFAULT_ANALYSIS.userRights,
      ...partial.userRights,
    },
    structuredFlags: {
      ...DEFAULT_ANALYSIS.structuredFlags,
      ...partial.structuredFlags,
      dataCollectionFlags: {
        ...DEFAULT_ANALYSIS.structuredFlags.dataCollectionFlags,
        ...partial.structuredFlags?.dataCollectionFlags,
      },
      dataSharingFlags: {
        ...DEFAULT_ANALYSIS.structuredFlags.dataSharingFlags,
        ...partial.structuredFlags?.dataSharingFlags,
      },
      userRightsFlags: {
        ...DEFAULT_ANALYSIS.structuredFlags.userRightsFlags,
        ...partial.structuredFlags?.userRightsFlags,
      },
      contractFlags: {
        ...DEFAULT_ANALYSIS.structuredFlags.contractFlags,
        ...partial.structuredFlags?.contractFlags,
      },
      transparencyFlags: {
        ...DEFAULT_ANALYSIS.structuredFlags.transparencyFlags,
        ...partial.structuredFlags?.transparencyFlags,
      },
      minorProtectionFlags: {
        ...DEFAULT_ANALYSIS.structuredFlags.minorProtectionFlags,
        ...partial.structuredFlags?.minorProtectionFlags,
      },
    },
  };
}

export interface NormalizeResult {
  value: NormalizedAnalysisResult;
  warnings: string[];
}

/**
 * parse -> validate -> normalize with safe fallback values.
 */
export function normalizeAnalysisResult(payload: unknown): NormalizeResult {
  const warnings: string[] = [];

  const parsed = llmAnalysisSchema.safeParse(payload);
  if (!parsed.success) {
    warnings.push(`llmAnalysisSchema parse failed: ${parsed.error.message}`);
    return {
      value: DEFAULT_ANALYSIS,
      warnings,
    };
  }

  const merged = mergeWithDefaults(parsed.data);
  const normalized = normalizedAnalysisSchema.safeParse(merged);

  if (!normalized.success) {
    warnings.push(`normalizedAnalysisSchema validation failed: ${normalized.error.message}`);
    return {
      value: DEFAULT_ANALYSIS,
      warnings,
    };
  }

  return {
    value: normalized.data,
    warnings,
  };
}
