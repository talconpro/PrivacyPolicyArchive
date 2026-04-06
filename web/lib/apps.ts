import appDetailsRaw from './generated/app-details.json';
import appsIndexRaw from './generated/apps-index.json';
import categoriesRaw from './generated/categories.json';
import compareIndexRaw from './generated/compare-index.json';
import metaRaw from './generated/meta.json';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';

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

export interface SnapshotAppIndexItem {
  id: string;
  slug: string;
  name: string;
  iconUrl: string | null;
  category: string | null;
  developer: string | null;
  riskLevel: RiskLevel;
  riskScore: number;
  oneLineSummary: string;
  lastAnalyzedAt: string;
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
  riskLevel: RiskLevel;
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

export interface SnapshotCategory {
  name: string;
  count: number;
}

export interface SnapshotMeta {
  generatedAt: string;
}

const appsIndex = appsIndexRaw as SnapshotAppIndexItem[];
const appDetails = appDetailsRaw as Record<string, SnapshotAppDetail>;
const categories = categoriesRaw as SnapshotCategory[];
const compareIndex = compareIndexRaw as Record<string, SnapshotAppIndexItem>;
const meta = metaRaw as SnapshotMeta;

function byRecencyDescending(a: { lastAnalyzedAt: string }, b: { lastAnalyzedAt: string }): number {
  return new Date(b.lastAnalyzedAt).getTime() - new Date(a.lastAnalyzedAt).getTime();
}

export function getSnapshotGeneratedAt(): string {
  return meta.generatedAt;
}

export function getAppsIndex(): SnapshotAppIndexItem[] {
  return appsIndex;
}

export function getCategories(): SnapshotCategory[] {
  return categories;
}

export function getCompareIndex(): Record<string, SnapshotAppIndexItem> {
  return compareIndex;
}

export function getAllAppDetails(): SnapshotAppDetail[] {
  return Object.values(appDetails);
}

export function getAppDetail(idOrSlug: string): SnapshotAppDetail | undefined {
  const byId = appDetails[idOrSlug];
  if (byId) {
    return byId;
  }

  return getAllAppDetails().find((item) => item.slug === idOrSlug);
}

export function getCompareSet(ids: string[]): SnapshotAppDetail[] {
  const deduped = [...new Set(ids.map((item) => item.trim()).filter(Boolean))].slice(0, 4);

  return deduped
    .map((id) => getAppDetail(id))
    .filter((app): app is SnapshotAppDetail => Boolean(app));
}

export function getPopularApps(limit = 6): SnapshotAppIndexItem[] {
  return [...appsIndex]
    .sort((a, b) => {
      const riskGap = b.riskScore - a.riskScore;
      if (riskGap !== 0) {
        return riskGap;
      }

      return byRecencyDescending(a, b);
    })
    .slice(0, limit);
}

export function getHighRiskApps(limit = 6): SnapshotAppIndexItem[] {
  return [...appsIndex]
    .filter((app) => app.riskLevel === 'HIGH' || app.riskLevel === 'CRITICAL')
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, limit);
}

export function getCategoryEntries(): Array<{ name: string; count: number; href: string }> {
  return categories
    .map((entry) => ({
      ...entry,
      href: `/apps?category=${encodeURIComponent(entry.name)}`,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function getRiskLevelOptions(): RiskLevel[] {
  return ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN'];
}
