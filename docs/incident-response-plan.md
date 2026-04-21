# Incident Response Plan
## CyberTabletop Platform
**Version:** 1.0 | **Date:** March 15, 2026 | **Classification:** Internal

---

## 1. Purpose and Scope

This Incident Response Plan (IRP) documents procedures for detecting, responding to, and recovering from cybersecurity incidents affecting the CyberTabletop platform. This plan applies to all components within the system authorization boundary and aligns with NIST SP 800-61r2 (Computer Security Incident Handling Guide) and NIST SP 800-53 Rev 5 IR controls.

---

## 2. Incident Response Team

| Role | Responsibility | Contact |
|------|---------------|---------|
| System Owner | Authorize major response actions, stakeholder communication | [System Owner Name/Contact] |
| ISSO (Information System Security Officer) | Coordinate incident response, regulatory reporting | [ISSO Name/Contact] |
| IR Lead | Technical investigation, containment, eradication | [IR Lead Name/Contact] |
| System Administrator | Execute technical remediation steps | [SysAdmin Name/Contact] |
| Legal Counsel | Regulatory obligations, evidence preservation guidance | [Legal Contact] |
| Communications | Internal/external notifications if required | [Comms Contact] |

**24/7 Escalation:** [Primary On-Call] → [Secondary On-Call] → [System Owner]

---

## 3. Incident Categories and Severity

### Severity Definitions

| Severity | Definition | Initial Response Time |
|----------|-----------|----------------------|
| **Critical** | Confirmed data breach, system compromise, ransomware | Immediate (< 1 hour) |
| **High** | Suspected unauthorized access, active attack, service unavailability | < 4 hours |
| **Medium** | Anomalous activity, failed attack attempts, policy violation | < 24 hours |
| **Low** | Security audit finding, minor policy deviation | < 72 hours |

### Incident Categories

| Category | Examples |
|----------|---------|
| Unauthorized Access | Account compromise, privilege escalation, brute force success |
| Data Exposure | Unintended PII disclosure, misconfigured access controls |
| Denial of Service | Resource exhaustion, application unavailability |
| Malware/Ransomware | Infected container, compromised dependency |
| Insider Threat | Unauthorized data export by authorized user |
| Supply Chain | Compromised Docker image, malicious npm package |

---

## 4. Incident Response Lifecycle (PICERL)

### Phase 1: Preparation

**Standing Readiness Actions:**
- Maintain current contact list for all IR team members
- Ensure audit logging is active and logs are being retained per AU controls
- Verify backup systems are tested quarterly
- Maintain IR runbooks for known attack patterns
- Test this plan annually via tabletop exercise

**Detection Sources:**
- Application audit logs (AuditLog table in database)
- Nginx access/error logs
- Docker container logs
- Operating system logs on host
- Rate limiting alerts (express-rate-limit)
- External monitoring (if configured)

---

### Phase 2: Identification

**Initial Triage Checklist:**
1. Identify the source of the alert (log entry, user report, automated alert)
2. Determine affected components (frontend, backend, database, authentication)
3. Estimate the time window of the incident
4. Classify severity using the table above
5. Determine if PHI, PII, or other sensitive data is involved
6. Document all findings in the incident log

**Incident Log Template:**
```
Incident ID: INC-[YYYY-MM-DD]-[SEQ]
Date/Time Detected:
Detected By:
Description:
Affected Systems:
Initial Severity:
Assigned IR Lead:
```

**Evidence Collection (prior to any remediation):**
```bash
# Capture container logs
docker compose logs backend > incident-backend-$(date +%Y%m%d).log
docker compose logs nginx > incident-nginx-$(date +%Y%m%d).log

# Export audit logs from database
docker compose exec postgres psql -U cybertabletop -c \
  "COPY (SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 10000) TO STDOUT CSV HEADER" \
  > incident-audit-$(date +%Y%m%d).csv

# Capture running container state
docker ps -a > incident-docker-state-$(date +%Y%m%d).txt
docker inspect $(docker ps -aq) >> incident-docker-state-$(date +%Y%m%d).txt
```

---

### Phase 3: Containment

#### Unauthorized Access / Account Compromise

**Short-term containment:**
```bash
# Lock compromised account via database
docker compose exec postgres psql -U cybertabletop -c \
  "UPDATE users SET locked_until = NOW() + INTERVAL '30 days', failed_attempts = 99 WHERE email = 'compromised@example.com';"

# If widespread compromise — force all sessions invalid by rotating JWT secret
# Edit .env: JWT_SECRET=<new-random-secret>
docker compose restart backend
```

**Long-term containment:**
- Identify all sessions created by compromised account
- Review audit logs for actions taken during compromise window
- Determine if privilege escalation occurred

#### Data Breach / Exposure

```bash
# If active exfiltration via API — enable strict rate limiting immediately
# Update nginx.conf to reduce rate limit thresholds, then:
docker compose restart nginx

# If database access — immediately rotate DB credentials
# 1. Update POSTGRES_PASSWORD in .env
# 2. Connect to postgres and change password:
docker compose exec postgres psql -U cybertabletop -c \
  "ALTER USER cybertabletop PASSWORD 'new-secure-password';"
# 3. Update DATABASE_URL in .env
docker compose restart backend
```

