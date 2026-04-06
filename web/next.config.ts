import type { NextConfig } from 'next';

const isGithubActions = process.env.GITHUB_ACTIONS === 'true';
const repository = process.env.GITHUB_REPOSITORY ?? '';
const repoName = repository.split('/')[1] ?? '';
const isUserSiteRepo = repoName.endsWith('.github.io');
const basePath = isGithubActions && repoName && !isUserSiteRepo ? `/${repoName}` : '';

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },
  output: 'export',
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
