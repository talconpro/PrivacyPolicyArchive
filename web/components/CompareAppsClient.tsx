'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type { SnapshotAppDetail } from '@/lib/apps';

import { RiskPill } from './RiskPill';

interface CompareAppsClientProps {
  details: SnapshotAppDetail[];
}

function parseCompareIds(raw: string): string[] {
  return [...new Set(raw.split(',').map((item) => item.trim()).filter(Boolean))].slice(0, 4);
}

function toMap(details: SnapshotAppDetail[]): Map<string, SnapshotAppDetail> {
  const map = new Map<string, SnapshotAppDetail>();

  for (const app of details) {
    map.set(app.id, app);
    map.set(app.slug, app);
  }

  return map;
}

function boolLabel(value: boolean): string {
  return value ? 'Yes' : 'No';
}

export function CompareAppsClient({ details }: CompareAppsClientProps): JSX.Element {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const raw = searchParams.get('apps') ?? '';
  const ids = parseCompareIds(raw);
  const detailMap = toMap(details);
  const selected = ids
    .map((id) => detailMap.get(id))
    .filter((app): app is SnapshotAppDetail => Boolean(app));

  function onCompareInputChange(value: string): void {
    const next = new URLSearchParams(searchParams.toString());
    if (!value.trim()) {
      next.delete('apps');
    } else {
      next.set('apps', value);
    }

    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm text-slate-700">
          <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Apps to compare (2-4)</span>
          <input
            type="text"
            value={raw}
            onChange={(event) => onCompareInputChange(event.currentTarget.value)}
            placeholder="comma-separated ids or slugs, e.g. chatgpt,instagram"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <p className="mt-2 text-xs text-slate-500">
          Tips: open each app detail page and click &quot;Add to compare&quot; for quick link generation.
        </p>
      </div>

      {selected.length < 2 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">
          Please provide at least 2 valid app ids/slugs in the URL, e.g. <code>?apps=app1,app2</code>.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {selected.map((app) => (
            <article key={app.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{app.name}</h2>
                  <p className="text-xs text-slate-500">
                    {app.category ?? 'Uncategorized'} {app.developer ? `· ${app.developer}` : ''}
                  </p>
                </div>
                <RiskPill level={app.riskLevel} />
              </div>

              <p className="mt-3 text-sm text-slate-700">{app.oneLineSummary}</p>

              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Risk score</dt>
                  <dd className="font-medium text-slate-900">{app.riskScore}/100</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Data collected</dt>
                  <dd className="text-right text-slate-900">{app.dataCollected.join(', ') || 'N/A'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Data shared with</dt>
                  <dd className="text-right text-slate-900">{app.dataSharedWith.join(', ') || 'N/A'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">User rights</dt>
                  <dd className="text-right text-slate-900">
                    Access {boolLabel(Boolean(app.userRights.access))}, Deletion {boolLabel(Boolean(app.userRights.deletion))}
                  </dd>
                </div>
              </dl>

              <div className="mt-4">
                <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Key findings</p>
                <ul className="space-y-1 text-sm text-slate-700">
                  {app.keyFindings.slice(0, 3).map((finding) => (
                    <li key={finding} className="rounded-lg bg-slate-50 px-3 py-2">
                      {finding}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <Link href={`/apps/${app.slug}`} className="font-medium text-slate-900 underline-offset-2 hover:underline">
                  View detail
                </Link>
                {app.officialPolicyUrl ? (
                  <Link href={app.officialPolicyUrl} target="_blank" rel="noreferrer" className="text-slate-700 underline-offset-2 hover:underline">
                    Official policy
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
