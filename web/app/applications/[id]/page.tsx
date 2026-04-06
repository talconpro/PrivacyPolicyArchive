import { redirect } from 'next/navigation';

import { getAppsIndex } from '@/lib/apps';

export const dynamic = 'force-static';
export const dynamicParams = false;

interface LegacyAppDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export function generateStaticParams(): Array<{ id: string }> {
  return getAppsIndex().map((app) => ({ id: app.slug || app.id }));
}

export default async function LegacyAppDetailPage({ params }: LegacyAppDetailPageProps): Promise<never> {
  const { id } = await params;
  redirect(`/apps/${id}`);
}
