import { AppCard } from '@/components/AppCard';
import { CategoryGrid } from '@/components/CategoryGrid';
import { SearchBox } from '@/components/SearchBox';
import { SectionHeader } from '@/components/SectionHeader';
import { getCategoryEntries, getHighRiskApps, getPopularApps, getSnapshotGeneratedAt } from '@/lib/apps';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-static';
export const metadata: Metadata = {
  title: 'Privacy Policy Archive',
  description: 'Track app privacy policy changes, risk scores, and high-impact updates.',
};

export default function HomePage(): JSX.Element {
  const popularApps = getPopularApps();
  const highRiskApps = getHighRiskApps();
  const categories = getCategoryEntries();
  const generatedAt = getSnapshotGeneratedAt();

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Privacy Policy Archive</p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Track Policy Changes, Spot Risks Early</h1>
        <p className="max-w-3xl text-base text-slate-600">
          Browse analyzed apps, discover high-risk policy updates, and quickly understand what changed.
        </p>
        <p className="text-xs text-slate-500">
          Snapshot updated at: {new Date(generatedAt).toLocaleString('en-US', { hour12: false })}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            提交未收录的App
          </Link>
          <Link href="/submissions" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:border-slate-400">
            查询提交状态
          </Link>
        </div>
        <SearchBox />
      </section>

      <section>
        <SectionHeader title="热门 App 列表" subtitle="Most followed apps with frequent policy updates." />
        <div className="grid gap-4 md:grid-cols-2">
          {popularApps.map((app) => (
            <AppCard key={app.id} app={app} compact />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="高危 App" subtitle="Apps with elevated privacy risk scores." />
        <div className="grid gap-4 lg:grid-cols-3">
          {highRiskApps.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="分类入口" subtitle="Jump into app categories." />
        <CategoryGrid entries={categories} />
      </section>
    </div>
  );
}
