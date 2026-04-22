# CyberTabletop Installation Guide

This guide covers the supported ways to install and run CyberTabletop.

## Choose an Install Path

| Path | Best for | Builds source locally? | Requires Node on host? |
| --- | --- | --- | --- |
| Prebuilt Docker images | Most users, fastest install | No | No |
| Source-build Docker Compose | Developers, reviewers, local changes | Yes | No |
| Full installer scripts | New machines that need prerequisites | Depends | Script may install Node/Git/Docker |
| Production behind an edge proxy | Internet-facing deployments | Optional | No |

The recommended path for most users is the prebuilt Docker image path.

## Common Requirements

All install paths require:

- Docker Desktop on Windows/macOS, or Docker Engine on Linux
- Docker Compose v2
- OpenSSL only if you use the Linux/macOS bootstrap script to generate local TLS certificates

On Windows, `scripts/bootstrap.ps1` uses local OpenSSL when it is available. If
OpenSSL is not installed, it uses Docker to run an OpenSSL container for local
certificate generation.

CyberTabletop is not Windows-only. The application runs in Linux containers and works on Windows, macOS, and Linux hosts that can run Docker.

## Files You Must Provide Locally

These files are intentionally not committed to GitHub:

- `.env`
- `nginx/ssl/cert.pem`
- `nginx/ssl/key.pem`

The `.env` file stores secrets and deployment settings. The TLS files contain your HTTPS certificate and private key.

## Path 1: Prebuilt Docker Images

This is the easiest install path.

### 1. Clone the repository

```bash
git clone https://github.com/DrDeathLabs/cybertabletop.git
cd cybertabletop
```

### 2. Bootstrap local config

Linux/macOS:

```bash
chmod +x scripts/bootstrap.sh
./scripts/bootstrap.sh
```

Windows PowerShell:

```powershell
.\scripts\bootstrap.ps1
```

The bootstrap script:

- creates `.env` from `.env.example`,
- generates random local secrets,
- prints the registration invite code,
- creates a local self-signed TLS certificate in `nginx/ssl/`.

Save the printed registration invite code. You need it when creating the first
administrator account. If you close the terminal, open `.env` and copy the value
of `INVITE_CODE`.

If you do not want to use the bootstrap script, manually copy `.env.example` to `.env`, replace every `CHANGE_ME` value, and provide `nginx/ssl/cert.pem` plus `nginx/ssl/key.pem`.

### 3. Pull and start

```bash
docker compose -p cybertabletop -f docker-compose.pull.yml pull
docker compose -p cybertabletop -f docker-compose.pull.yml up -d
```

### 4. Confirm automatic scenario setup

The backend container runs Prisma migrations and refreshes the built-in scripted
scenario library automatically before starting the API. No separate seed command
is required.

### 5. Open the app and create the first admin account

Open:

```text
https://localhost
```

Your browser will warn about the self-signed certificate. That is expected for local development. Use a real CA-issued certificate for production.

Register the first user account. The first non-system account automatically
becomes the `SUPER_ADMIN` account.

When the registration form asks for an invite code, enter the `INVITE_CODE`
created by the bootstrap script. It is stored in `.env`:

```env
INVITE_CODE=your-generated-code-here
```

This requirement is intentional. It prevents someone else from claiming the
first `SUPER_ADMIN` account if the app is exposed before you finish setup.

## Path 2: Build From Source With Docker Compose

Use this when you want to build the backend/frontend images locally.

```bash
git clone https://github.com/DrDeathLabs/cybertabletop.git
cd cybertabletop
./scripts/bootstrap.sh
docker compose -p cybertabletop up -d --build
```

Windows PowerShell:

```powershell
git clone https://github.com/DrDeathLabs/cybertabletop.git
cd cybertabletop
.\scripts\bootstrap.ps1
docker compose -p cybertabletop up -d --build
```

This path still does not require Node.js on the host because the Dockerfiles build the app inside containers.

After opening `https://localhost`, register the first user with the generated
`INVITE_CODE` from `.env`. That first non-system user becomes `SUPER_ADMIN`.

## Path 3: Optional Full Installer Scripts

The full installers are convenience helpers for new machines.

Windows:

```powershell
.\install.ps1
```

Linux/macOS:

```bash
chmod +x install.sh
./install.sh
```

These scripts attempt to check or install prerequisites such as Docker, Git, Node.js, and OpenSSL, then prepare local configuration. They are useful, but the Docker-first paths above are the canonical install paths.

If an installer fails, install Docker manually and use Path 1.

## Production Deployment Notes

For internet-facing use:

