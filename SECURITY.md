# Security Policy

## Supported Use

CyberTabletop is intended to be deployed behind a trusted HTTPS edge or reverse proxy for internet-facing use. The default Docker Compose bindings are loopback-only so a fresh local deployment is not accidentally exposed to a LAN or the public internet.

For public deployment:

- Set `NODE_ENV=production`.
- Set `REQUIRE_INVITE=true`.
- Set a long random `INVITE_CODE`.
- Set long random `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`, `MFA_ENCRYPTION_KEY`, `POSTGRES_PASSWORD`, and `REDIS_PASSWORD` values.
- Replace the development/self-signed TLS certificate with a certificate issued by a trusted CA.
- Keep `.env`, generated TLS private keys, logs, and Docker volumes out of source control.
- Enforce TOTP MFA for privileged local accounts. CyberTabletop requires MFA for `SUPER_ADMIN`, `ORG_ADMIN`, and `FACILITATOR`; operators using OIDC should also enforce MFA at the identity provider.
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
- TOTP MFA is required for `SUPER_ADMIN`, `ORG_ADMIN`, and `FACILITATOR`.
- TOTP secrets are encrypted at rest with `MFA_ENCRYPTION_KEY`.
- MFA recovery codes are shown once and stored only as bcrypt hashes.
- Backend, frontend, database, Redis, and Nginx containers use `no-new-privileges`.
- Security headers and CSP are emitted at the Nginx edge, including HSTS,
  `X-Frame-Options: SAMEORIGIN`, CSP `frame-ancestors 'self'`,
  `Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`, and
  `Cross-Origin-Resource-Policy`.
- SBOM artifacts are included in `sbom/` for the application and runtime images.

## Known Residual Risks

- The bundled localhost certificate is for development only.
- AI provider base URLs can connect the backend to external services; restrict admin access and avoid private/internal endpoints unless explicitly required.
- Local password reset and email verification workflows are not currently implemented; use invite-gated registration, admin-led account management, or OIDC/SSO for stronger account lifecycle control.
- Player MFA is optional. Operators with stricter requirements should mandate MFA through OIDC or operational policy for all user roles.

## Latest Scan Finding Disposition

The April 22, 2026 release-hardening scan found no critical or high Docker Scout findings in CyberTabletop-owned images. Remaining findings are tracked below.

| Finding | Source | Severity | Disposition |
| --- | --- | --- | --- |
| Alpine `busybox` CVE in backend, frontend, Nginx, and Redis images | Docker Scout / Grype | Medium | Inherited from current Alpine base images. `busybox` provides basic Linux shell utilities such as `sh`, `cp`, `mkdir`, and `wget`. It is not CyberTabletop application code or an npm dependency. Rebuild from patched upstream Alpine-based images when available. |
| PostgreSQL `/usr/local/bin/gosu` / Go stdlib findings | Docker Scout / Grype | Critical/High/Medium/Low in official `postgres:16-alpine` | Inherited from the official PostgreSQL image. `gosu` is used by the official image startup process to drop privileges from root to the `postgres` user. Docker Scout reports the PostgreSQL base image as current, so this is not fixable in CyberTabletop application Dockerfiles without replacing or maintaining a custom PostgreSQL image. Pull patched official PostgreSQL images when available. |
| `style-src 'unsafe-inline'` | OWASP ZAP baseline | Warning | Retained because the current React/Tailwind UI uses inline style attributes in some views. Other CSP controls remain restrictive, including `object-src 'none'`, `base-uri 'self'`, and `frame-ancestors 'self'`. |
| Non-storable/cache behavior | OWASP ZAP baseline | Informational warning | Accepted. Authenticated app shells intentionally avoid broad shared caching; static assets are separately cache-controlled. |
| Modern web application | OWASP ZAP baseline | Informational warning | Accepted. This is ZAP classifying the SPA behavior, not a vulnerability by itself. |
| Local self-signed TLS certificate | Deployment default | Operational risk | Development/local install convenience only. Public deployments must use a trusted CA certificate. |
| Optional player MFA | Product policy | Operational risk | Privileged roles require MFA. Operators that require MFA for all users should enforce it through OIDC/SSO or local policy. |
| Local password reset/email verification not implemented | Product scope | Operational risk | Use invite-gated registration, admin-led account management, or OIDC/SSO for stronger account lifecycle controls. |

Clean checks from the same review:

- npm audit found 0 backend vulnerabilities and 0 frontend vulnerabilities.
- Gitleaks found no repository secrets with the project configuration.
- OWASP ZAP baseline reported 0 failures.
- Backend, frontend, and Nginx Docker Scout scans reported 0 critical and 0 high findings.
- Redis Docker Scout scan reported 0 critical and 0 high findings.

See `docs/RELEASE_SECURITY_REVIEW.md` for the full scan summary.
