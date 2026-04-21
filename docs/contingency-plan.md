# Contingency Plan
## CyberTabletop Platform

---

| Field | Value |
|---|---|
| **Document Title** | Contingency Plan — CyberTabletop |
| **Document ID** | CP-CTT-001 |
| **System Identifier** | CTT-001 |
| **Version** | 1.0 |
| **Date** | March 2026 |
| **Prepared By** | [SYSTEM OWNER NAME] / [SYSADMIN NAME] |
| **Organization** | [ORGANIZATION] |
| **System Owner** | [SYSTEM OWNER NAME] |
| **ISSO** | [ISSO NAME] |

---

## 1. Introduction

### 1.1 Purpose

This Contingency Plan (CP) establishes procedures for the recovery of the CyberTabletop information system following a disruptive event. The plan fulfills the requirements of NIST SP 800-53 Rev. 5 control CP-2 and NIST SP 800-34 Rev. 1, *Contingency Planning Guide for Federal Information Systems*.

### 1.2 Scope

This plan covers:
- All components within the CyberTabletop authorization boundary
- Recovery from both planned (maintenance) and unplanned (failure, disaster) disruptions
- Data backup and restoration procedures
- Personnel notification procedures

### 1.3 Recovery Objectives

| Objective | Target | Basis |
|---|---|---|
| **Recovery Time Objective (RTO)** | 4 hours | Time to restore system to operational status; acceptable given LOW availability impact |
| **Recovery Point Objective (RPO)** | 24 hours | Maximum acceptable data loss; aligns with daily backup frequency |
| **Maximum Tolerable Downtime (MTD)** | 48 hours | Business impact analysis; training exercises can be rescheduled |

### 1.4 System Overview

CyberTabletop is a web-based gamified IR tabletop exercise platform. The system is rated LOW for availability impact. Disruptions affect security training activities but do not impact safety, operational decisions, or time-critical missions. System availability supports scheduling flexibility.

---

## 2. Activation Criteria

### 2.1 Plan Activation Triggers

This Contingency Plan is activated when any of the following conditions occur:

| Category | Trigger | Activation Authority |
|---|---|---|
| System Outage | System is inaccessible to users for > 2 hours during planned operational hours | System Owner or ISSO |
| Data Loss | Database corruption or data loss confirmed | System Owner or DBA |
| Infrastructure Failure | Docker host failure, storage failure, or network failure affecting the system | System Administrator |
| Ransomware/Malware | System compromised by ransomware or destructive malware | System Owner or ISSO |
| Security Breach | System integrity compromised requiring rebuild | Authorizing Official or System Owner |
| Disaster | Physical disaster affecting the primary data center | System Owner |
| Planned Maintenance > RTO | Planned maintenance expected to exceed 4 hours | System Owner |

### 2.2 Activation Decision Process

1. Incident detected by System Administrator, ISSO, user report, or monitoring alert
2. System Administrator assesses impact and estimated restoration time
3. If estimated restoration time > 2 hours OR confirmed data loss/security compromise: notify System Owner
4. System Owner determines if CP activation is warranted
5. If activated: notify CP Team (Section 3), initiate activation procedures
6. Notify users of outage and estimated restoration time
7. Document activation time and circumstances in the incident log

---

## 3. Roles and Responsibilities

### 3.1 Contingency Planning Team

| Role | Individual | Contact | Primary Responsibility |
|---|---|---|---|
| **Contingency Planning Coordinator** | [SYSTEM OWNER NAME] | [PHONE] / [EMAIL] | Overall coordination; activation decision; user communication |
| **Technical Recovery Lead** | [SYSADMIN NAME] | [PHONE] / [EMAIL] | Infrastructure recovery; container restart; system validation |
| **Database Recovery Specialist** | [DBA NAME] | [PHONE] / [EMAIL] | Database restore; data integrity verification |
| **Security Officer** | [ISSO NAME] | [PHONE] / [EMAIL] | Security posture during recovery; post-recovery security verification |
| **Communications Lead** | [COMMS LEAD NAME] | [PHONE] / [EMAIL] | User and stakeholder notifications; status updates |
| **Management Sponsor** | [MANAGEMENT SPONSOR] | [PHONE] / [EMAIL] | Executive decisions; resource authorization |
| **Backup Technical Contact** | [BACKUP SYSADMIN] | [PHONE] / [EMAIL] | Backup support if primary Technical Lead unavailable |

### 3.2 Notification Contacts

