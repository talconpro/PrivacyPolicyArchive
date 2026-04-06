import test from 'node:test';
import assert from 'node:assert/strict';

import { applyHardTriggers, calculateRiskScore, mapRiskLevel } from './riskScorer';
import type { RiskScoringInput } from './riskScorer';

function baseInput(): RiskScoringInput {
  return {
    structuredFlags: {
      dataCollectionFlags: {
        collectsPersonalData: true,
        collectsSensitiveData: false,
        automatedDecisionMaking: false,
      },
      dataSharingFlags: {
        sharesWithThirdParties: false,
        widespreadThirdPartySharing: false,
        crossBorderTransfer: false,
      },
      userRightsFlags: {
        accountDeletionSupported: true,
        userRightsDescribed: true,
      },
      contractFlags: {
        forcedArbitration: false,
        dataSaleDeclared: false,
      },
      transparencyFlags: {
        clearRetentionPolicy: true,
      },
      minorProtectionFlags: {
        targetsChildren: false,
        hasMinorProtectionMechanism: false,
      },
    },
    dataCollected: ['name', 'email'],
    dataSharedWith: ['service_providers'],
    userRights: {
      access: true,
      deletion: true,
      correction: true,
      portability: true,
      optOutSale: true,
      optOutTargetedAds: true,
    },
    redFlags: [],
  };
}

test('returns LOW risk for minimal collection and complete user rights', () => {
  const result = calculateRiskScore(baseInput());

  assert.equal(result.riskLevel, 'LOW');
  assert.ok(result.riskScore < 25);
  assert.ok(result.reasons.length > 0);
});

test('DATA_SALE hard trigger forces critical-level floor', () => {
  const input = baseInput();
  input.redFlags = ['DATA_SALE'];

  const result = calculateRiskScore(input);

  assert.ok(result.riskScore >= 85);
  assert.equal(result.riskLevel, 'CRITICAL');
  assert.ok(result.reasons.some((reason) => reason.includes('data sale')));
});

test('combined sensitive-data sharing and forced arbitration yields critical score', () => {
  const input = baseInput();
  input.structuredFlags.dataCollectionFlags.collectsSensitiveData = true;
  input.structuredFlags.dataSharingFlags.sharesWithThirdParties = true;
  input.structuredFlags.dataSharingFlags.widespreadThirdPartySharing = true;
  input.structuredFlags.dataSharingFlags.crossBorderTransfer = true;
  input.structuredFlags.contractFlags.forcedArbitration = true;
  input.structuredFlags.userRightsFlags.accountDeletionSupported = false;
  input.structuredFlags.userRightsFlags.userRightsDescribed = false;
  input.dataCollected = ['health', 'biometric', 'precise_location'];
  input.dataSharedWith = ['advertisers', 'analytics_vendors', 'affiliates'];
  input.userRights.deletion = false;
  input.userRights.correction = false;
  input.userRights.portability = false;
  input.userRights.optOutSale = false;
  input.userRights.optOutTargetedAds = false;
  input.redFlags = ['FORCED_ARBITRATION', 'WIDESPREAD_THIRD_PARTY_SHARING'];

  const result = calculateRiskScore(input);

  assert.ok(result.riskScore >= 80);
  assert.equal(result.riskLevel, 'CRITICAL');
  assert.ok(result.reasons.some((reason) => reason.includes('forced arbitration')));
  assert.ok(result.reasons.some((reason) => reason.includes('third-party sharing')));
});

test('mapRiskLevel boundaries are stable', () => {
  assert.equal(mapRiskLevel(0), 'LOW');
  assert.equal(mapRiskLevel(24), 'LOW');
  assert.equal(mapRiskLevel(25), 'MEDIUM');
  assert.equal(mapRiskLevel(49), 'MEDIUM');
  assert.equal(mapRiskLevel(50), 'HIGH');
  assert.equal(mapRiskLevel(74), 'HIGH');
  assert.equal(mapRiskLevel(75), 'CRITICAL');
});

test('applyHardTriggers returns expected floor', () => {
  const reasons: string[] = [];
  const floor = applyHardTriggers(['FORCED_ARBITRATION', 'DATA_SALE'], reasons);

  assert.equal(floor, 85);
  assert.ok(reasons.length >= 2);
});
