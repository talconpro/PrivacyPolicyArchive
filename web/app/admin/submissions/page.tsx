import type { Metadata } from 'next';

import { AdminSubmissionsListClient } from '@/components/AdminSubmissionsListClient';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Admin Submissions | Privacy Policy Archive',
  description: 'Review and moderate user-submitted app entries.',
};

export default function AdminSubmissionsPage(): JSX.Element {
  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Admin · Submissions</h1>
        <p className="text-sm text-slate-600">查看待审核提交，进入详情执行通过或拒绝。</p>
      </header>
      <AdminSubmissionsListClient />
    </div>
  );
}