1. Use a real domain name.
2. Replace the self-signed certificate with a CA-issued certificate.
3. Set `FRONTEND_URL` and `CORS_ORIGINS` to the public HTTPS origin.
4. Keep `REQUIRE_INVITE=true`.
5. Use long random values for all secrets.
6. Restrict host access to Docker and the deployment directory.
7. Put CyberTabletop behind a trusted HTTPS edge if you use a cloud load balancer, Caddy, Traefik, Nginx Proxy Manager, Cloudflare Tunnel, or another reverse proxy.

### Exposing ports

By default, CyberTabletop binds only to localhost:

```env
HTTP_BIND=127.0.0.1
HTTPS_BIND=127.0.0.1
```

That is safe for local testing or a host-level reverse proxy.

To expose directly from the Docker host, set:

```env
HTTP_BIND=0.0.0.0
HTTPS_BIND=0.0.0.0
```

Only do this when the host firewall and TLS configuration are ready.

## Environment Reference

Important values in `.env`:

| Variable | Purpose |
| --- | --- |
| `POSTGRES_PASSWORD` | PostgreSQL database password |
| `REDIS_PASSWORD` | Redis password |
| `JWT_SECRET` | Access-token signing secret |
| `JWT_REFRESH_SECRET` | Refresh-token signing secret |
| `SESSION_SECRET` | Server session secret |
| `MFA_ENCRYPTION_KEY` | 32-byte base64 key for encrypting TOTP MFA secrets |
| `REQUIRE_INVITE` | Require invite code for registration |
| `INVITE_CODE` | Invite code users must enter during registration |
| `FRONTEND_URL` | Public frontend URL |
| `CORS_ORIGINS` | Allowed browser origins |
| `AI_PROVIDER` | `scripted`, `claude`, or `ollama` |
| `ANTHROPIC_API_KEY` | Required if `AI_PROVIDER=claude` |
| `OLLAMA_BASE_URL` | Ollama API URL if `AI_PROVIDER=ollama` |
| `OIDC_ISSUER_URL` | OIDC provider URL |
| `OIDC_CLIENT_ID` | OIDC client ID |
| `OIDC_CLIENT_SECRET` | OIDC client secret |

Use alphanumeric database and Redis passwords, or URL-encode special characters before embedding them in connection strings.

## Updating CyberTabletop

Prebuilt image path:

```bash
git pull
docker compose -p cybertabletop -f docker-compose.pull.yml pull
docker compose -p cybertabletop -f docker-compose.pull.yml up -d
```

Source-build path:

```bash
git pull
docker compose -p cybertabletop up -d --build
```

## Backup and Restore

### Back up PostgreSQL

```bash
./scripts/backup.sh
```

On Windows PowerShell:

```powershell
.\scripts\backup.ps1
```

### Restore PostgreSQL

```bash
./scripts/restore.sh ./backups/cybertabletop-YYYYMMDDTHHMMSSZ.sql.gz
```

On Windows PowerShell:

```powershell
.\scripts\restore.ps1 -BackupFile .\backups\cybertabletop-YYYYMMDDTHHMMSSZ.sql.zip
```

Test restores in a clean stack before relying on backups for production.

## Troubleshooting

### The app does not load

Check containers:

```bash
docker compose -p cybertabletop -f docker-compose.pull.yml ps
```

Check logs:

```bash
docker compose -p cybertabletop -f docker-compose.pull.yml logs --tail=100 nginx
docker compose -p cybertabletop -f docker-compose.pull.yml logs --tail=100 backend
```

Check health:

```bash
curl -k https://localhost/health
```

### Browser certificate warning

Expected when using generated local certs. Use a trusted certificate for production.

### Port already in use

Change ports in `.env`:

```env
HTTP_PORT=8080
HTTPS_PORT=8443
```

Then open `https://localhost:8443`.

### Pull fails with unauthorized

The GitHub Container Registry packages may not be public yet. Open the repository's Packages page in GitHub and set each CyberTabletop package visibility to public.

### Registration asks for an invite code on first setup

This is expected. The first non-system account becomes `SUPER_ADMIN`, so
registration is protected by the generated invite code.

Use the `INVITE_CODE` value in `.env`:

```powershell
Select-String -Path .env -Pattern '^INVITE_CODE='
```

Then enter that value into the registration form. Keep `REQUIRE_INVITE=true` for
internet-facing deployments.

### Database auth fails

Make sure `POSTGRES_PASSWORD` is the same value used when the database volume was first initialized. If this is a fresh test install and you can discard data, remove the project volumes and start again:

```bash
docker compose -p cybertabletop -f docker-compose.pull.yml down -v
```

Then bootstrap and start again.
