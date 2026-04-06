import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface SnapshotVersionItem {
  id: string;
  versionNo: number;
  fetchedAt: string;
  isCurrent: boolean;
}

export interface SnapshotChangeSummary {
  changeSummary: string;
  changeHighlights: string[];
  createdAt: string;
}

export interface SnapshotAppDetail {
  id: string;
  slug: string;
  name: string;
  iconUrl: string | null;
  category: string | null;
  developer: string | null;
  officialPolicyUrl: string | null;
  oneLineSummary: string;
  plainSummary: string;
  riskLevel: string;
  riskScore: number;
  riskReasons: string[];
  keyFindings: string[];
  dataCollected: string[];
  dataSharedWith: string[];
  userRights: Record<string, boolean>;
  redFlags: string[];
  confidence: number;
  needsHumanReview: boolean;
  lastAnalyzedAt: string;
  historyVersions: SnapshotVersionItem[];
  latestChange: SnapshotChangeSummary | null;
}

export interface SnapshotAppIndexItem {
  id: string;
  slug: string;
  name: string;
  iconUrl: string | null;
  category: string | null;
  developer: string | null;
  riskLevel: string;
  riskScore: number;
  oneLineSummary: string;
  lastAnalyzedAt: string;
}

export interface SnapshotBundle {
  appsIndex: SnapshotAppIndexItem[];
  appDetails: Record<string, SnapshotAppDetail>;
  categories: Array<{ name: string; count: number }>;
  compareIndex: Record<string, SnapshotAppIndexItem>;
  generatedAt: string;
}

export function writeSnapshots(bundle: SnapshotBundle): void {
  const dir = resolve('web/lib/generated');
  mkdirSync(dir, { recursive: true });

  writeFileSync(resolve(dir, 'apps-index.json'), JSON.stringify(bundle.appsIndex, null, 2));
  writeFileSync(resolve(dir, 'app-details.json'), JSON.stringify(bundle.appDetails, null, 2));
  writeFileSync(resolve(dir, 'categories.json'), JSON.stringify(bundle.categories, null, 2));
  writeFileSync(resolve(dir, 'compare-index.json'), JSON.stringify(bundle.compareIndex, null, 2));
  writeFileSync(resolve(dir, 'meta.json'), JSON.stringify({ generatedAt: bundle.generatedAt }, null, 2));
}
