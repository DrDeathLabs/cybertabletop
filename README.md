# CyberTabletop

CyberTabletop is a web application for running scored, role-based cybersecurity incident response tabletop exercises.

It is built for security teams that want an interactive alternative to slide-deck tabletop exercises: live facilitated sessions, player decisions from individual devices, real-time scoring, reusable scenarios, and structured debriefs.

## License

CyberTabletop is source-available under the Business Source License 1.1.

The public license allows internal use by organizations, including commercial organizations, for their own tabletop exercises, security readiness, evaluation, development, testing, education, and research.

You may not offer CyberTabletop as a hosted service, managed service, SaaS product, paid commercial offering, white-labeled product, material feature of another commercial tool, or paid consulting/training/service delivery platform unless you have separate written permission from the maintainer.

See [LICENSE](LICENSE) and [COMMERCIAL.md](COMMERCIAL.md).

Because the license restricts some production/commercial uses before the Change Date, this project is not "open source" under the OSI Open Source Definition. Each specific version changes to the MIT License four years after that version is first publicly distributed.

## Features

- Live facilitated tabletop sessions with lobby, join codes, and role assignment
- Role-based player decisions for incident response teams
- Built-in ransomware, data breach, and insider threat scenarios
- Scenario builder for custom phases, injects, and decision options
- Real-time scoring, leaderboard, scripted feedback, and debrief views
- NIST CSF-oriented debrief and gap-analysis outputs
- Local authentication plus optional OIDC/SSO
- Enforced TOTP MFA for privileged roles, with optional MFA for players
- AI-assisted content paths using scripted responses, Anthropic, or Ollama
- Admin security dashboard for operational posture checks
- Docker Compose deployment with PostgreSQL, Redis, frontend, backend, and Nginx

## Security Posture

CyberTabletop is designed to be suitable for self-hosted internet-facing deployment when configured correctly, but operators remain responsible for their hosting environment, identity provider, TLS certificates, backups, monitoring, and incident response.

Current hardening includes:

- bcrypt password hashing
- short-lived JWT access tokens
- server-side hashed refresh tokens with rotation
- invite-gated registration support
- enforced TOTP MFA for `SUPER_ADMIN`, `ORG_ADMIN`, and `FACILITATOR`
- AES-256-GCM encryption for stored TOTP secrets
- bcrypt-hashed MFA recovery codes
- role-based authorization
- route-level input validation
- rate limiting
- audit logging
- Nginx security headers and CSP. The bundled localhost config intentionally
  does not set `X-Frame-Options` or `frame-ancestors` so embedded local preview
  browsers can load the app; standalone public deployments should add
  clickjacking protection at their public edge.
- loopback-only Docker port bindings by default
- no direct host exposure for PostgreSQL or Redis
- SSRF protections for organization website fetches

Known residual risks and deployment requirements are documented in [SECURITY.md](SECURITY.md).

The documents in [docs/](docs/) are NIST SP 800-53 Rev. 5 alignment and assessment-support materials. They are not a certification, authorization to operate, or independent compliance attestation.

## Quick Start

For complete setup options, see [docs/INSTALLATION.md](docs/INSTALLATION.md).