| Contact | Organization | Contact Info | Notify When |
|---|---|---|---|
| [AUTHORIZING OFFICIAL] | [ORGANIZATION] | [CONTACT INFO] | Any CP activation |
| [HELP DESK MANAGER] | [ORGANIZATION] IT Help Desk | [CONTACT INFO] | User-facing outage |
| [CLOUD PROVIDER SUPPORT] | [AWS/Azure] (if cloud-deployed) | [SUPPORT NUMBER] | Cloud infrastructure issues |
| [DATA CENTER OPS] | [ORGANIZATION] or Colo Provider | [CONTACT INFO] | Physical infrastructure issues |
| [SECURITY OPERATIONS CENTER] | [ORGANIZATION] SOC | [CONTACT INFO] | Security-related activations |

---

## 4. Backup Procedures

### 4.1 Backup Strategy Overview

| Data Type | Backup Method | Frequency | Retention | Location |
|---|---|---|---|---|
| PostgreSQL database (full) | pg_dump (logical backup) | Daily at 02:00 UTC | 30 days | Primary + Alternate |
| PostgreSQL database (WAL) | Continuous WAL archiving (if configured) | Continuous | 7 days | Primary storage |
| Application configuration | Git repository | On change | Full history | Git server |
| Docker images | Registry push with versioned tags | On build/release | All versions | Container registry |
| Environment/secrets | Secrets manager snapshot | Daily | 90 days | Secrets manager |
| Redis data | Redis persistence (RDB snapshot) | Hourly (if enabled) | 7 days | Primary storage |

### 4.2 PostgreSQL Backup Procedure

**Frequency:** Daily, automated at 02:00 UTC

**Backup Script Location:** `/opt/cybertabletop/scripts/backup.sh`

**Procedure:**

```
Step 1: Pre-backup check
  - Verify disk space available for backup file
  - Verify database connectivity from backup host
  - Log backup job start to monitoring system

Step 2: Database dump
  Command: pg_dump -h [DB_HOST] -U [DB_USER] -d cybertabletop \
            -F custom -f /tmp/ctt_backup_$(date +%Y%m%d_%H%M%S).dump
  Expected: Exit code 0; no error output
  Verify: Check file size > [MINIMUM_SIZE] MB (sanity check)

Step 3: Encrypt backup file
  Command: openssl enc -aes-256-cbc -pbkdf2 \
            -in /tmp/ctt_backup_[TIMESTAMP].dump \
            -out /tmp/ctt_backup_[TIMESTAMP].dump.enc \
            -pass env:BACKUP_ENCRYPTION_KEY
  Expected: Exit code 0; encrypted file created
  Source: BACKUP_ENCRYPTION_KEY from secrets manager (never hardcoded)

Step 4: Transfer to alternate storage
  Command: [TRANSFER METHOD: aws s3 cp / azure storage / scp / rsync]
             /tmp/ctt_backup_[TIMESTAMP].dump.enc \
             [ALTERNATE_STORAGE_PATH]/
  Expected: Exit code 0; file confirmed at destination with matching checksum

Step 5: Verify checksum
  Command: sha256sum /tmp/ctt_backup_[TIMESTAMP].dump.enc > [TIMESTAMP].sha256
  Transfer checksum file to alternate storage alongside backup

Step 6: Cleanup
  Remove temporary unencrypted and encrypted files from /tmp
  Command: shred -u /tmp/ctt_backup_[TIMESTAMP].dump
           rm /tmp/ctt_backup_[TIMESTAMP].dump.enc

Step 7: Log completion
  Log: backup file name, size, timestamp, destination, checksum
  If any step fails: generate HIGH severity alert to monitoring system
```

**Backup Verification (Weekly):**

```
Step 1: Select most recent backup file from alternate storage
Step 2: Download backup to isolated test environment
Step 3: Decrypt: openssl enc -d -aes-256-cbc -pbkdf2 -in [FILE].enc -out [FILE].dump
Step 4: Restore to test database: pg_restore -h [TEST_DB] -U [USER] -d test_db [FILE].dump
Step 5: Execute validation queries:
        - SELECT COUNT(*) FROM users; (verify reasonable user count)
        - SELECT COUNT(*) FROM audit_events; (verify audit log present)
        - SELECT MAX(created_at) FROM audit_events; (verify recency)
Step 6: Log verification result; alert if verification fails
Step 7: Destroy test data: DROP DATABASE test_db;
```

### 4.3 Backup Retention and Rotation

