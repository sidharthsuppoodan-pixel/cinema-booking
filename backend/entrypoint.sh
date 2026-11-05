#!/bin/sh
set -e

echo "[entrypoint] Waiting for PostgreSQL at ${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432}..."
python - <<'PY'
import os, sys, time
import psycopg2
for attempt in range(60):
    try:
        psycopg2.connect(
            host=os.environ.get("POSTGRES_HOST", "db"),
            port=int(os.environ.get("POSTGRES_PORT", "5432")),
            user=os.environ["POSTGRES_USER"],
            password=os.environ["POSTGRES_PASSWORD"],
            dbname=os.environ["POSTGRES_DB"],
            connect_timeout=3,
        ).close()
        print("[entrypoint] Database is ready")
        sys.exit(0)
    except psycopg2.OperationalError:
        time.sleep(2)
print("[entrypoint] Database not reachable, giving up", file=sys.stderr)
sys.exit(1)
PY

echo "[entrypoint] Applying database migrations..."
alembic upgrade head

echo "[entrypoint] Seeding bootstrap data..."
python -m app.services.seed

echo "[entrypoint] Starting API server"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers "${UVICORN_WORKERS:-2}" --proxy-headers --forwarded-allow-ips="*"
