# MPTV Project Management

Production-oriented refactor with:

- Backend: FastAPI + SQLAlchemy + Alembic + PostgreSQL
- Storage: S3-compatible object storage (MinIO by default)
- Frontend: React + TypeScript + Vite
- Auth: Access JWT only (no refresh token)

## What Changed

- SQLite replaced by PostgreSQL (`psycopg`).
- Attachments moved from local disk to S3/MinIO (`bucket/key` metadata in DB).
- Runtime `create_all` removed, schema managed by Alembic migrations.
- Unified API error envelope:
  - `{ "error": { "code", "message", "details" }, "request_id": "..." }`
- List endpoints now return paginated envelopes:
  - `{ items, total, page, page_size }`
- Task update API is now `PATCH /tasks/{task_id}`.
- File download API is now `GET /files/{attachment_id}/download-url`.
- Added request ID middleware, JSON access logs, `/health`, `/ready`, `/metrics`.

## Quick Start (Docker Compose)

```bash
cd pms_system
docker compose up -d --build
```

Services:

- Frontend: http://localhost:5173
- Backend docs: http://localhost:8000/docs
- MinIO API: http://localhost:9000
- MinIO console: http://localhost:9001

`docker-compose.yml` includes `frontend + backend + postgres + minio` with health checks and startup ordering.

### Seed Demo Account (Docker)

The system does not auto-create users on startup.  
Run this once to create demo data (including `admin / 123456`):

```bash
docker exec mptv_backend python -m app.seed_command --with-storage
```

## Local Development

### 1) Backend

```bash
cd pms_system/backend
pip install -r requirements.txt
```

Create `.env` from `.env.example` and adjust values.

Run migrations:

```bash
alembic upgrade head
```

Start API:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Optional seed (dev/demo only, explicit command):

```bash
python -m app.seed_command --with-storage
```

### 2) Frontend

```bash
cd pms_system/frontend
npm install
npm run dev
```

## Required Runtime Env (Production)

When `APP_ENV=prod`, the backend enforces:

- Explicit non-default `JWT_SECRET_KEY`
- PostgreSQL `DATABASE_URL`
- Explicit S3 endpoint/bucket/access key/secret
- Non-empty `CORS_ORIGINS` allowlist

## Health and Observability

- `GET /health`: liveness
- `GET /ready`: readiness (DB + S3 checks, returns `503` when not ready)
- `GET /metrics`: Prometheus metrics

All responses include `X-Request-ID`; logs are JSON and include request metadata.

## Smoke Tests

Run backend smoke tests:

```bash
cd pms_system/backend
pytest -q
```

Covered flows:

- register/login/me
- project + task create/update/delete
- attachment upload/download-url/delete
- weekly report
- unauthorized and cross-user access
- CORS allowlist behavior

## Frontend Build Gate

```bash
cd pms_system/frontend
npm run build
```
