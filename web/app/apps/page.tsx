import type { Metadata } from 'next';

import { BrowseAppsClient } from '@/components/BrowseAppsClient';
import { getAppsIndex, getCategories, getSnapshotGeneratedAt } from '@/lib/apps';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Browse Apps | Privacy Policy Archive',
  description: 'Filter apps by category, risk level, and update time.',
};

export default function AppsPage(): JSX.Element {
  const apps = getAppsIndex();
  const categories = getCategories();
  const generatedAt = getSnapshotGeneratedAt();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Browse Apps</h1>
        <p className="text-sm text-slate-600">Filter by category, risk level, sort order, and keyword.</p>
        <p className="text-xs text-slate-500">
          Data snapshot: {new Date(generatedAt).toLocaleString('en-US', { hour12: false })}
        </p>
      </header>

      <BrowseAppsClient apps={apps} categories={categories} />
    </div>
  );
}
