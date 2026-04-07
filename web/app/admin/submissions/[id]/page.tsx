import Link from 'next/link';
import type { Metadata } from 'next';

import { AdminSubmissionDetailClient } from '@/components/AdminSubmissionDetailClient';

export const dynamic = 'force-static';
export const dynamicParams = false;

interface AdminSubmissionDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export function generateStaticParams(): Array<{ id: string }> {
  return [{ id: '__placeholder__' }];
}

export async function generateMetadata({ params }: AdminSubmissionDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Admin Submission ${id} | Privacy Policy Archive`,
    description: 'Moderate a submitted app entry.',
  };
}

export default async function AdminSubmissionDetailPage({
  params,
}: AdminSubmissionDetailPageProps): Promise<JSX.Element> {
  const { id } = await params;

  if (id === '__placeholder__') {
    return (
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Admin Submission Detail</h1>
        <p className="text-sm text-slate-600">
          This static export contains a placeholder route. Open a concrete submission in local/admin environment:
        </p>
        <Link href="/admin/submissions" className="text-sm font-medium text-slate-900 underline underline-offset-2">
          Back to Admin List
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Admin · Submission Detail</h1>
        <p className="text-sm text-slate-600">Submission ID: {id}</p>
      </header>
      <AdminSubmissionDetailClient submissionId={id} />
    </div>
  );
}
