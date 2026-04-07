import Link from 'next/link';
import type { Metadata } from 'next';

import { SubmissionStatusClient } from '@/components/SubmissionStatusClient';

export const dynamic = 'force-static';
export const dynamicParams = false;

interface SubmissionStatusDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export function generateStaticParams(): Array<{ id: string }> {
  return [{ id: '__placeholder__' }];
}

export async function generateMetadata({ params }: SubmissionStatusDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Submission ${id} | Privacy Policy Archive`,
    description: 'Check submission processing status.',
  };
}

export default async function SubmissionStatusDetailPage({
  params,
}: SubmissionStatusDetailPageProps): Promise<JSX.Element> {
  const { id } = await params;

  if (id === '__placeholder__') {
    return (
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Submission Status</h1>
        <p className="text-sm text-slate-600">
          This static export contains a placeholder route. Use query mode in production static site:
        </p>
        <Link href="/submissions" className="text-sm font-medium text-slate-900 underline underline-offset-2">
          /submissions?id=your_submission_id
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">提交状态详情</h1>
        <p className="text-sm text-slate-600">Submission ID: {id}</p>
      </header>
      <SubmissionStatusClient initialSubmissionId={id} />
    </div>
  );
}
