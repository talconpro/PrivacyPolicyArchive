import type { RedFlag, StructuredFlags, UserRights } from './schema';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskScoringInput {
  structuredFlags: StructuredFlags;
  dataCollected: string[];
  dataSharedWith: string[];
  userRights: UserRights;
  redFlags: RedFlag[];
}

export interface RiskScoringResult {
  riskScore: number;
  riskLevel: RiskLevel;
  reasons: string[];
}

interface TriggerRule {
  floor: number;
  reason: string;
}

const DATA_COLLECTED_WEIGHTS: Record<string, number> = {
  name: 2,
  email: 2,
  phone: 3,
  device_id: 4,
  precise_location: 10,
  contacts: 8,
  messages: 10,
  photos: 7,
  health: 14,
  biometric: 16,
  financial: 13,
  children_data: 15,
  government_id: 16,
};

const DATA_SHARED_WITH_WEIGHTS: Record<string, number> = {
  service_providers: 4,
  analytics_vendors: 7,
  advertisers: 12,
  affiliates: 8,
  data_brokers: 18,
  government_agencies: 8,
};

const HARD_TRIGGER_RULES: Partial<Record<RedFlag, TriggerRule>> = {
  DATA_SALE: {
    floor: 85,
    reason: 'Hard trigger: policy indicates data sale.',
  },
  FORCED_ARBITRATION: {
    floor: 75,
    reason: 'Hard trigger: forced arbitration limits user legal options.',
  },
  WIDESPREAD_THIRD_PARTY_SHARING: {
    floor: 80,
    reason: 'Hard trigger: broad third-party sharing is declared.',
  },
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function mapRiskLevel(score: number): RiskLevel {
  if (score >= 75) {
    return 'CRITICAL';
  }

  if (score >= 50) {
    return 'HIGH';
  }

  if (score >= 25) {
    return 'MEDIUM';
  }

  return 'LOW';
}

function applyListWeights(
  label: 'dataCollected' | 'dataSharedWith',
  values: string[],
  table: Record<string, number>,
  reasons: string[],
): number {
  let score = 0;

  for (const value of values) {
    const normalized = value.toLowerCase();
    const weight = table[normalized];
    if (!weight) {
      continue;
    }

    score += weight;
    reasons.push(`+${weight} ${label} includes ${normalized}.`);
  }

  return score;
}

function applyUserRightsRules(userRights: UserRights, reasons: string[]): number {
  let score = 0;

  const missingPenalty: Array<[keyof UserRights, number, string]> = [
    ['access', 4, '+4 missing right of access.'],
    ['deletion', 8, '+8 missing right of deletion.'],
    ['correction', 4, '+4 missing right of correction.'],
    ['portability', 3, '+3 missing right of portability.'],
    ['optOutSale', 8, '+8 missing opt-out for data sale.'],
    ['optOutTargetedAds', 6, '+6 missing opt-out for targeted ads.'],
  ];

  for (const [key, points, reason] of missingPenalty) {
    if (!userRights[key]) {
      score += points;
      reasons.push(reason);
    }
  }

  return score;
}

function applyStructuredFlagRules(input: StructuredFlags, reasons: string[]): number {
  let score = 0;

  if (input.dataCollectionFlags.collectsPersonalData) {
    score += 8;
    reasons.push('+8 collects personal data.');
  }
  if (input.dataCollectionFlags.collectsSensitiveData) {
    score += 16;
    reasons.push('+16 collects sensitive data.');
  }
  if (input.dataCollectionFlags.automatedDecisionMaking) {
    score += 10;
    reasons.push('+10 automated decision making is present.');
  }

  if (input.dataSharingFlags.sharesWithThirdParties) {
    score += 14;
    reasons.push('+14 shares data with third parties.');
  }
  if (input.dataSharingFlags.crossBorderTransfer) {
    score += 8;
    reasons.push('+8 includes cross-border transfer.');
  }
  if (input.dataSharingFlags.widespreadThirdPartySharing) {
    score += 12;
    reasons.push('+12 indicates widespread third-party sharing.');
  }

  if (!input.userRightsFlags.accountDeletionSupported) {
    score += 10;
    reasons.push('+10 account deletion is not clearly supported.');
  }
  if (!input.userRightsFlags.userRightsDescribed) {
    score += 8;
    reasons.push('+8 user rights are not clearly described.');
  }

  if (input.contractFlags.forcedArbitration) {
    score += 8;
    reasons.push('+8 forced arbitration language found.');
  }
  if (input.contractFlags.dataSaleDeclared) {
    score += 16;
    reasons.push('+16 data sale is explicitly declared.');
  }

  if (!input.transparencyFlags.clearRetentionPolicy) {
    score += 6;
    reasons.push('+6 retention policy lacks clarity.');
  }

  if (input.minorProtectionFlags.targetsChildren) {
    score += 14;
    reasons.push('+14 product likely touches children data.');
  }
  if (input.minorProtectionFlags.targetsChildren && !input.minorProtectionFlags.hasMinorProtectionMechanism) {
    score += 6;
    reasons.push('+6 missing explicit child protection mechanism.');
  }

  return score;
}

export function applyHardTriggers(redFlags: RedFlag[], reasons: string[]): number {
  let floor = 0;

  for (const flag of redFlags) {
    const rule = HARD_TRIGGER_RULES[flag];
    if (!rule) {
      continue;
    }

    floor = Math.max(floor, rule.floor);
    reasons.push(rule.reason);
  }

  return floor;
}

/**
 * Deterministic and explainable risk scoring based on structured signals.
 */
export function calculateRiskScore(input: RiskScoringInput): RiskScoringResult {
  const reasons: string[] = [];

  let score = 0;
  score += applyStructuredFlagRules(input.structuredFlags, reasons);
  score += applyListWeights('dataCollected', input.dataCollected, DATA_COLLECTED_WEIGHTS, reasons);
  score += applyListWeights('dataSharedWith', input.dataSharedWith, DATA_SHARED_WITH_WEIGHTS, reasons);
  score += applyUserRightsRules(input.userRights, reasons);

  const hardTriggerFloor = applyHardTriggers(input.redFlags, reasons);
  score = Math.max(score, hardTriggerFloor);

  if (
    input.structuredFlags.dataCollectionFlags.collectsSensitiveData &&
    (input.structuredFlags.dataSharingFlags.sharesWithThirdParties ||
      input.structuredFlags.dataSharingFlags.widespreadThirdPartySharing ||
      input.redFlags.includes('WIDESPREAD_THIRD_PARTY_SHARING'))
  ) {
    score += 8;
    reasons.push('+8 synergy: sensitive data combined with third-party sharing.');
  }

  const riskScore = clampScore(score);

  return {
    riskScore,
    riskLevel: mapRiskLevel(riskScore),
    reasons,
  };
}

// Backward-friendly alias.
export const scoreRisk = calculateRiskScore;
