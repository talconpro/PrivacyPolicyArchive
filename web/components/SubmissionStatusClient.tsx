'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchSubmissionStatus } from '@/lib/submissionApi';

type SubmissionRecord = Record<string, unknown>;

interface SubmissionStatusClientProps {
  initialSubmissionId?: string;
}

export function SubmissionStatusClient({ initialSubmissionId }: SubmissionStatusClientProps): JSX.Element {
  const searchParams = useSearchParams();
  const querySubmissionId = useMemo(() => searchParams.get('id') ?? '', [searchParams]);
  const [submissionId, setSubmissionId] = useState(initialSubmissionId ?? querySubmissionId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<SubmissionRecord | null>(null);

  const loadStatus = useCallback(async (targetId: string): Promise<void> => {
    if (!targetId.trim()) {
      setError('请输入 submissionId');
      setRecord(null);
      return;
    }

    setLoading(true);
    setError(null);
    setRecord(null);

    try {
      const result = await fetchSubmissionStatus(targetId.trim());
      setRecord(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '查询失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialSubmissionId && !querySubmissionId) {
      setSubmissionId(initialSubmissionId);
      void loadStatus(initialSubmissionId);
      return;
    }

    if (querySubmissionId) {
      setSubmissionId(querySubmissionId);
      void loadStatus(querySubmissionId);
    }
  }, [initialSubmissionId, loadStatus, querySubmissionId]);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <label className="block text-sm text-slate-700">
          Submission ID
          <input
            value={submissionId}
            onChange={(event) => setSubmissionId(event.currentTarget.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="button"
          disabled={loading}
          onClick={() => void loadStatus(submissionId)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? '查询中...' : '查询状态'}
        </button>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {record ? (
        <dl className="grid gap-2 text-sm">
          <div className="grid grid-cols-[140px_1fr] gap-3">
            <dt className="text-slate-500">App</dt>
            <dd className="text-slate-900">{String(record.appName ?? '')}</dd>
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-3">
            <dt className="text-slate-500">Status</dt>
            <dd className="text-slate-900">{String(record.status ?? '')}</dd>
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-3">
            <dt className="text-slate-500">Created At</dt>
            <dd className="text-slate-900">{String(record.createdAt ?? '')}</dd>
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-3">
            <dt className="text-slate-500">Processed At</dt>
            <dd className="text-slate-900">{String(record.processedAt ?? '-')}</dd>
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-3">
            <dt className="text-slate-500">Admin Note</dt>
            <dd className="text-slate-900">{String(record.adminNote ?? '-')}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
