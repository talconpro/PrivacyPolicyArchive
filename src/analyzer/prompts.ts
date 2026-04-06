export const DEEPSEEK_PROMPT_VERSION = 'deepseek-policy-v2';

export interface AnalyzeAppInfo {
  appId: string;
  appName: string;
  bundleId?: string;
  websiteUrl?: string;
  category?: string;
}

export interface PromptInput {
  app: AnalyzeAppInfo;
  policyText: string;
}

export function buildSystemPrompt(promptVersion: string): string {
  return [
    'You are a senior privacy policy analyst.',
    'Return STRICT JSON only. No markdown, no code fence, no extra text.',
    'Use concise neutral language and avoid speculation.',
    'Return keys exactly as requested.',
    `Set promptVersion exactly to "${promptVersion}".`,
  ].join(' ');
}

export function buildUserPrompt(input: PromptInput): string {
  return JSON.stringify(
    {
      task: 'Analyze this app privacy policy and return structured risk factors.',
      outputSchemaHint: {
        oneLineSummary: 'string',
        plainSummary: 'string',
        keyFindings: ['string'],
        dataCollected: ['string'],
        dataSharedWith: ['string'],
        userRights: {
          access: 'boolean',
          deletion: 'boolean',
          correction: 'boolean',
          portability: 'boolean',
          optOutSale: 'boolean',
          optOutTargetedAds: 'boolean',
        },
        redFlags: [
          'DATA_SALE|FORCED_ARBITRATION|WIDESPREAD_THIRD_PARTY_SHARING|DARK_PATTERN_CONSENT|INDEFINITE_RETENTION',
        ],
        structuredFlags: {
          dataCollectionFlags: {
            collectsPersonalData: 'boolean',
            collectsSensitiveData: 'boolean',
            automatedDecisionMaking: 'boolean',
          },
          dataSharingFlags: {
            sharesWithThirdParties: 'boolean',
            widespreadThirdPartySharing: 'boolean',
            crossBorderTransfer: 'boolean',
          },
          userRightsFlags: {
            accountDeletionSupported: 'boolean',
            userRightsDescribed: 'boolean',
          },
          contractFlags: {
            forcedArbitration: 'boolean',
            dataSaleDeclared: 'boolean',
          },
          transparencyFlags: {
            clearRetentionPolicy: 'boolean',
          },
          minorProtectionFlags: {
            targetsChildren: 'boolean',
            hasMinorProtectionMechanism: 'boolean',
          },
        },
        confidence: 'number(0-1)',
        needsHumanReview: 'boolean',
        promptVersion: 'string',
      },
      app: input.app,
      policyText: input.policyText,
    },
    null,
    2,
  );
}
