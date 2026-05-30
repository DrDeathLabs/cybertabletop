# CyberTabletop SBOMs

This directory contains Software Bill of Materials artifacts generated from the Docker images used by the CyberTabletop stack.

Generated: April 23, 2026

Tool: Docker Scout CLI `v1.20.3`

These SBOM artifacts predate the May 30, 2026 GitHub dependency remediation update. Regenerate them before the next tagged release or image publish so the published dependency inventory matches the current lockfiles and container builds.

## Included Images

| Component | Image | CycloneDX | SPDX |
| --- | --- | --- | --- |
| Backend API | `cybertabletop-backend:latest` | `cybertabletop-backend.cdx.json` | `cybertabletop-backend.spdx.json` |
| Frontend | `cybertabletop-frontend:latest` | `cybertabletop-frontend.cdx.json` | `cybertabletop-frontend.spdx.json` |
| Reverse proxy | `cybertabletop-nginx:latest` | `cybertabletop-nginx.cdx.json` | `cybertabletop-nginx.spdx.json` |
| PostgreSQL | `postgres:16-alpine` | `postgres-16-alpine.cdx.json` | `postgres-16-alpine.spdx.json` |
| Redis | `redis:8-alpine` | `redis-8-alpine.cdx.json` | `redis-8-alpine.spdx.json` |

## Regenerate

From the repository root after building or pulling the images:

```powershell
docker scout sbom local://cybertabletop-backend:latest --format cyclonedx --output sbom/cybertabletop-backend.cdx.json
docker scout sbom local://cybertabletop-backend:latest --format spdx --output sbom/cybertabletop-backend.spdx.json

docker scout sbom local://cybertabletop-frontend:latest --format cyclonedx --output sbom/cybertabletop-frontend.cdx.json
docker scout sbom local://cybertabletop-frontend:latest --format spdx --output sbom/cybertabletop-frontend.spdx.json

docker scout sbom local://cybertabletop-nginx:latest --format cyclonedx --output sbom/cybertabletop-nginx.cdx.json
docker scout sbom local://cybertabletop-nginx:latest --format spdx --output sbom/cybertabletop-nginx.spdx.json

docker scout sbom local://postgres:16-alpine --format cyclonedx --output sbom/postgres-16-alpine.cdx.json
docker scout sbom local://postgres:16-alpine --format spdx --output sbom/postgres-16-alpine.spdx.json

docker scout sbom local://redis:8-alpine --format cyclonedx --output sbom/redis-8-alpine.cdx.json
docker scout sbom local://redis:8-alpine --format spdx --output sbom/redis-8-alpine.spdx.json
```

SBOMs are point-in-time artifacts. Regenerate them for each release build or image publish.