| Age | Storage Location | Action |
|---|---|---|
| 0–30 days | Alternate storage (S3/Blob/offsite) | Retained; accessible for restore |
| 31–90 days | Cold storage / archive tier | Retained; accessible with delay |
| 90+ days | Purge | Deleted per retention schedule |

### 4.4 Backup Access Control

- Backup encryption key: Stored in [ORGANIZATION] secrets manager; accessible to DBA and System Owner
- Backup storage access: Restricted to [DBA NAME] and [SYSADMIN NAME]; access logged
- Backup restoration authorization: Must be authorized by System Owner or DBA for full restoration

---

## 5. Recovery Procedures

### 5.1 Recovery Scenario Matrix

| Scenario | Recovery Procedure | Estimated Time |
|---|---|---|
| Single container failure | Restart container (Section 5.2) | 15 minutes |
| Database service failure | Restart PostgreSQL container; verify data integrity (Section 5.3) | 30 minutes |
| Redis failure | Restart Redis container; re-warm session cache (Section 5.4) | 15 minutes |
| Full application stack failure | Full stack restart (Section 5.5) | 1 hour |
| Database corruption / data loss | Database restore from backup (Section 5.6) | 2–4 hours |
| Docker host failure | Full infrastructure rebuild + restore (Section 5.7) | 4–8 hours |
| Complete disaster | Alternate site activation (Section 5.8) | 4–8 hours |

### 5.2 Single Container Restart

**Applicable to:** Frontend, backend, or Nginx container failure without data loss

```
Step 1: Identify failed container
  Command: docker ps -a
  Look for: Status "Exited" or "Restarting"

Step 2: Review container logs for failure cause
  Command: docker logs [CONTAINER_NAME] --tail=100

Step 3: If cause is identified and addressable (config error, resource limit):
  Address root cause before restart

Step 4: Restart container
  Command: docker compose restart [SERVICE_NAME]
  Or: docker compose up -d [SERVICE_NAME]

Step 5: Verify container is running
  Command: docker ps | grep [SERVICE_NAME]
  Expected: Status "Up"

Step 6: Verify service health
  Command: curl -f https://[APP_URL]/api/health
  Expected: HTTP 200 with health status JSON

Step 7: Test authentication with test account

Step 8: Document incident and resolution
```

### 5.3 Database Service Recovery (No Data Loss)

**Applicable to:** PostgreSQL container crash without database corruption

```
Step 1: Verify database container status
  Command: docker ps -a | grep postgres

Step 2: Check database logs
  Command: docker logs ctt-postgres --tail=200

Step 3: Restart PostgreSQL container
  Command: docker compose restart postgres

Step 4: Verify PostgreSQL is accepting connections
  Command: docker exec ctt-postgres pg_isready -U [DB_USER]
  Expected: "[host]:[port] - accepting connections"

Step 5: Verify data integrity
  Command: docker exec ctt-postgres psql -U [DB_USER] -d cybertabletop \
            -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM audit_events;"
  Expected: Reasonable row counts

Step 6: Run application validation
  Command: curl -f https://[APP_URL]/api/health
  Test login with test account

Step 7: Restart backend API to re-establish database connections
  Command: docker compose restart backend

Step 8: Monitor logs for 30 minutes for connection errors

Step 9: Document incident
```

### 5.4 Redis Recovery

**Applicable to:** Redis container failure (session cache loss expected; sessions will require re-authentication)

```
Step 1: Restart Redis container
  Command: docker compose restart redis

Step 2: Verify Redis is accepting connections
  Command: docker exec ctt-redis redis-cli ping
  Expected: PONG

Step 3: Note: All active sessions are invalidated on Redis restart.
  Users will need to re-authenticate.

Step 4: Restart backend API to re-establish Redis connections
  Command: docker compose restart backend

Step 5: Notify users: "Session reset due to maintenance; please log in again"

Step 6: Monitor authentication logs for unusual patterns after session reset

Step 7: Document incident
```

### 5.5 Full Application Stack Restart

**Applicable to:** Multiple container failures; Docker network issues; post-maintenance restart

