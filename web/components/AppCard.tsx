import Image from 'next/image';
import Link from 'next/link';

import type { SnapshotAppIndexItem } from '@/lib/apps';

import { RiskPill } from './RiskPill';

interface AppCardProps {
  app: SnapshotAppIndexItem;
  compact?: boolean;
}

function AppIcon({ app }: { app: SnapshotAppIndexItem }): JSX.Element {
  if (app.iconUrl) {
    return (
      <Image
        src={app.iconUrl}
        alt={`${app.name} icon`}
        width={48}
        height={48}
        className="h-12 w-12 rounded-xl object-cover"
      />
    );
  }

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200 text-sm font-semibold text-slate-700">
      {app.name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function AppCard({ app, compact = false }: AppCardProps): JSX.Element {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AppIcon app={app} />
          <div>
            <h3 className="text-base font-semibold text-slate-900">{app.name}</h3>
            <p className="text-xs text-slate-500">
              {app.category ?? 'Uncategorized'} {app.developer ? `· ${app.developer}` : ''}
            </p>
          </div>
        </div>
        <RiskPill level={app.riskLevel} />
      </div>

      <p className={`mt-3 text-sm text-slate-700 ${compact ? 'line-clamp-2' : ''}`}>{app.oneLineSummary}</p>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-slate-500">Risk Score {app.riskScore}/100</p>
        <Link href={`/apps/${app.slug || app.id}`} className="text-sm font-medium text-slate-900 underline-offset-2 hover:underline">
          View detail
        </Link>
      </div>
    </article>
  );
}
