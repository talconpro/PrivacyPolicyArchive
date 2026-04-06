import type { MetadataRoute } from 'next';

import { getAppsIndex } from '@/lib/apps';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    '/',
    '/apps',
    '/compare',
    '/about',
    '/methodology',
    '/disclaimer',
    '/contact',
  ].map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
  }));

  const appPages: MetadataRoute.Sitemap = getAppsIndex().map((app) => ({
    url: `${BASE_URL}/apps/${app.slug || app.id}`,
    lastModified: new Date(app.lastAnalyzedAt),
  }));

  return [...staticPages, ...appPages];
}
