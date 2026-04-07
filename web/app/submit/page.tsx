import type { Metadata } from 'next';

import { SubmitAppForm } from '@/components/SubmitAppForm';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: '提交未收录 App | Privacy Policy Archive',
  description: 'Submit a missing app privacy policy for review and analysis.',
};

export default function SubmitPage(): JSX.Element {
  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">提交未收录 App</h1>
        <p className="text-sm text-slate-600">
          提交后系统会自动抓取与分析，并进入待审核池。审核通过后会在站点公开展示。
        </p>
      </header>
      <SubmitAppForm />
    </div>
  );
}
