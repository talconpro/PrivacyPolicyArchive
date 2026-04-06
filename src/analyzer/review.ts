import type { RiskLevel } from './riskScorer';
import type { RedFlag } from './schema';

const HIGH_SENSITIVITY_FLAGS: RedFlag[] = ['DATA_SALE', 'FORCED_ARBITRATION', 'INDEFINITE_RETENTION'];

export interface ReviewDecisionInput {
  riskLevel: RiskLevel;
  confidence: number;
  normalizedTextLength: number;
  redFlags: RedFlag[];
}

export interface ReviewDecision {
  needsHumanReview: boolean;
  reviewReason: string;
  reviewPriority: number;
}

/**
 * Rule-based queue decision for manual review.
 */
export function decideReview(input: ReviewDecisionInput): ReviewDecision {
  const reasons: string[] = [];
  let priority = 0;

  if (input.riskLevel === 'CRITICAL') {
    reasons.push('critical-risk');
    priority = Math.max(priority, 3);
  }

  if (input.confidence < 0.7) {
    reasons.push('low-confidence');
    priority = Math.max(priority, 2);
  }

  if (input.normalizedTextLength < 180 || input.normalizedTextLength > 250_000) {
    reasons.push('abnormal-text-length');
    priority = Math.max(priority, 2);
  }

  if (input.redFlags.some((flag) => HIGH_SENSITIVITY_FLAGS.includes(flag))) {
    reasons.push('high-sensitivity-flag');
    priority = Math.max(priority, 3);
  }

  return {
    needsHumanReview: reasons.length > 0,
    reviewReason: reasons.join(','),
    reviewPriority: priority,
  };
}
