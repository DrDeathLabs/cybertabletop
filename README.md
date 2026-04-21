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
- role-based authorization
- route-level input validation
- rate limiting
- audit logging
- Nginx security headers and CSP
- loopback-only Docker port bindings by default
- no direct host exposure for PostgreSQL or Redis
- SSRF protections for organization website fetches

Known residual risks and deployment requirements are documented in [SECURITY.md](SECURITY.md).

The documents in [docs/](docs/) are NIST SP 800-53 Rev. 5 alignment and assessment-support materials. They are not a certification, authorization to operate, or independent compliance attestation.

## Quick Start

### Prerequisites

- Docker Desktop or Docker Engine
- Node.js 20+ only if developing outside Docker

### 1. Configure environment

Copy the example environment file and replace all `CHANGE_ME` values:

```bash
cp .env.example .env
```

Important production values:

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `SESSION_SECRET`
- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `INVITE_CODE`

For local testing, the install scripts can generate local secrets and self-signed certificates.

### 2. Start the stack

```bash
docker compose -p cybertabletop up -d --build
```

By default, Nginx binds only to localhost:

- `https://localhost`
- `http://localhost`

To expose the app behind a trusted reverse proxy or edge load balancer, configure `HTTP_BIND`, `HTTPS_BIND`, `FRONTEND_URL`, `CORS_ORIGINS`, and TLS settings deliberately.

### 3. Run migrations and seed built-in scenarios

```bash
docker compose -p cybertabletop exec backend npm run db:migrate
docker compose -p cybertabletop exec backend npm run db:seed
```

### 4. Open the app

Open [https://localhost](https://localhost) and accept the local self-signed certificate warning if you are using development certificates.

Registration is invite-gated by default when `REQUIRE_INVITE=true`. Use your configured `INVITE_CODE` to create accounts.

## User Roles

| Role | Capabilities |
| --- | --- |
| `SUPER_ADMIN` | Full platform administration |
| `ORG_ADMIN` | Organization-level user and session administration |
| `FACILITATOR` | Create scenarios and run sessions |
| `PLAYER` | Join sessions and make decisions |

## Running an Exercise

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
  SECURITY.md           Vulnerability reporting and hardening notes
  LICENSE               Business Source License 1.1
```

## GitHub Safety Notes

Do not commit:

- `.env`
- TLS private keys or generated certificates
- Docker volumes
- logs
- `node_modules`
- frontend/backend `dist` folders

The included `.gitignore` is configured for these defaults, but always inspect `git status` before pushing.
