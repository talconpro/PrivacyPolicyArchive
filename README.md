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
pnpm review:queue        # list pending manual review items
pnpm preflight           # run launch quality checks
pnpm test                # run unit tests
pnpm typecheck           # run TS type checks
pnpm build               # build Next.js static output
```

## Weekly Auto Update (GitHub Actions)

Workflow file: `.github/workflows/update.yml`

It runs every week and on manual dispatch:

1. install dependencies
2. run Prisma commands
3. run `scripts/runUpdate.ts`
4. run `scripts/preflight.ts` (soft-fail mode)
5. build Next.js site
6. auto-commit `web/lib/generated/*` when snapshot changes are detected

### Required GitHub Secrets

- `DEEPSEEK_API_KEY`: API key for analysis
- `DEEPSEEK_BASE_URL`: optional custom API endpoint (default DeepSeek)
- `DEEPSEEK_MODEL`: model name
- `NEXT_PUBLIC_SITE_URL`: production site URL used by sitemap/robots

## Release Checklist

1. `pnpm prisma:generate`
2. `pnpm run update:policies`
3. `pnpm preflight` (set `PREFLIGHT_SOFT_FAIL=0` for hard fail)
4. `pnpm test`
5. `pnpm typecheck`
6. `pnpm build`
7. review generated data under `web/lib/generated/`

## Preflight Options

- `PREFLIGHT_SOFT_FAIL=1`: report issues without failing process
- `PREFLIGHT_SKIP_LINK_CHECK=1`: skip official link reachability checks

## Disclaimer

Analysis is AI-assisted and for informational reference only. It is not legal advice.
