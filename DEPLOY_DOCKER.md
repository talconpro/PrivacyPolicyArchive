# Docker Compose Deployment

This project can run with one command using:
- `frontend` (Vue + Nginx)
- `backend` (FastAPI + Alembic migration on startup)
- `db` (PostgreSQL)

## 1) Prepare env

```bash
cp docker-compose.env.example .env
```

Recommended updates in `.env`:
- `POSTGRES_PASSWORD`
- `ADMIN_PASSWORD`
- `JWT_SECRET`
- `DEEPSEEK_API_KEY` (if AI analysis is required)

## 2) Start

```bash
docker compose up -d --build
```

## 3) Access

- Frontend: `http://localhost:${FRONTEND_PORT}` (default `http://localhost:20320`)
- API health: `http://localhost:${FRONTEND_PORT}/api/health`

## Notes

- Frontend calls `/api/*` and Nginx proxies to `backend:8000`.
- Backend runs `alembic upgrade head` automatically before app startup.
- Set `SEED_SAMPLE_DATA=true` to auto-run `python scripts/seed_sample_data.py`.
- If you enable HTTPS and cross-site cookies, switch `APP_ENV=production`.

## Stop

```bash
docker compose down
```

Remove DB volume too:

```bash
docker compose down -v
```