```
Step 1: Stop all containers gracefully
  Command: docker compose down

Step 2: Verify all containers stopped
  Command: docker ps -a | grep ctt

Step 3: Review any error logs before restart
  Command: docker compose logs --tail=50

Step 4: Pull latest approved images (if update warranted)
  Command: docker compose pull
  Verify image digests match approved baseline

Step 5: Start all containers
  Command: docker compose up -d

Step 6: Wait for all containers to reach healthy state (up to 2 minutes)
  Command: docker compose ps
  Expected: All services "Up" or "healthy"

Step 7: Verify database connectivity
  Command: docker exec ctt-postgres pg_isready

Step 8: Verify Redis connectivity
  Command: docker exec ctt-redis redis-cli ping

Step 9: Verify application health
  Command: curl -f https://[APP_URL]/api/health

Step 10: Test end-to-end: login, load exercise, log out

Step 11: Notify users that service is restored

Step 12: Document restart
```

### 5.6 Database Restore from Backup

**Use when:** Database corruption detected, data loss confirmed, recovery to known-good state required

**Prerequisites:**
- Authorization from System Owner or DBA
- Identification of target backup (most recent clean backup prior to incident)
- ISSO notified (potential data loss incident)

```
Step 1: STOP the application — prevent new data writes
  Command: docker compose stop backend

Step 2: Confirm backup availability
  - Log into alternate storage: [ALTERNATE_STORAGE_ACCESS]
  - List available backups: [LIST_COMMAND]
  - Identify target backup (most recent prior to corruption/incident)
  - Note: RPO is 24 hours; data since last backup may be unrecoverable

Step 3: Document data loss window
  Record: timestamp of last good backup, timestamp of incident, data loss window

Step 4: Download target backup to recovery host
  Command: [DOWNLOAD_COMMAND] [BACKUP_FILE].enc ./
  Verify checksum: sha256sum --check [BACKUP_FILE].sha256

Step 5: Decrypt backup
  Command: openssl enc -d -aes-256-cbc -pbkdf2 \
            -in [BACKUP_FILE].enc -out [BACKUP_FILE].dump \
            -pass env:BACKUP_ENCRYPTION_KEY
  Securely store decrypted file (permissions 600)

Step 6: Prepare database for restore
  Option A (clean restore): Drop and recreate database
    Command: docker exec ctt-postgres psql -U [DB_USER] -c \
              "DROP DATABASE IF EXISTS cybertabletop_old;
               ALTER DATABASE cybertabletop RENAME TO cybertabletop_old;
               CREATE DATABASE cybertabletop;"

  Option B (partial restore to separate DB, then swap):
    Create cybertabletop_restore, restore there, validate, then swap

Step 7: Restore from backup
  Command: pg_restore -h [DB_HOST] -U [DB_USER] -d cybertabletop \
            --no-privileges --no-owner [BACKUP_FILE].dump
  Expected: Exit code 0 (warnings OK, errors NOT OK)

Step 8: Verify restored data
  Validation queries:
    SELECT COUNT(*) FROM users;
    SELECT COUNT(*) FROM audit_events;
    SELECT MAX(created_at) FROM audit_events;
    SELECT tablename FROM pg_tables WHERE schemaname='public';
  Verify counts are reasonable; verify schema is complete

Step 9: Securely delete decrypted backup files
  Command: shred -u [BACKUP_FILE].dump

Step 10: Run database migrations if needed
  Command: docker compose run --rm backend npx prisma migrate deploy

Step 11: Start application
  Command: docker compose start backend

Step 12: Verify application health and test login

Step 13: Notify users of service restoration; communicate data loss window if applicable

Step 14: Document full restore procedure, backup used, data loss window, and verification results

Step 15: ISSO documents as security incident if data loss was caused by attack
```

**Estimated Total Time:** 2–4 hours

### 5.7 Full Infrastructure Rebuild (Docker Host Failure)

**Use when:** Docker host hardware failure or OS corruption requiring complete rebuild

