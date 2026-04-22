# Release Security Review

Date: April 22, 2026

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

- Docker Scout CLI `v1.20.3` for SBOM generation
- Grype `0.111.0` for local image vulnerability scanning
- Gitleaks for repository secret scanning
- OWASP ZAP baseline scan
- npm audit
- Vitest, TypeScript build, ESLint, Docker Compose health checks

Docker Scout CVE scanning was attempted, but the installed Docker Scout CLI requires Docker Hub/Desktop authentication for CVE reports in this environment. Docker Scout SBOM generation completed successfully without authentication.

## Remediation Completed

- Refreshed backend and frontend npm lockfiles within existing semver ranges.
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

Grype local image scan results after remediation:

| Image | Findings | Fixable | Severity Summary |
| --- | ---: | ---: | --- |
| `cybertabletop-backend:latest` | 3 | 0 | 3 medium |
| `cybertabletop-frontend:latest` | 3 | 0 | 3 medium |
| `cybertabletop-nginx:latest` | 3 | 0 | 3 medium |
| `redis:8-alpine` | 4 | 0 | 3 medium, 1 low |
| `postgres:16-alpine` | 33 | 30 | 2 critical, 14 high, 16 medium, 1 low |

The remaining CyberTabletop-owned image findings are non-fixable Alpine `busybox` advisories in the current base images. Redis residual findings are also non-fixable in the current official image.

The PostgreSQL findings are in the official `postgres:16-alpine` image, primarily the bundled `/usr/local/bin/gosu` binary. PostgreSQL major version changes were not applied because switching database majors can break existing volumes and the tested newer official tags did not materially reduce the scanner result. Operators should continue to track official PostgreSQL image rebuilds and update when the upstream image is patched.

## ZAP Baseline Summary

Final OWASP ZAP baseline:

- Failures: 0
- Warnings: 3 categories
- Passes: 64

Residual warnings:

- `style-src 'unsafe-inline'`: retained because the current React/Tailwind UI uses inline style attributes in several views.
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

## SBOM

SBOM artifacts are stored in `sbom/` in both CycloneDX JSON and SPDX JSON formats. See `sbom/README.md`.
