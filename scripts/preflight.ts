import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface AppDetail {
  id: string;
  slug: string;
  name: string;
  iconUrl: string | null;
  officialPolicyUrl: string | null;
  oneLineSummary: string;
  plainSummary: string;
  riskLevel: string;
}

interface Report {
  emptySummary: string[];
  missingIcon: string[];
  missingRiskLevel: string[];
  invalidPolicyLink: string[];
  duplicateSlug: string[];
}

const PLACEHOLDER_SUMMARIES = new Set([
  '',
  'Summary unavailable.',
  'No summary available.',
  'Policy analysis fallback was used due to parsing or validation issues.',
]);

async function loadAppDetails(): Promise<AppDetail[]> {
  const filePath = resolve('web/lib/generated/app-details.json');
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, AppDetail>;
  return Object.values(parsed);
}

function isEmptySummary(value: string): boolean {
  return PLACEHOLDER_SUMMARIES.has(value.trim());
}

async function checkUrlReachable(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}

async function run(): Promise<void> {
  const softFail = process.env.PREFLIGHT_SOFT_FAIL === '1';
  const skipLinkCheck = process.env.PREFLIGHT_SKIP_LINK_CHECK === '1';

  const apps = await loadAppDetails();

  const report: Report = {
    emptySummary: [],
    missingIcon: [],
    missingRiskLevel: [],
    invalidPolicyLink: [],
    duplicateSlug: [],
  };

  const slugCounter = new Map<string, number>();

  for (const app of apps) {
    slugCounter.set(app.slug, (slugCounter.get(app.slug) ?? 0) + 1);

    if (isEmptySummary(app.oneLineSummary) || isEmptySummary(app.plainSummary)) {
      report.emptySummary.push(`${app.id} (${app.name})`);
    }

    if (!app.iconUrl) {
      report.missingIcon.push(`${app.id} (${app.name})`);
    }

    if (!app.riskLevel || app.riskLevel === 'UNKNOWN') {
      report.missingRiskLevel.push(`${app.id} (${app.name})`);
    }

    if (!skipLinkCheck) {
      if (!app.officialPolicyUrl) {
        report.invalidPolicyLink.push(`${app.id} (${app.name}) - missing`);
      } else {
        let validUrl = true;
        try {
          // Validate URL format first before network check.
          new URL(app.officialPolicyUrl);
        } catch {
          validUrl = false;
        }

        if (!validUrl) {
          report.invalidPolicyLink.push(`${app.id} (${app.name}) - malformed`);
        } else {
          const reachable = await checkUrlReachable(app.officialPolicyUrl);
          if (!reachable) {
            report.invalidPolicyLink.push(`${app.id} (${app.name}) - unreachable`);
          }
        }
      }
    }
  }

  for (const [slug, count] of slugCounter.entries()) {
    if (count > 1) {
      report.duplicateSlug.push(`${slug} (count=${count})`);
    }
  }

  const entries = Object.entries(report) as Array<[keyof Report, string[]]>;
  const totalIssues = entries.reduce((sum, [, issues]) => sum + issues.length, 0);

  console.log('=== Preflight Report ===');
  console.log(`apps checked: ${apps.length}`);
  console.log(`total issues: ${totalIssues}`);
  console.log(`skip link check: ${skipLinkCheck}`);
  console.log(`soft fail: ${softFail}`);

  for (const [name, issues] of entries) {
    console.log(`\n[${name}] ${issues.length}`);
    for (const issue of issues.slice(0, 50)) {
      console.log(`- ${issue}`);
    }
    if (issues.length > 50) {
      console.log(`- ... and ${issues.length - 50} more`);
    }
  }

  if (totalIssues > 0 && !softFail) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('Preflight failed:', error);
  process.exitCode = 1;
});
