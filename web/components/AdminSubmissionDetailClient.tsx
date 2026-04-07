'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  approveAdminSubmission,
  fetchAdminSubmissionDetail,
  rejectAdminSubmission,
} from '@/lib/submissionApi';

interface AdminSubmissionDetailClientProps {
  submissionId: string;
}

type SubmissionDetail = Record<string, unknown>;
type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';

export function AdminSubmissionDetailClient({ submissionId }: AdminSubmissionDetailClientProps): JSX.Element {
  const [token, setToken] = useState('');
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [oneLineSummary, setOneLineSummary] = useState('');
  const [plainSummary, setPlainSummary] = useState('');
  const [riskScore, setRiskScore] = useState('');
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('UNKNOWN');

  useEffect(() => {
    const cached = globalThis.localStorage?.getItem('ppa_admin_token');
    if (cached) {
      setToken(cached);
    }
  }, []);

  const load = useCallback(async (): Promise<void> => {
    if (!token.trim()) {
      setError('请输入管理员 token');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchAdminSubmissionDetail(token.trim(), submissionId);
      setDetail(result);
      globalThis.localStorage?.setItem('ppa_admin_token', token.trim());

      const reviewPayload = typeof result.reviewPayload === 'string' ? result.reviewPayload : '';
      if (reviewPayload) {
        try {
          const parsed = JSON.parse(reviewPayload) as Record<string, unknown>;
          const analysis = (parsed.analysis as Record<string, unknown> | undefined) ?? {};
          const scoring = (parsed.scoring as Record<string, unknown> | undefined) ?? {};

          setOneLineSummary(String(analysis.oneLineSummary ?? ''));
          setPlainSummary(String(analysis.plainSummary ?? ''));

          const initialRiskScore = scoring.riskScore;
          const initialRiskLevel = scoring.riskLevel;
          if (typeof initialRiskScore === 'number') {
            setRiskScore(String(initialRiskScore));
          }
          if (
            initialRiskLevel === 'LOW' ||
            initialRiskLevel === 'MEDIUM' ||
            initialRiskLevel === 'HIGH' ||
            initialRiskLevel === 'CRITICAL' ||
            initialRiskLevel === 'UNKNOWN'
          ) {
            setRiskLevel(initialRiskLevel);
          }
        } catch {
          // Ignore payload parse errors and keep editable fields blank.
        }
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [submissionId, token]);

  useEffect(() => {
    if (token && submissionId) {
      void load();
    }
  }, [load, submissionId, token]);

  async function approve(): Promise<void> {
    if (!token.trim()) {
      setError('请输入管理员 token');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const parsedRiskScore = riskScore.trim() ? Number(riskScore.trim()) : undefined;
      await approveAdminSubmission(token.trim(), submissionId, {
        adminNote: adminNote || undefined,
        override: {
          oneLineSummary: oneLineSummary.trim() || undefined,
          plainSummary: plainSummary.trim() || undefined,
          riskScore: Number.isFinite(parsedRiskScore) ? parsedRiskScore : undefined,
          riskLevel,
        },
      });
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '审核通过失败');
    } finally {
      setActionLoading(false);
    }
  }

  async function reject(): Promise<void> {
    if (!token.trim()) {
      setError('请输入管理员 token');
      return;
    }

    if (!adminNote.trim()) {
      setError('拒绝时必须填写 adminNote');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      await rejectAdminSubmission(token.trim(), submissionId, {
        adminNote: adminNote.trim(),
      });
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '拒绝失败');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm text-slate-700">
          Admin Bearer Token
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.currentTarget.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? 'Loading...' : 'Load'}
        </button>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {detail ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Submission Detail</h2>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
              {JSON.stringify(detail, null, 2)}
            </pre>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="block text-sm text-slate-700">
              Admin Note
              <textarea
                value={adminNote}
                onChange={(event) => setAdminNote(event.currentTarget.value)}
                className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="mt-3 block text-sm text-slate-700">
              一句话总结（可编辑）
              <input
                value={oneLineSummary}
                onChange={(event) => setOneLineSummary(event.currentTarget.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="mt-3 block text-sm text-slate-700">
              白话摘要（可编辑）
              <textarea
                value={plainSummary}
                onChange={(event) => setPlainSummary(event.currentTarget.value)}
                className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block text-sm text-slate-700">
                风险分（0-100）
                <input
                  value={riskScore}
                  onChange={(event) => setRiskScore(event.currentTarget.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="block text-sm text-slate-700">
                风险等级
                <select
                  value={riskLevel}
                  onChange={(event) => setRiskLevel(event.currentTarget.value as RiskLevel)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="UNKNOWN">UNKNOWN</option>
                </select>
              </label>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void approve()}
                disabled={actionLoading}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                通过
              </button>
              <button
                type="button"
                onClick={() => void reject()}
                disabled={actionLoading}
                className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                拒绝
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
