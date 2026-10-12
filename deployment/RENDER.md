# Render backend deployment

Configure the existing Render web service with these values:

- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `bash scripts/start-production.sh`
- Health Check Path: `/api/health/live`

The liveness endpoint confirms that the API process can respond without waiting
for a database query. Use `/api/health` when you want to verify both the API and
its database connection.

The startup script runs `alembic upgrade head` before starting Uvicorn. Alembic
upgrades are idempotent, so every deployment safely applies only migrations that
have not already run. If a migration fails, the service does not start with code
that expects a newer database schema.

Set these non-secret production environment values in Render:

```text
APP_ENV=production
DEBUG=false
HOST=0.0.0.0
FRONTEND_ORIGINS=https://johnpaul-joyce-wedding.pages.dev
VENUE_CAPACITY=150
LOG_DIRECTORY=/tmp/wedding-rsvp/logs
UPLOAD_DIRECTORY=/tmp/wedding-rsvp/uploads
```

Keep database passwords, JWT secrets, and refresh secrets in Render's Environment
settings. Never add their values to this repository.
