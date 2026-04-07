import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';

import { RiskRatingCard } from '@/components/RiskRatingCard';
import { RiskPill } from '@/components/RiskPill';
import { getAppDetail, getAppsIndex } from '@/lib/apps';

export const dynamic = 'force-static';
export const dynamicParams = false;

interface AppDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

function formatAnalyzedTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function generateStaticParams(): Array<{ id: string }> {
  const seen = new Set<string>();

  const params = getAppsIndex()
    .map((app) => app.slug || app.id)
    .filter((id) => {
      if (seen.has(id)) {
        return false;
      }

      seen.add(id);
      return true;
    })
    .map((id) => ({ id }));

  if (params.length === 0) {
    return [{ id: '__placeholder__' }];
  }

  return params;
}

export async function generateMetadata({ params }: AppDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const app = getAppDetail(id);

  if (!app) {
    return {
      title: 'App Not Found | Privacy Policy Archive',
      description: 'The requested app detail could not be found in the latest snapshot.',
    };
  }

  return {
    title: `${app.name} 隐私政策风险分析 | Privacy Policy Archive`,
    description: app.oneLineSummary,
  };
}

export default async function AppDetailPage({ params }: AppDetailPageProps): Promise<JSX.Element> {
  const { id } = await params;
  const app = getAppDetail(id);

  if (!app) {
    return (
      <article className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">App Detail Unavailable</h1>
        <p className="mt-3 text-sm text-slate-600">
          No app snapshot data is available yet. Run the update pipeline and redeploy to generate detail pages.
        </p>
        <Link href="/apps" className="mt-4 inline-flex text-sm font-medium text-slate-900 underline hover:opacity-80">
          Back to Apps
        </Link>
      </article>
    );
  }

  const riskReasons = app.riskReasons.slice(0, 3);
  const compareHref = `/compare?apps=${encodeURIComponent(app.slug || app.id)}`;

  return (
    <article className="space-y-8">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            {app.iconUrl ? (
              <Image
                src={app.iconUrl}
                alt={`${app.name} icon`}
                width={64}
                height={64}
                className="h-16 w-16 rounded-2xl object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl font-semibold text-slate-700">
                {app.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">{app.name}</h1>
              <p className="text-sm text-slate-600">
                {app.category ?? 'Uncategorized'} {app.developer ? `· ${app.developer}` : ''}
              </p>
              <p className="text-sm text-slate-600">Recent analysis: {formatAnalyzedTime(app.lastAnalyzedAt)}</p>
            </div>
          </div>

          <div className="w-full space-y-3 md:w-[360px]">
            <RiskRatingCard level={app.riskLevel} score={app.riskScore} />
            <div className="flex justify-end">
              <Link href={compareHref} className="text-sm font-medium text-slate-900 underline-offset-2 hover:underline">
                Add to compare
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">一句话总结</p>
            <p className="mt-3 text-lg font-semibold text-slate-900">{app.oneLineSummary}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">白话摘要</p>
            <p className="mt-3 leading-7 text-slate-700">{app.plainSummary}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">关键发现</p>
            <ul className="mt-3 space-y-3 text-slate-700">
              {app.keyFindings.length === 0 ? <li className="text-sm text-slate-500">No key findings available.</li> : null}
              {app.keyFindings.map((finding) => (
                <li key={finding} className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
                  {finding}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">最近变更</p>
            {app.latestChange ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-slate-700">{app.latestChange.changeSummary}</p>
                <ul className="space-y-2 text-sm text-slate-700">
                  {app.latestChange.changeHighlights.map((item) => (
                    <li key={item} className="rounded-lg bg-slate-50 px-3 py-2">
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-500">Generated at {formatAnalyzedTime(app.latestChange.createdAt)}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No change summary available yet.</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">FAQ</p>
            <div className="mt-3 space-y-3 text-sm text-slate-700">
              <div>
                <p className="font-semibold text-slate-900">Is this legal advice?</p>
                <p>No. This is an automated risk analysis for reference only.</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">How recent is this analysis?</p>
                <p>Last analyzed at {formatAnalyzedTime(app.lastAnalyzedAt)}.</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Where is the source policy?</p>
                <p>Use the official policy link in the right panel to verify original wording.</p>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">风险标签</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {app.redFlags.length === 0 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">#none</span>
              ) : (
                app.redFlags.map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    #{tag}
                  </span>
                ))
              )}
            </div>
            <div className="mt-4">
              <RiskPill level={app.riskLevel} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">评分依据（最多3条）</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {riskReasons.length === 0 ? <li className="text-slate-500">No reasons available.</li> : null}
              {riskReasons.map((reason) => (
                <li key={reason} className="rounded-lg bg-slate-50 px-3 py-2">
                  {reason}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">历史版本</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {app.historyVersions.map((version) => (
                <li key={version.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p>
                    v{version.versionNo} {version.isCurrent ? '(current)' : ''}
                  </p>
                  <p className="text-xs text-slate-500">{formatAnalyzedTime(version.fetchedAt)}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">官方协议链接</p>
            {app.officialPolicyUrl ? (
              <Link
                href={app.officialPolicyUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex text-sm font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900"
              >
                Open official privacy policy
              </Link>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No official link available.</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">最近分析时间</p>
            <p className="mt-3 text-sm text-slate-700">{formatAnalyzedTime(app.lastAnalyzedAt)}</p>
          </div>
        </aside>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-700">
          发现链接失效或信息错误？
          <Link
            href={`/submit?appName=${encodeURIComponent(app.name)}&privacyUrl=${encodeURIComponent(app.officialPolicyUrl ?? '')}`}
            className="ml-2 font-medium text-slate-900 underline underline-offset-2"
          >
            点此更正
          </Link>
        </p>
      </section>
    </article>
  );
}
