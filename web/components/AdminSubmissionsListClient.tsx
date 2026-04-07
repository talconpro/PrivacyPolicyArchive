'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { fetchAdminSubmissions, type SubmissionStatus } from '@/lib/submissionApi';

type SubmissionListItem = Record<string, unknown>;

const STATUS_OPTIONS: Array<SubmissionStatus | ''> = ['', 'PENDING', 'PROCESSING', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'DUPLICATE'];

export function AdminSubmissionsListClient(): JSX.Element {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<SubmissionStatus | ''>('NEEDS_REVIEW');
  const [items, setItems] = useState<SubmissionListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = globalThis.localStorage?.getItem('ppa_admin_token');
    if (cached) {
      setToken(cached);
    }
  }, []);

  async function load(): Promise<void> {
    if (!token.trim()) {
      setError('请输入管理员 token');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const list = await fetchAdminSubmissions(token.trim(), status || undefined);
      setItems(list);
      globalThis.localStorage?.setItem('ppa_admin_token', token.trim());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_140px]">
          <label className="text-sm text-slate-700">
            Admin Bearer Token
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.currentTarget.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm text-slate-700">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.currentTarget.value as SubmissionStatus | '')}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {STATUS_OPTIONS.map((item) => (
                <option key={item || 'ALL'} value={item}>
                  {item || 'ALL'}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading ? 'Loading...' : 'Load'}
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">App</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={5}>
                  No submissions loaded.
                </td>
              </tr>
            ) : null}

            {items.map((item) => {
              const id = String(item.id ?? '');
              const appName = String(item.appName ?? '');
              const itemStatus = String(item.status ?? '');
              const riskLevel = String(item.riskLevel ?? '-');
              const createdAt = String(item.createdAt ?? '');

              return (
                <tr key={id}>
                  <td className="px-4 py-3 text-slate-900">{appName}</td>
                  <td className="px-4 py-3 text-slate-700">{itemStatus}</td>
                  <td className="px-4 py-3 text-slate-700">{riskLevel}</td>
                  <td className="px-4 py-3 text-slate-700">{createdAt}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/submissions/${id}`} className="font-medium text-slate-900 underline underline-offset-2">
                      Review
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
