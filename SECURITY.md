# Security Policy

## Supported Use

CyberTabletop is intended to be deployed behind a trusted HTTPS edge or reverse proxy for internet-facing use. The default Docker Compose bindings are loopback-only so a fresh local deployment is not accidentally exposed to a LAN or the public internet.

For public deployment:

- Set `NODE_ENV=production`.
- Set `REQUIRE_INVITE=true`.
- Set a long random `INVITE_CODE`.
- Set long random `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`, `POSTGRES_PASSWORD`, and `REDIS_PASSWORD` values.
- Replace the development/self-signed TLS certificate with a certificate issued by a trusted CA.
- Keep `.env`, generated TLS private keys, logs, and Docker volumes out of source control.
- Enforce MFA through the configured OIDC identity provider until local MFA enforcement is implemented.
- Treat Docker Compose environment variables as secret-bearing configuration, not as encrypted storage.
- Use alphanumeric database passwords, or URL-encode special characters before embedding them in connection strings.

## Reporting Vulnerabilities

Do not open a public issue for a suspected vulnerability. Contact the project maintainer privately with:

- affected version or commit,
- deployment mode,
- reproduction steps,
- expected and actual behavior,
- impact assessment,
- any relevant logs with secrets removed.

## Security-Relevant Defaults

- Docker Compose binds Nginx to `127.0.0.1` by default.
- The old unauthenticated `8080` demo listener is disabled.
- Registration can be invite-gated with `REQUIRE_INVITE=true` and `INVITE_CODE`.
- Refresh tokens are stored server-side as hashes and rotated on refresh.
- Backend, frontend, database, Redis, and Nginx containers use `no-new-privileges`.
- Security headers and CSP are emitted at the Nginx edge.

## Known Residual Risks

- Local MFA enrollment/enforcement is not complete; use OIDC with upstream MFA for internet-facing deployments.
- The bundled localhost certificate is for development only.
- AI provider base URLs can connect the backend to external services; restrict admin access and avoid private/internal endpoints unless explicitly required.
