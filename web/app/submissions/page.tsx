import type { Metadata } from 'next';

import { SubmissionStatusClient } from '@/components/SubmissionStatusClient';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: '提交状态查询 | Privacy Policy Archive',
  description: 'Check submission processing status by submission ID.',
};

export default function SubmissionStatusPage(): JSX.Element {
  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">提交状态查询</h1>
        <p className="text-sm text-slate-600">输入 submissionId 查看当前状态与处理结果。</p>
      </header>
      <SubmissionStatusClient />
    </div>
  );
}
