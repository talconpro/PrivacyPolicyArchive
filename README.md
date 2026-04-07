# Privacy Policy Archive

A monorepo project for collecting, versioning, and analyzing app privacy policy changes.

## Tech Stack

- Node.js 20+
- TypeScript
- Prisma + SQLite
- Next.js App Router + TailwindCSS
- pnpm

## Project Structure

- `prisma/`: schema and migrations
- `scripts/`: pipeline and utility scripts
- `src/crawler/`: policy fetch and extraction
- `src/analyzer/`: LLM analysis, normalization, risk scoring
- `src/lib/`: shared helpers (logger, prisma, snapshot)
- `web/app/`: Next.js routes and pages
- `web/lib/generated/`: build-time JSON snapshot for static pages
- `docs/`: project documentation

## Setup

```bash
nvm use
pnpm install
cp .env.example .env
```

`.env` example:

```bash
DATABASE_URL=file:./prisma/dev.db
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

## Database Init

```bash
pnpm prisma:migrate --name init
pnpm prisma:generate
```

## Local Commands

```bash
pnpm dev                 # run web
pnpm run update:policies # run discover/fetch/analyze/version/snapshot pipeline
pnpm run submissions:process # process pending user submissions -> needs review
pnpm run submission:server   # start independent submission/admin API server
pnpm review:queue        # list pending manual review items
pnpm preflight           # run launch quality checks
pnpm test                # run unit tests
pnpm typecheck           # run TS type checks
pnpm build               # build Next.js static output
```

## Submission & Review Backend (Independent Service)

This project keeps static Pages deployment for `web/` and runs submission/review APIs in a separate Node service.

- API base URL for frontend: `NEXT_PUBLIC_SUBMISSION_API_BASE`
- Start backend locally: `pnpm run submission:server`
- Default local API port: `8787`

### API Endpoints

- `GET /api/captcha/challenge`
- `POST /api/submit`
- `GET /api/submissions/:id`
- `GET /api/admin/submissions` (Bearer `ADMIN_TOKEN`)
- `GET /api/admin/submissions/:id` (Bearer `ADMIN_TOKEN`)
- `POST /api/admin/submissions/:id/approve` (Bearer `ADMIN_TOKEN`)
- `POST /api/admin/submissions/:id/reject` (Bearer `ADMIN_TOKEN`)

## Weekly Auto Update (GitHub Actions)

Workflow file: `.github/workflows/update.yml`

It runs every week and on manual dispatch:

1. install dependencies
2. run Prisma commands
3. run `scripts/processSubmissions.ts`
4. run `scripts/runUpdate.ts`
5. run `scripts/preflight.ts` (soft-fail mode)
6. build Next.js site
7. auto-commit `web/lib/generated/*` when snapshot changes are detected

### Required GitHub Secrets

- `DEEPSEEK_API_KEY`: API key for analysis
- `DEEPSEEK_BASE_URL`: optional custom API endpoint (default DeepSeek)
- `DEEPSEEK_MODEL`: model name
- `NEXT_PUBLIC_SITE_URL`: production site URL used by sitemap/robots
- `ADMIN_TOKEN`: token for admin moderation API
- `SUBMISSION_IP_SALT`: salt value for IP hashing and submission rate limit
- `NEXT_PUBLIC_SUBMISSION_API_BASE`: public URL of submission API service

## GitHub Pages Deployment

Workflow file: `.github/workflows/deploy-pages.yml`

It deploys on every push to `main` (and manual trigger) using GitHub Actions Pages deployment.

### One-time repo setup

1. Open repository `Settings -> Pages`.
2. Set **Source** to **GitHub Actions**.
3. Ensure default branch is `main`.

### Notes

- Next.js is configured with static export (`output: export`).
- For project pages (`owner/repo`), base path is auto-derived from repository name in Actions.
- For user/org pages (`owner.github.io` repo), root path deployment is used automatically.

## Release Checklist

1. `pnpm prisma:generate`
2. `pnpm run submissions:process`
3. `pnpm run update:policies`
4. `pnpm preflight` (set `PREFLIGHT_SOFT_FAIL=0` for hard fail)
5. `pnpm test`
6. `pnpm typecheck`
7. `pnpm build`
8. review generated data under `web/lib/generated/`

## Preflight Options

- `PREFLIGHT_SOFT_FAIL=1`: report issues without failing process
- `PREFLIGHT_SKIP_LINK_CHECK=1`: skip official link reachability checks

## Disclaimer

Analysis is AI-assisted and for informational reference only. It is not legal advice.
