# Configuration Management Plan
## CyberTabletop Platform
**Version:** 1.0 | **Date:** March 15, 2026

---

## 1. Purpose

This Configuration Management Plan (CMP) establishes policies and procedures for managing the configuration of the CyberTabletop platform in accordance with NIST SP 800-53 Rev 5 CM controls. It ensures that system configurations are documented, controlled, and maintained consistently across all environments.

---

## 2. Configuration Baselines

### 2.1 Software Baseline

| Component | Version | Source |
|-----------|--------|--------|
| Node.js | 20 LTS | Official Docker image `node:20-alpine` |
| React | 18.3.x | npm registry |
| Express | 4.21.x | npm registry |
| PostgreSQL | 16 | Official Docker image `postgres:16-alpine` |
| Redis | 7 | Official Docker image `redis:7-alpine` |
| Nginx | 1.27 (Alpine) | Official Docker image `nginx:alpine` |
| Prisma ORM | 5.22.x | npm registry |
| Socket.io | 4.8.x | npm registry |

### 2.2 Security Configuration Baseline

**Nginx:**
- TLS 1.2/1.3 only (TLS 1.0, 1.1 disabled)
- Strong cipher suite (ECDHE + AES-GCM + SHA384)
- HSTS with 1-year max-age + preload
- X-Frame-Options: DENY
- Content-Security-Policy: restrictive (no unsafe-inline scripts)
- Rate limiting: 60 req/min general, 10 req/min auth endpoints

**Backend (Express):**
- Helmet.js security headers enabled
- CORS: allowlist only (configured origins)
- Cookie flags: httpOnly, Secure, SameSite=Lax
- Input validation: Zod schema on all endpoints
- Rate limiting: express-rate-limit with separate zones

**PostgreSQL:**
- Authentication: password (md5 or scram-sha-256)
- Network: internal Docker network only
- No superuser access from application
- Principle of least privilege: application user has only necessary permissions

**Docker:**
- All containers run as non-root users
- No privileged containers
- Read-only filesystem where possible
- No host network mode
- Internal network isolation

---

## 3. Configuration Items

Configuration items (CIs) subject to configuration management:

| CI | Type | Location | Version Controlled |
|----|------|---------|-------------------|
| Application source code | Software | Git repository | Yes |
| Prisma schema | Database schema | `backend/prisma/schema.prisma` | Yes |
| Docker Compose files | Infrastructure | `docker-compose.yml`, `docker-compose.dev.yml` | Yes |
| Nginx configuration | Web server | `nginx/nginx.conf` | Yes |
| Environment variables | Configuration | `.env` (not in Git) | No (documented in `.env.example`) |
| Frontend dependencies | Software | `frontend/package.json` | Yes |
| Backend dependencies | Software | `backend/package.json` | Yes |
| Docker images | Software | Tagged releases in registry | Yes |

---

## 4. Change Control Procedures

### 4.1 Change Classification

| Type | Definition | Approval Required |
|------|-----------|------------------|
| Emergency | Immediate security patch, critical bug fix | System Owner (verbal, document after) |
| Standard | Pre-approved recurring changes (e.g., dependency updates) | ISSO review |
| Normal | New features, configuration changes | CAB review |
| Major | Architecture changes, new integrations | System Owner + ISSO + CAB |

### 4.2 Change Request Process

1. **Submit** — Create change request documenting: description, justification, risk assessment, rollback plan, testing plan
2. **Review** — ISSO reviews security impact; CAB reviews operational impact
3. **Approve/Reject** — Change approved, rejected, or returned for modification
4. **Test** — Changes tested in development environment
5. **Deploy** — Approved changes deployed following deployment procedures
6. **Verify** — Post-deployment testing and verification
7. **Document** — Update documentation, close change request

### 4.3 Emergency Change Procedure

For critical security vulnerabilities requiring immediate patching:

1. ISSO and System Owner notified immediately
2. Verbal approval obtained from System Owner
3. Change implemented with minimum required scope
4. Documentation completed within 24 hours
5. Full change request submitted retrospectively within 48 hours

