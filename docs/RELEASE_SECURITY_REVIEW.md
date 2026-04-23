# Release Security Review

Date: April 23, 2026

This review records the release-hardening checks performed against the local CyberTabletop Docker deployment before publishing updates to GitHub.

## Scope

- Backend API image: `cybertabletop-backend:latest`
- Frontend image: `cybertabletop-frontend:latest`
- Reverse proxy image: `cybertabletop-nginx:latest`
- PostgreSQL runtime image: `postgres:16-alpine`
- Redis runtime image: `redis:8-alpine`
- Backend and frontend npm dependency trees
- Docker Compose and pull-based Compose deployment files
- Repository secret scan
- OWASP ZAP passive baseline against the running HTTPS app

## Tooling

- Docker Scout CLI `v1.20.3` for SBOM generation and CVE scanning
- Grype `0.111.0` for local image vulnerability scanning
- Gitleaks for repository secret scanning
- OWASP ZAP baseline scan
- npm audit
- Vitest, TypeScript build, ESLint, Docker Compose health checks

Docker Scout CVE scanning requires Docker Hub/Desktop authentication. It was completed after Docker Hub login was available.

## Remediation Completed

- Refreshed backend and frontend npm manifests and lockfiles.
- Applied the open Dependabot maintenance updates on top of current `main` rather than merging stale PR branches.
- Updated GitHub Actions workflow pins: checkout v6, setup-node v6, CodeQL v4, Docker login v4, Docker build-push v7.
- Added Dependabot grouping for future GitHub Actions and patch/minor dependency updates.
- Updated backend runtime dependencies: `@anthropic-ai/sdk` 0.90, `bcryptjs` 3.0, TypeScript 6, Node 25 type definitions, and Nodemailer 8 type definitions.
- Removed the unused direct `uuid` dependency and its type package after npm audit flagged the old direct dependency line.
- Updated frontend runtime/tooling dependencies: React 19, React DOM 19, React Router 7, TypeScript 6, ESLint 10, React 19 type definitions, Node 25 type definitions, and Vite 8.0.10.
- Added the Vite client type declaration needed by TypeScript 6 and fixed ESLint 10 `no-useless-assignment` findings in the debrief page.
- Rebuilt application images from current base image digests.
- Updated the backend runtime image to remove global `npm` and `npx` after dependency installation.
- Changed backend startup from `npx prisma migrate deploy` to direct Prisma CLI execution through Node.
- Removed `curl` from the backend runtime image and changed the backend health check to use Node's built-in `fetch`.
- Switched frontend and reverse proxy images from `nginx:alpine` to `nginx:alpine-slim`.
- Upgraded Redis from `redis:7-alpine` to `redis:8-alpine`.
- Added clickjacking protection with `X-Frame-Options: SAMEORIGIN` and CSP `frame-ancestors 'self'`.
- Added CSP no-fallback directives `worker-src` and `manifest-src`.
- Added `Cross-Origin-Embedder-Policy` and `Cross-Origin-Resource-Policy`.
- Replaced a high-entropy CI placeholder value and added a narrow Gitleaks allowlist for the historical dummy value.
- Fixed built-in scenario seeding so startup does not fail when historical sessions and decisions reference existing built-in injects.
- Updated Playwright configuration to use bundled Chromium by default unless a browser channel is explicitly supplied.

## Vulnerability Scan Summary

Docker Scout image scan results after remediation:

| Image | Findings | Fixable | Severity Summary |
| --- | ---: | ---: | --- |
| `cybertabletop-backend:latest` | 1 | 0 critical/high fixable | 1 medium |
| `cybertabletop-frontend:latest` | 1 | 0 critical/high fixable | 1 medium |
| `cybertabletop-nginx:latest` | 1 | 0 critical/high fixable | 1 medium |
| `redis:8-alpine` | 1 | 0 critical/high fixable | 1 medium |
| `postgres:16-alpine` | 27 | 11 critical/high fixable in upstream image component | 1 critical, 10 high, 15 medium, 1 low |

Grype local image scan results were also captured as a cross-check:

| Image | Findings | Fixable | Severity Summary |
| --- | ---: | ---: | --- |
| `cybertabletop-backend:latest` | 3 | 0 | 3 medium |
| `cybertabletop-frontend:latest` | 3 | 0 | 3 medium |
| `cybertabletop-nginx:latest` | 3 | 0 | 3 medium |
| `redis:8-alpine` | 4 | 0 | 3 medium, 1 low |
| `postgres:16-alpine` | 33 | 30 | 2 critical, 14 high, 16 medium, 1 low |