For a full product walkthrough, see [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

### Prerequisites

- Docker Desktop on Windows/macOS, or Docker Engine on Linux
- Node.js 20+ only if developing outside Docker

CyberTabletop is not Windows-only. The production stack runs Linux containers
and is intended to work on Windows, macOS, and Linux hosts with Docker. The
repository includes `install.ps1` for Windows and `install.sh` for Linux/macOS.

### 1. Configure environment

Copy the example environment file and replace all `CHANGE_ME` values:

```bash
cp .env.example .env
```

Important production values:

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `SESSION_SECRET`
- `MFA_ENCRYPTION_KEY`
- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `INVITE_CODE`

For local testing, the install scripts can generate local secrets and self-signed certificates.

### 2. Start the stack

Use the prebuilt images from GitHub Container Registry:

```bash
docker compose -p cybertabletop -f docker-compose.pull.yml pull
docker compose -p cybertabletop -f docker-compose.pull.yml up -d
```

Or build locally from source:

```bash
docker compose -p cybertabletop up -d --build
```

By default, Nginx binds only to localhost:

- `https://localhost`
- `http://localhost`

To expose the app behind a trusted reverse proxy or edge load balancer, configure `HTTP_BIND`, `HTTPS_BIND`, `FRONTEND_URL`, `CORS_ORIGINS`, and TLS settings deliberately.

### 3. Built-in scenarios

The backend container runs Prisma migrations and refreshes the built-in scripted
scenario library automatically before starting. No separate seed command is
required for a normal Docker install.

### 4. Open the app

Open [https://localhost](https://localhost) and accept the local self-signed certificate warning if you are using development certificates.

Registration is invite-gated by default when `REQUIRE_INVITE=true`. Use your configured `INVITE_CODE` to create accounts.

The first non-system account becomes `SUPER_ADMIN`. `SUPER_ADMIN`, `ORG_ADMIN`,
and `FACILITATOR` users are required to enroll TOTP MFA before using protected
application features.

## User Roles

| Role | Capabilities |
| --- | --- |
| `SUPER_ADMIN` | Full platform administration |
| `ORG_ADMIN` | Organization-level user and session administration |
| `FACILITATOR` | Create scenarios and run sessions |
| `PLAYER` | Join sessions and make decisions |

## Running an Exercise

For the detailed facilitator/player workflow, see [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

Facilitators:

1. Sign in with a facilitator or admin account.
2. Open Scenarios and select a built-in or custom scenario.
3. Create a session and configure exercise options.
4. Share the join code with participants.
5. Assign roles in the lobby.
6. Start the session, advance injects, and run the debrief.

Players:

1. Open `/join`.
2. Enter the join code.
3. Select or confirm the assigned role.
4. Make decisions during each inject.
5. Review feedback and debrief output.

## Development

Backend:

```bash
cd backend
npm install
npx prisma generate
npm run build
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run build
npm run dev
```

Useful checks:

```bash
cd backend && npm audit
cd frontend && npm audit
```

## Project Structure

```text
cybertabletop/
  backend/              Node.js, Express, Socket.io, Prisma
  frontend/             React, Vite, Tailwind
  nginx/                Reverse proxy and TLS configuration
  docs/                 Security and assessment-support documentation
  deployment/           Cloud deployment notes
  scenarios/            Scenario-related assets
  docker-compose.yml    Self-hosted Docker stack
  docker-compose.pull.yml
                         Self-hosted stack using prebuilt GHCR images
  SECURITY.md           Vulnerability reporting and hardening notes
  LICENSE               Business Source License 1.1
```

## Container Images

Prebuilt images are published to GitHub Container Registry:

- `ghcr.io/drdeathlabs/cybertabletop-backend:latest`
- `ghcr.io/drdeathlabs/cybertabletop-frontend:latest`
- `ghcr.io/drdeathlabs/cybertabletop-nginx:latest`

The `latest` tag is published from the `main` branch. Commit-specific images
are also published with `sha-` tags.

If `docker pull` reports an authorization error, open the repository's Packages
page in GitHub and make the packages public.

## Documentation

- [Installation Guide](docs/INSTALLATION.md)
- [User Guide](docs/USER_GUIDE.md)
- [Production Readiness](docs/PRODUCTION.md)
- [Security Policy](SECURITY.md)
- [Commercial Use Terms](COMMERCIAL.md)
- [Contributing](CONTRIBUTING.md)
- [Support](SUPPORT.md)

## GitHub Safety Notes

Do not commit:

- `.env`
- TLS private keys or generated certificates
- Docker volumes
- logs
- `node_modules`
- frontend/backend `dist` folders

The included `.gitignore` is configured for these defaults, but always inspect `git status` before pushing.

## Secret Handling

The Docker Compose stack reads secrets from `.env` and passes them into
containers as environment variables. This is common for self-hosted Docker
Compose deployments, but it is not the same thing as an encrypted secret store.

The `DATABASE_URL` value in `docker-compose.yml` is a template expanded from
`POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` at runtime. It is not a
hardcoded database password in the repository. Keep `.env` private, use long
random values, and restrict host access to Docker and the deployment directory.

For production environments with stricter requirements, use your platform's
secret manager or Docker secrets and inject the resulting values at deployment
time.
