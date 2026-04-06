import type { Metadata } from 'next';

import { CompareAppsClient } from '@/components/CompareAppsClient';
import { getAllAppDetails } from '@/lib/apps';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Compare Apps | Privacy Policy Archive',
  description: 'Compare privacy risk and data practices across apps.',
};

export default function ComparePage(): JSX.Element {
  const details = getAllAppDetails();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Compare Apps</h1>
        <p className="text-sm text-slate-600">
          Compare up to 4 apps side-by-side by risk score, findings, data collection, sharing, and user rights.
        </p>
      </header>
      <CompareAppsClient details={details} />
    </div>
  );
}