### Finding Disposition

| Finding | Affected area | Severity | Interpretation | Action |
| --- | --- | --- | --- | --- |
| Alpine `busybox` CVE | CyberTabletop backend, frontend, Nginx; Redis | Medium | Inherited from Alpine base images. `busybox` provides basic shell utilities such as `sh`, `cp`, `mkdir`, and `wget`. It is not CyberTabletop application code or an npm dependency. | Accept as upstream base-image residual risk. Rebuild from patched upstream images when Alpine publishes a fixed package. |
| PostgreSQL `/usr/local/bin/gosu` / Go stdlib findings | Official `postgres:16-alpine` image | Critical/High/Medium/Low | Inherited from the official PostgreSQL image. `gosu` is used by the official image startup process to drop privileges from root to the `postgres` user. Docker Scout reports the detected base image as current. | Track official PostgreSQL image rebuilds and update when patched. Do not replace with a custom DB image unless the project is ready to maintain it. |
| `style-src 'unsafe-inline'` | Browser CSP | ZAP warning | Retained because the current React/Tailwind UI uses inline style attributes in several views. CSP still blocks object embedding, restricts sources to same-origin, and enforces `frame-ancestors 'self'`. | Accepted for this release. Remove inline style usage in a future frontend hardening pass if stricter CSP is required. |
| Suspicious comment in generated vendor bundle | React Router vendor bundle | ZAP informational warning | ZAP matched the word `USER` inside minified third-party React Router code in the generated vendor asset. The evidence is not an application source comment, secret, token, or credential. | Accepted. Recheck after future React Router/Vite build changes. |
| Non-storable content | HTTP cache behavior | ZAP informational warning | Authenticated app shell responses intentionally avoid broad shared caching. Static hashed assets are separately cache-controlled. | Accepted. |
| Modern web application | SPA behavior | ZAP informational warning | ZAP classifies the app as a modern SPA. This is not a vulnerability by itself. | Accepted. |
| Local self-signed TLS certificate | Local install default | Operational risk | The bundled localhost certificate is for development and local evaluation only. | Public deployments must use a trusted CA certificate. |
| Optional player MFA | Authentication policy | Operational risk | Privileged roles require TOTP MFA; `PLAYER` MFA is optional. | Operators requiring MFA for all users should enforce it through OIDC/SSO or local policy. |
| No local password reset/email verification workflow | Account lifecycle | Operational risk | Local accounts are invite-gated/admin-managed. Full self-service account lifecycle is not implemented. | Use OIDC/SSO, invite-gated registration, and admin-led account management. |

Clean findings:

- CyberTabletop-owned images have 0 critical and 0 high Docker Scout findings.
- Redis has 0 critical and 0 high Docker Scout findings.
- Backend npm audit found 0 vulnerabilities.
- Frontend npm audit found 0 vulnerabilities.
- Gitleaks found no repository secrets with the project configuration.
- OWASP ZAP baseline reported 0 failures.

## ZAP Baseline Summary

Final OWASP ZAP baseline:

- Failures: 0
- Warnings: 4 categories
- Passes: 63

Residual warnings:

- `style-src 'unsafe-inline'`: retained because the current React/Tailwind UI uses inline style attributes in several views.
- `Information Disclosure - Suspicious Comments`: informational match in generated third-party React Router vendor code; no application comment or secret was identified.
- `Non-Storable Content`: informational cache behavior finding; authenticated app shells intentionally avoid broad shared caching.
- `Modern Web Application`: informational scanner classification.

## Verification

Completed successfully:

- Backend TypeScript build
- Backend Vitest suite: 4 files, 14 tests
- Frontend TypeScript/Vite build
- Frontend Vitest suite: 4 files, 7 tests
- Frontend ESLint
- `npm audit --audit-level=low` for backend and frontend
- Docker Compose config validation for build and pull deployment files
- Docker Compose stack health checks
- HTTPS header smoke test
- Playwright E2E suite: 7 tests passed
- Gitleaks repository scan with project config
- Docker Scout SBOM generation in CycloneDX and SPDX formats
- Docker Scout CVE scan after Docker Hub login

## SBOM

SBOM artifacts are stored in `sbom/` in both CycloneDX JSON and SPDX JSON formats. See `sbom/README.md`.