---

## 5. Patch Management

### 5.1 Patch Sources

| Component | Patch Source | Check Frequency |
|-----------|-------------|----------------|
| Node.js | Node.js release blog + CVE feeds | Weekly |
| npm packages | `npm audit` | Weekly (automated) |
| Docker base images | Docker Hub security advisories | Weekly |
| PostgreSQL | PostgreSQL security feed | Weekly |
| Host OS | Vendor security updates | As released |

### 5.2 Patch Priority

| Severity | Target Patch Timeline |
|---------|----------------------|
| Critical (CVSS 9.0-10.0) | 24 hours |
| High (CVSS 7.0-8.9) | 72 hours |
| Medium (CVSS 4.0-6.9) | 30 days |
| Low (CVSS < 4.0) | 90 days |

### 5.3 Patch Deployment Commands

```bash
# Check for npm vulnerabilities
cd backend && npm audit
cd frontend && npm audit

# Update npm packages (patch and minor only)
npm update

# Update Docker base images
docker compose pull
docker compose up -d --build

# Verify application health after update
curl -k https://localhost/health
docker compose logs backend | tail -20
```

---

## 6. Version Control

All source code and configuration files (except sensitive secrets) are managed in a Git repository.

**Branch Strategy:**
- `main` — Production-ready code
- `develop` — Integration branch for completed features
- `feature/*` — Feature development branches
- `hotfix/*` — Emergency patches for production

**Tagging:**
- All production deployments tagged: `v{MAJOR}.{MINOR}.{PATCH}`
- Tag must be created before deploying to production
- Git tag includes release notes

**Commit Standards:**
- Signed commits required for main branch (GPG signing recommended)
- Commit message format: `type(scope): description` (Conventional Commits)
- No secrets or credentials in Git history (enforced by pre-commit hooks)

---

## 7. Approved Software List

Only the following software is approved for inclusion in the production deployment:

**Runtime:**
- `node:20-alpine` (official Docker image)
- `postgres:16-alpine` (official Docker image)
- `redis:7-alpine` (official Docker image)
- `nginx:alpine` (official Docker image)

**npm Production Dependencies (backend):**
See `backend/package.json` `dependencies` section — all from official npm registry.

**npm Production Dependencies (frontend):**
See `frontend/package.json` `dependencies` section — all from official npm registry.

Any addition of new dependencies requires:
1. Security review of the package (maintainer, download count, known CVEs)
2. ISSO approval documented in change request
3. `package-lock.json` update committed to Git

---

## 8. Configuration Monitoring

### 8.1 Automated Checks

```bash
# Verify running containers match expected images
docker compose ps

# Check for image updates
docker compose pull --dry-run

# Verify SSL certificate validity
openssl x509 -in nginx/ssl/cert.pem -noout -dates

# Verify no unauthorized accounts
docker compose exec postgres psql -U cybertabletop -c \
  "SELECT id, email, role, created_at FROM users WHERE role IN ('SUPER_ADMIN', 'ORG_ADMIN');"
```

### 8.2 Configuration Drift Detection

**Monthly review checklist:**
- [ ] Docker image versions match approved baseline
- [ ] npm package versions match `package-lock.json`
- [ ] Environment variable settings match documented configuration
- [ ] SSL certificate expiry > 30 days
- [ ] Nginx configuration unchanged from baseline
- [ ] No unauthorized admin accounts in database

---

## 9. Environment Management

| Environment | Purpose | Data | Access |
|------------|---------|------|--------|
| Development | Feature development | Synthetic data only | Developers |
| Staging | Pre-production testing | Anonymized/synthetic data | ISSO, Developers |
| Production | Live system | Real user data | System Admins only |

**No production data in development or staging environments.**

---

## 10. Plan Maintenance

- Reviewed annually or after significant system changes
- Updated after each security incident involving configuration issues
- Owner: ISSO