```
Step 1: Provision replacement server/instance
  - Minimum specs: [CPU/RAM/DISK requirements]
  - OS: [OPERATING SYSTEM AND VERSION]
  - Use pre-configured IaC template if available

Step 2: Harden new host per approved baseline
  - Apply OS security configuration per CMP-CTT-001
  - Run hardening script: [HARDENING_SCRIPT_LOCATION]
  - Run CIS Benchmark scan to verify: docker run --rm --pid host --userns host \
      --cap-add audit_control [CIS_DOCKER_IMAGE]

Step 3: Install Docker and Docker Compose
  Version: Docker [VERSION], Docker Compose [VERSION] (as specified in inventory)

Step 4: Restore application configuration from Git repository
  Command: git clone [REPO_URL] /opt/cybertabletop
  Checkout: approved release tag

Step 5: Restore secrets configuration
  - Retrieve secrets from secrets manager
  - Configure environment variables per [SECRETS_SETUP_PROCEDURE]

Step 6: Pull Docker images from approved registry
  Command: docker compose pull
  Verify image digests against approved baseline

Step 7: Restore database from latest backup
  Follow Section 5.6 Database Restore procedure

Step 8: Start application stack
  Command: docker compose up -d

Step 9: Verify application health (all checks in Section 5.5 Steps 6–10)

Step 10: Update DNS to point to new host (if IP address changed)
  Propagation time: up to 1 hour (verify TTL in advance)

Step 11: Verify TLS certificate is valid on new host

Step 12: Run full system acceptance test:
  - Login as each role (Admin, Facilitator, Participant, Observer)
  - Create test exercise session
  - Verify audit logging is functional
  - Verify backup job is scheduled on new host

Step 13: Notify users of service restoration

Step 14: Document full rebuild
```

**Estimated Total Time:** 4–8 hours (within RTO)

### 5.8 Alternate Site Activation

*Note: Full alternate site procedures are pending development (POAM-007). This section provides interim guidance.*

**Interim Procedure (Containerized Redeployment to Alternate Cloud Region/Provider):**

```
Step 1: Identify alternate infrastructure
  Primary alternate target: [ALTERNATE_INFRASTRUCTURE — e.g., AWS us-west-2 if primary is us-east-1]

Step 2: Provision alternate instance per Section 5.7 Steps 1–6

Step 3: Restore latest backup per Section 5.6

Step 4: Update application to use alternate infrastructure endpoints
  (Configuration: database connection strings, Redis endpoint, etc.)

Step 5: Start application at alternate site

Step 6: Update DNS to point to alternate site

Step 7: Notify users

Step 8: Monitor alternate site for stability

Step 9: Plan for return to primary site once primary is restored
```

---

## 6. Contingency Plan Testing

### 6.1 Annual Test Schedule

| Test Type | Scope | Schedule | Responsible |
|---|---|---|---|
| **Tabletop Exercise** | CP Team walkthrough of scenarios (see Section 6.2) | Annual; Month of [MONTH] | System Owner / ISSO |
| **Backup Restoration Test** | Full database restore to isolated test environment | Semi-annual; [MONTHS] | DBA / Sys Admin |
| **Container Restart Test** | Simulate single container failure; verify recovery | Quarterly | Sys Admin |
| **Full Stack Restart Test** | Stop and restart complete application stack | Annual; coincides with tabletop | Sys Admin |
| **Notification Tree Test** | Verify all contact information is current | Annual; [MONTH] | Contingency Planning Coordinator |

### 6.2 Annual Tabletop Exercise (Meta-Note)

The CyberTabletop platform is itself an IR tabletop exercise platform. Appropriately, the contingency plan testing for CyberTabletop is conducted as a tabletop exercise — using tabletop methodology to rehearse the recovery of the CyberTabletop system.

**Scenario Options for Annual Tabletop:**

**Scenario A: Database Corruption**
*Inject:* "The DBA receives alerts indicating severe PostgreSQL corruption. The application is returning 500 errors. No data modification has occurred in the past hour. It is 3 PM on a Tuesday."
*Decision points:* Activation criteria met? Who is notified? Which backup is used? User communication timing?

**Scenario B: Ransomware Incident**
*Inject:* "The System Administrator discovers all files on the Docker host have been encrypted with a ransomware extension. The ransom note is present. The incident occurred overnight."
*Decision points:* Isolate vs. rebuild? Can backups be trusted (pre-attack)? When was the last clean backup? Law enforcement notification?

**Scenario C: Cloud Provider Outage**
*Inject:* "The cloud provider announces an extended outage in the primary region. ETA for restoration: 8 hours. CyberTabletop is inaccessible."
*Decision points:* Activate alternate site? Notify users? 8-hour outage acceptable given LOW availability?

### 6.3 Test Documentation

Each test produces a test record including:
- Test date and type
- Participants
- Scenario or procedure tested
- Findings (what went wrong, what was unclear)
- Lessons learned
- Plan of Action items to update the contingency plan

### 6.4 Plan Update Triggers

This Contingency Plan is updated:
- Annually (regardless of changes)
- Following any CP activation
- Following each test exercise with lessons learned incorporated
- When system architecture changes significantly
- When personnel change in CP roles

---

## 7. Contact List

### 7.1 Internal Contacts

