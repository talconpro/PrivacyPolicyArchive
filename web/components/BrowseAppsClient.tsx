'use client';

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type { RiskLevel, SnapshotAppIndexItem } from '@/lib/apps';

import { AppCard } from './AppCard';

interface BrowseAppsClientProps {
  apps: SnapshotAppIndexItem[];
  categories: Array<{ name: string; count: number }>;
}

type SortMode = 'updated' | 'name' | 'risk';

const PAGE_SIZE = 12;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function BrowseAppsClient({ apps, categories }: BrowseAppsClientProps): JSX.Element {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const keyword = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const risk = (searchParams.get('risk') ?? '') as RiskLevel | '';
  const sort = (searchParams.get('sort') ?? 'updated') as SortMode;
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  function updateQueryParam(name: string, value: string): void {
    const next = new URLSearchParams(searchParams.toString());

    if (!value) {
      next.delete(name);
    } else {
      next.set(name, value);
    }

    if (name !== 'page') {
      next.delete('page');
    }

    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const filtered = useMemo(() => {
    const normalizedKeyword = normalize(keyword);

    const result = apps.filter((app) => {
      if (category && app.category !== category) {
        return false;
      }

      if (risk && app.riskLevel !== risk) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      const haystack = [app.name, app.category ?? '', app.developer ?? '', app.oneLineSummary]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedKeyword);
    });

    result.sort((a, b) => {
      if (sort === 'name') {
        return a.name.localeCompare(b.name);
      }

      if (sort === 'risk') {
        const scoreGap = b.riskScore - a.riskScore;
        if (scoreGap !== 0) {
          return scoreGap;
        }
      }

      return new Date(b.lastAnalyzedAt).getTime() - new Date(a.lastAnalyzedAt).getTime();
    });

    return result;
  }, [apps, category, keyword, risk, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const pagedApps = filtered.slice(offset, offset + PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <label className="text-sm text-slate-700">
          <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Search</span>
          <input
            type="search"
            value={keyword}
            onChange={(event) => updateQueryParam('q', event.currentTarget.value)}
            placeholder="Name / category / developer"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Category</span>
          <select
            value={category}
            onChange={(event) => updateQueryParam('category', event.currentTarget.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">All Categories</option>
            {categories.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name} ({item.count})
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Risk</span>
          <select
            value={risk}
            onChange={(event) => updateQueryParam('risk', event.currentTarget.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">All Levels</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="UNKNOWN">UNKNOWN</option>
          </select>
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Sort</span>
          <select
            value={sort}
            onChange={(event) => updateQueryParam('sort', event.currentTarget.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="updated">Recently Updated</option>
            <option value="risk">Risk Score</option>
            <option value="name">Name A-Z</option>
          </select>
        </label>
      </div>

      <p className="text-sm text-slate-600">
        Showing {pagedApps.length} of {filtered.length} apps.
      </p>

      {pagedApps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
          No apps matched this filter.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pagedApps.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <span className="text-slate-600">
          Page {currentPage} / {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => updateQueryParam('page', String(currentPage - 1))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => updateQueryParam('page', String(currentPage + 1))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
