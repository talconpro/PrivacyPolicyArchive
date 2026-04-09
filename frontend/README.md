# Frontend (Vue3 + Vite)

## Run

```powershell
npm install
npm run dev
```

## Build

```powershell
npm run build
```

## Deploy (GitHub Actions + GitHub Pages)

- Workflow file: `.github/workflows/frontend-deploy.yml`
- Trigger: push to `main` (when `frontend/**` changes) or manual `workflow_dispatch`
- Deploy target: GitHub Pages

Optional repo variables:

- `VITE_API_BASE_URL` (example: `https://api.example.com/api`)
- `VITE_BASE_PATH` (example: `/` or `/privacy-policy-archive/`)

## Config Split

### 1) API and build config (`.env`)

- `VITE_API_BASE_URL`: API base path, default `/api`
- `VITE_BASE_PATH`: Vite base path, default `/`

### 2) Frontend static config (`src/config/settings.ts`)

- `siteName`
- `siteShortName`
- `siteTagline`
- `adminEntryLabel`
- `riskShow`
- `navShow`
- `repositoryUrl`
- `apkMaxUploadMb` (frontend fallback display value)

### 3) Runtime site config (from backend `/api/site-settings`)

- `showAppIcon`
- `legalDisclaimerShort`
- `disclaimerNoAdviceNotice`
- `disclaimerAccuracyNotice`
- `disclaimerTrademarkNotice`
- `disclaimerRightsContactNotice`
- `dataSourceNotice`
- `aiAnalysisNotice`
- `iconUsageNotice`
- `contactEmail`
- `appealSlaDays`