| Role | Name | Primary Phone | Secondary Phone | Email | Availability |
|---|---|---|---|---|---|
| System Owner | [SYSTEM OWNER NAME] | [PHONE] | [PERSONAL PHONE] | [EMAIL] | 24/7 for activations |
| ISSO | [ISSO NAME] | [PHONE] | [PERSONAL PHONE] | [EMAIL] | 24/7 for activations |
| Technical Recovery Lead (Sys Admin) | [SYSADMIN NAME] | [PHONE] | [PERSONAL PHONE] | [EMAIL] | 24/7 on-call |
| Database Administrator | [DBA NAME] | [PHONE] | [PERSONAL PHONE] | [EMAIL] | On-call; response within 2 hours |
| Backup Sys Admin | [BACKUP SYSADMIN] | [PHONE] | [PERSONAL PHONE] | [EMAIL] | Backup to primary Sys Admin |
| Communications Lead | [COMMS LEAD] | [PHONE] | [PERSONAL PHONE] | [EMAIL] | Business hours + on-call |
| Management Sponsor | [SPONSOR NAME] | [PHONE] | [PERSONAL PHONE] | [EMAIL] | Business hours; urgent off-hours |
| IT Help Desk | N/A | [HELP DESK NUMBER] | — | [HELPDESK EMAIL] | 24/7 |

### 7.2 External Contacts

| Organization | Contact | Phone | Email | Purpose |
|---|---|---|---|---|
| [CLOUD PROVIDER] Support | — | [SUPPORT NUMBER] | [SUPPORT URL] | Infrastructure issues |
| [ISP / Network Provider] | [CONTACT NAME] | [PHONE] | [EMAIL] | Network outage |
| [BACKUP STORAGE PROVIDER] | — | [SUPPORT NUMBER] | [SUPPORT URL] | Backup storage issues |
| [CERTIFICATE AUTHORITY] | — | [SUPPORT NUMBER] | [SUPPORT URL] | TLS certificate issues |
| [IR RETAINER FIRM] | [CONTACT NAME] | [PHONE] | [EMAIL] | Security incident support |
| [ORGANIZATION] Security Operations Center | — | [SOC PHONE] | [SOC EMAIL] | Security incidents |
| US-CERT / CISA | — | 1-888-282-0870 | central@cisa.dhs.gov | Major incident reporting |

---

## 8. Supporting Information

### 8.1 Vital Records

| Record | Location | Backup Location | Sensitivity |
|---|---|---|---|
| PostgreSQL database backups | [ALTERNATE STORAGE URL] | [SECONDARY BACKUP LOCATION] | Sensitive (encrypted) |
| Application source code | [GIT REPOSITORY URL] | [BACKUP GIT MIRROR] | Internal |
| Docker image registry | [REGISTRY URL] | [BACKUP REGISTRY] | Internal |
| TLS certificates and keys | [CERTIFICATE STORAGE LOCATION] | [BACKUP LOCATION] | Sensitive |
| Secrets / environment config | [SECRETS MANAGER URL] | [BACKUP SECRETS MANAGER] | Highly Sensitive |
| System documentation | [DOCUMENTATION LOCATION] | [BACKUP DOCUMENTATION LOCATION] | Internal |

### 8.2 System Dependencies

| Dependency | Criticality | Alternative if Unavailable |
|---|---|---|
| DNS resolution | Critical | Hard-code IP in /etc/hosts as emergency measure |
| TLS certificate CA | Critical | Use self-signed cert temporarily (users will see warning) |
| OIDC Identity Provider (SSO) | High | Fall back to local authentication (SSO users must use local accounts) |
| SMTP relay (email) | Medium | Password resets unavailable; manual admin reset as workaround |
| Container registry | Medium | Use cached images from last successful pull |
| Secrets manager | Critical | Emergency break-glass procedure: printed/sealed emergency credentials in physical safe |

### 8.3 System Diagram Reference

See System Boundary and Architecture Description (BD-CTT-001) for system architecture diagram.

---

## 9. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Prepared By | [SYSTEM OWNER NAME] | _____________ | March 2026 |
| Reviewed By | [ISSO NAME] | _____________ | March 2026 |
| Approved By | [AUTHORIZING OFFICIAL] | _____________ | March 2026 |

*Next Review: March 2027 (annual) or upon system change or CP activation*

---

*Document Version: 1.0 | Classification: UNCLASSIFIED // For Official Use Only*
*CyberTabletop ATO Package — [ORGANIZATION]*