#### Denial of Service

```bash
# Check nginx rate limiting logs
docker compose logs nginx | grep "limiting requests"

# Block offending IP at nginx level
# Add to nginx.conf within server block:
# deny <attacker-ip>;
docker compose restart nginx

# If volumetric — escalate to network/hosting provider for upstream blocking
```

#### Compromised Container / Supply Chain

```bash
# Immediately isolate affected container
docker stop cybertabletop-backend

# Pull known-good image from registry
docker pull <registry>/cybertabletop-backend:<known-good-tag>

# Verify image integrity (if signing is configured)
docker trust inspect --pretty <image>

# Restart with verified image
docker compose up -d backend
```

---

### Phase 4: Eradication

1. **Identify root cause** — Review audit logs, system logs, and access patterns to determine initial access vector
2. **Remove malicious artifacts** — Delete any unauthorized accounts, files, or configurations
3. **Patch vulnerabilities** — Apply patches to address the exploited vulnerability
4. **Update credentials** — Rotate all secrets, passwords, and API keys that may have been exposed
5. **Verify system integrity** — Compare running configuration against known-good baseline
6. **Remove attacker persistence** — Check for any backdoor accounts, scheduled tasks, or modified files

**Credential Rotation Checklist:**
- [ ] JWT_SECRET
- [ ] JWT_REFRESH_SECRET
- [ ] SESSION_SECRET
- [ ] POSTGRES_PASSWORD
- [ ] ANTHROPIC_API_KEY (if exposed)
- [ ] OIDC_CLIENT_SECRET (if exposed)
- [ ] All admin account passwords

---

### Phase 5: Recovery

**Recovery Sequence:**
1. Restore from clean backup if data integrity is in question
2. Deploy from known-good container images
3. Apply all patches and configuration hardening
4. Gradually restore services: database → backend → frontend → nginx
5. Monitor closely for 48-72 hours post-recovery

```bash
# Full recovery from backup
# 1. Stop all services
docker compose down

# 2. Restore database from backup
docker compose up -d postgres
docker compose exec postgres bash -c \
  "pg_restore -U cybertabletop -d cybertabletop < /backups/backup-YYYYMMDD.dump"

# 3. Restart all services
docker compose up -d

# 4. Verify application health
curl -k https://localhost/health
```

---

### Phase 6: Lessons Learned

**Post-Incident Review (within 2 weeks of incident closure):**

1. Complete the incident timeline (detection → containment → recovery)
2. Identify contributing factors (technical, process, human)
3. Document what worked well and what didn't
4. Update the POA&M with new findings
5. Update this IR plan based on lessons learned
6. Update security controls to prevent recurrence
7. Brief system owner on outcomes

**Post-Incident Report Template:**
```
Incident ID:
Date of Incident:
Date of Detection:
Date of Containment:
Date of Recovery:
Date of Report:

Executive Summary:
[2-3 sentence overview]

Timeline:
[Chronological sequence of events]

Root Cause:
[Technical root cause]

Impact:
[Data, systems, users affected]

Response Actions:
[What was done]

Lessons Learned:
[What to improve]

Control Improvements:
[Specific security control changes]

POA&M Entries Added:
[New open findings]
```

---

## 5. Notification Requirements

### Internal Notifications

| Event | Notify | Timeline |
|-------|--------|---------|
| Any security incident | ISSO, System Owner | Immediately |
| Critical/High severity | Add Legal, Comms | Within 1 hour |
| Suspected data breach | Add Legal Counsel | Immediately |

### Regulatory Notifications

| Regulation | Trigger | Deadline |
|-----------|---------|---------|
| GDPR Art. 33 | Personal data of EU subjects breached | 72 hours to supervisory authority |
| GDPR Art. 34 | High risk to EU data subjects | Without undue delay to affected individuals |
| CCPA | California resident data breached | Most expedient time |
| Federal reporting (if applicable) | Confirmed material incident | Per agency requirements |
| Law enforcement | Suspected criminal activity | As appropriate |

---

## 6. Evidence Preservation

All evidence must be preserved in accordance with legal hold requirements before any remediation:

1. **Secure copies** of all relevant logs before any system changes
2. **Cryptographic hashing** (SHA-256) of all evidence files for integrity verification
3. **Chain of custody** documentation for any evidence that may be used in legal proceedings
4. **Do not alter** original evidence — work from copies

```bash
# Create tamper-evident evidence package
tar czf incident-evidence-$(date +%Y%m%d-%H%M%S).tar.gz \
  incident-backend-*.log incident-nginx-*.log incident-audit-*.csv

# Generate integrity hash
sha256sum incident-evidence-*.tar.gz > incident-evidence-hashes.txt
```

---

## 7. Plan Maintenance

- **Annual review:** IR plan reviewed and updated annually
- **Post-incident review:** Plan updated after each significant incident
- **Testing:** Annual tabletop exercise using this platform (appropriate)
- **Owner:** ISSO is responsible for maintaining this document
