# Production Readiness

This checklist is for an internet-facing CyberTabletop deployment.

## Required Secrets

Generate fresh production-only values before launch:

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `SESSION_SECRET`
- `MFA_ENCRYPTION_KEY`
- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `INVITE_CODE`

`MFA_ENCRYPTION_KEY` must be a 32-byte base64 value. Example:

```sh
openssl rand -base64 32
```

## MFA

CyberTabletop enforces local TOTP MFA for:

- `SUPER_ADMIN`
- `ORG_ADMIN`
- `FACILITATOR`

Players may enable MFA from Profile, but it is not mandatory. Privileged users without MFA are forced into setup before they can access application features. TOTP secrets are encrypted with `MFA_ENCRYPTION_KEY`; recovery codes are shown once and stored only as bcrypt hashes.

## Database Migrations

The backend container runs Prisma migrations before starting the API:

```sh
npx prisma migrate deploy && node dist/index.js
```

If you run migrations manually:

```sh
docker compose run --rm backend npx prisma migrate deploy
```

## Backups

Create a backup:

```sh
./scripts/backup.sh
```

On Windows PowerShell:

```powershell
.\scripts\backup.ps1
```

Restore into the running PostgreSQL container:

```sh
./scripts/restore.sh ./backups/cybertabletop-YYYYMMDDTHHMMSSZ.sql.gz
```

On Windows PowerShell:

```powershell
.\scripts\restore.ps1 -BackupFile .\backups\cybertabletop-YYYYMMDDTHHMMSSZ.sql.zip
```

Backups are not a control until restore has been tested. Test restore into a clean stack before production use.

## Final Gate

Before public launch, verify:

- `npm test` passes in `backend`
- `npm test` passes in `frontend`
- `npm run lint` passes in `frontend`
- `npm run build` passes in `backend` and `frontend`
- `npm run e2e` passes in `frontend`
- `npm audit --audit-level=moderate` reports no actionable findings
- Docker containers are healthy
- `/health` returns OK through the public endpoint
- Only nginx is exposed externally
- HTTPS uses a trusted certificate
- `FRONTEND_URL` and `CORS_ORIGINS` match the real domain
- If the public app is not embedded in another portal, add clickjacking protection at the public edge, such as `Content-Security-Policy: frame-ancestors 'none'`
- privileged MFA coverage is 100% in the Security Dashboard
- a database backup has been restored successfully
