'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchCaptchaChallenge, submitApp } from '@/lib/submissionApi';

interface SubmitState {
  appName: string;
  privacyUrl: string;
  termsUrl: string;
  submitterEmail: string;
  remark: string;
  captchaId: string;
  captchaQuestion: string;
  captchaAnswer: string;
  captchaExpiresAt: string;
}

const INITIAL_STATE: SubmitState = {
  appName: '',
  privacyUrl: '',
  termsUrl: '',
  submitterEmail: '',
  remark: '',
  captchaId: '',
  captchaQuestion: '',
  captchaAnswer: '',
  captchaExpiresAt: '',
};

export function SubmitAppForm(): JSX.Element {
  const [form, setForm] = useState<SubmitState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successSubmissionId, setSuccessSubmissionId] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const prefillAppName = searchParams.get('appName') ?? '';
  const prefillPrivacyUrl = searchParams.get('privacyUrl') ?? '';

  const statusHref = useMemo(() => {
    if (!successSubmissionId) {
      return '/submissions';
    }

    return `/submissions?id=${encodeURIComponent(successSubmissionId)}`;
  }, [successSubmissionId]);

  const reloadCaptcha = useCallback(async (): Promise<void> => {
    try {
      const challenge = await fetchCaptchaChallenge();
      setError(null);
      setForm((prev) => ({
        ...prev,
        captchaId: challenge.captchaId,
        captchaQuestion: challenge.question,
        captchaExpiresAt: challenge.expiresAt,
        captchaAnswer: '',
      }));
    } catch (captchaError) {
      setError(captchaError instanceof Error ? captchaError.message : 'Captcha 加载失败。');
    }
  }, []);

  useEffect(() => {
    void reloadCaptcha();
  }, [reloadCaptcha]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      appName: prev.appName || prefillAppName,
      privacyUrl: prev.privacyUrl || prefillPrivacyUrl,
    }));
  }, [prefillAppName, prefillPrivacyUrl]);

  function update<K extends keyof SubmitState>(key: K, value: SubmitState[K]): void {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessSubmissionId(null);

    try {
      const result = await submitApp({
        appName: form.appName,
        privacyUrl: form.privacyUrl,
        termsUrl: form.termsUrl || undefined,
        submitterEmail: form.submitterEmail || undefined,
        remark: form.remark || undefined,
        captchaId: form.captchaId,
        captchaAnswer: form.captchaAnswer,
      });

      setSuccessSubmissionId(result.submissionId);
      await reloadCaptcha();
      setForm((prev) => ({
        ...prev,
        captchaAnswer: '',
      }));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Submit failed.');
      await reloadCaptcha();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm text-slate-700">
          App 名称 *
          <input
            required
            value={form.appName}
            onChange={(event) => update('appName', event.currentTarget.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="block text-sm text-slate-700">
          隐私政策链接 *
          <input
            required
            type="url"
            value={form.privacyUrl}
            onChange={(event) => update('privacyUrl', event.currentTarget.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="block text-sm text-slate-700">
          用户协议链接（选填）
          <input
            type="url"
            value={form.termsUrl}
            onChange={(event) => update('termsUrl', event.currentTarget.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="block text-sm text-slate-700">
          提交人邮箱（选填）
          <input
            type="email"
            value={form.submitterEmail}
            onChange={(event) => update('submitterEmail', event.currentTarget.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="block text-sm text-slate-700">
          备注（选填）
          <textarea
            value={form.remark}
            onChange={(event) => update('remark', event.currentTarget.value)}
            className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">
            人机校验（{form.captchaExpiresAt ? `有效至 ${new Date(form.captchaExpiresAt).toLocaleTimeString('en-US', { hour12: false })}` : '加载中'})
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">{form.captchaQuestion || 'Loading captcha...'}</p>
          <input
            required
            value={form.captchaAnswer}
            onChange={(event) => update('captchaAnswer', event.currentTarget.value)}
            placeholder="请输入答案"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
          <button
            type="button"
            onClick={() => void reloadCaptcha()}
            className="mt-2 text-xs font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
          >
            换一题
          </button>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? '提交中...' : '提交未收录 App'}
        </button>
      </form>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {successSubmissionId ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <p>提交成功，submissionId: {successSubmissionId}</p>
          <Link href={statusHref} className="mt-2 inline-block font-medium underline underline-offset-2">
            查看处理状态
          </Link>
        </div>
      ) : null}
    </div>
  );
}
