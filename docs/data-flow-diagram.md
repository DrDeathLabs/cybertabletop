# Data Flow Diagram
## CyberTabletop Platform
**Version:** 1.0 | **Date:** March 15, 2026

---

## 1. Overview

This document describes all data flows within and across the CyberTabletop system boundary, including data at rest, data in transit, encryption points, and trust boundary crossings.

---

## 2. Primary Data Flows

### 2.1 Authentication Flow (Local)

```
User Browser                 Nginx                    Backend               PostgreSQL
     │                         │                         │                       │
     │──── POST /api/auth/login ──────────────────────────►                      │
     │     {email, password}   │                         │                       │
     │                         │ HTTPS (TLS 1.3)         │                       │
     │                         │──── proxy ─────────────►│                       │
     │                         │                         │── SELECT user WHERE ──►
     │                         │                         │    email=?             │
     │                         │                         │◄── {user record} ──────
     │                         │                         │                       │
     │                         │                         │ bcrypt.compare()      │
     │                         │                         │ [credential check]    │
     │                         │                         │                       │
     │                         │                         │── INSERT audit_log ──►│
     │                         │                         │                       │
     │◄── Set-Cookie: access_token (httpOnly, Secure) ───│                       │
     │    Set-Cookie: refresh_token (httpOnly, Secure)   │                       │
     │                         │                         │                       │
```

**Encryption:** HTTPS/TLS 1.3 in transit; bcrypt (cost 12) for passwords at rest

---

### 2.2 Authentication Flow (SSO/OIDC)

```
User Browser            Nginx           Backend           OIDC Provider (External)
     │                    │                │                       │
     │── GET /api/auth/sso ────────────────►                       │
     │                    │                │                       │
     │◄── 302 Redirect to OIDC Provider ───│                       │
     │                    │                │                       │
     │──────────────────────────────────────────────────────────────►
     │   [User authenticates with IdP]     │                       │
     │◄──────────────────────────────────────── Authorization Code ──
     │                    │                │                       │
     │── GET /api/auth/sso/callback ───────►                       │
     │    ?code=XXX&state=YYY              │                       │
     │                    │                │──── Token Exchange ───►
     │                    │                │◄─── id_token, access ──
     │                    │                │                       │
     │                    │                │── UserInfo endpoint ──►
     │                    │                │◄── {email, name, sub} ─
     │                    │                │                       │
     │◄── Set-Cookie: access_token ────────│                       │
```

**Note:** No passwords flow through the system in SSO mode. User identity is established by the external IdP.

---

### 2.3 Real-Time Game Session Flow (Socket.io)

```
Facilitator Browser    Nginx (WSS proxy)    Backend (Socket.io)    PostgreSQL
        │                     │                      │                   │
        │──── WS Upgrade ──────────────────────────►│                   │
        │     Authorization: Bearer <JWT>            │                   │
        │                     │                      │ [JWT verified]    │
        │                     │                      │                   │
        │──── facilitator:next-inject ────────────►  │                   │
        │     {sessionId, injectId}                  │                   │
        │                     │                      │── UPDATE session ─►
        │                     │                      │── INSERT audit ───►
        │                     │                      │                   │
        │                     │◄──── Broadcast to all players in room ────
        │                     │      session:inject-presented             │
        │                     │                      │                   │

Player Browser         Nginx (WSS proxy)    Backend (Socket.io)    PostgreSQL
        │                     │                      │                   │
        │──── player:decision ─────────────────────►│                   │
        │     {sessionId, injectId, optionId}        │                   │
        │                     │                      │── SELECT option ──►
        │                     │                      │◄── option data ────
        │                     │                      │                   │
        │                     │                      │ [calculate score] │
        │                     │                      │ [generate AI feedback]
        │                     │                      │                   │
        │                     │                      │── INSERT decision ─►
        │                     │                      │── INSERT audit ───►
        │                     │                      │                   │
        │◄─── player:decision-ack ─────────────────── │                   │
        │     {score, feedback, isOptimal}            │                   │
```

---

### 2.4 AI Feedback Flow (Claude API — optional)

```
Backend                          Anthropic Claude API (External)
    │                                       │
    │  [Player submits decision]            │
    │                                       │
    │──── HTTPS POST /v1/messages ─────────►│
    │     {model, messages, system}         │
    │     Content: exercise context + decision
    │     NO PII transmitted                │
    │                                       │
    │◄─── {feedback text} ──────────────────│
    │                                       │
    │  [Store feedback in Decision record]  │
    │  [Return to player via Socket.io]     │
```

**Data minimization:** Only exercise context (scenario narrative, player's chosen option, role) is sent to Claude API. No user PII, emails, or identifying information is transmitted.

---

### 2.5 Data Modification Flow (REST API)

```
Authenticated User    Nginx            Backend           PostgreSQL
        │                │                │                  │
        │── HTTPS request ────────────────►                  │
        │   Cookie: access_token          │                  │
        │                │                │                  │
        │                │                │ [JWT verified]   │
        │                │                │ [Zod validation] │
        │                │                │ [RBAC check]     │
        │                │                │                  │
        │                │                │── Prisma ORM ───►│
        │                │                │   (parameterized │
        │                │                │    query)        │
        │                │                │◄── result ────────
        │                │                │                  │
        │                │                │── INSERT audit ──►
        │                │                │                  │
        │◄── JSON response ───────────────│                  │
```

---

## 3. Data at Rest Inventory

| Data Element | Location | Encryption | Sensitivity |
|-------------|---------|-----------|-------------|
| User password hashes (bcrypt) | PostgreSQL `users` table | bcrypt (cost 12) + DB volume encryption | HIGH |
| JWT secrets | `.env` file / Docker environment | Host filesystem (encrypt in production) | HIGH |
| User email addresses | PostgreSQL `users` table | DB volume encryption | MODERATE |
| User display names | PostgreSQL `users` table | DB volume encryption | LOW |
| SSO tokens/secrets | `.env` / Secrets Manager | Host filesystem / Secrets Manager | HIGH |
| Exercise scenario content | PostgreSQL `scenarios`, `injects` tables | DB volume encryption | LOW |
| Session/decision records | PostgreSQL `sessions`, `decisions` tables | DB volume encryption | LOW |
| Audit logs | PostgreSQL `audit_logs` table | DB volume encryption | MODERATE |
| Application logs | Docker volume `backend_logs` | Host filesystem | MODERATE |
| Access logs | Docker volume `nginx_logs` | Host filesystem | LOW |

### At-Rest Encryption Recommendations (Production)
- **Database volume**: Use encrypted EBS (AWS) or Azure Managed Disks with encryption enabled
- **Secrets**: Use AWS Secrets Manager, Azure Key Vault, or HashiCorp Vault instead of `.env` file
- **Log volumes**: Encrypt host filesystem or use encrypted log shipping (e.g., CloudWatch, Log Analytics)

---

## 4. Data in Transit Protection

| Flow | Protocol | TLS Version | Certificate |
|------|---------|------------|------------|
| User ↔ Nginx | HTTPS/WSS | TLS 1.2/1.3 | Org CA or Let's Encrypt |
| Nginx ↔ Backend | HTTP (internal Docker network) | N/A (private network) | N/A |
| Nginx ↔ Frontend | HTTP (internal Docker network) | N/A (private network) | N/A |
| Backend ↔ PostgreSQL | PostgreSQL protocol (internal) | Optional (enable in production) | N/A |
| Backend ↔ Redis | Redis protocol (internal) | Optional (enable in production) | N/A |
| Backend ↔ Claude API | HTTPS | TLS 1.3 | Anthropic CA |
| Backend ↔ OIDC Provider | HTTPS | TLS 1.3 | Provider CA |

**Note:** For production deployments, enable TLS on the PostgreSQL and Redis connections using `DATABASE_URL=postgresql://...?sslmode=verify-full` and Redis TLS configuration.

---

## 5. Trust Boundaries Crossed

| Crossing | From | To | Data Transmitted | Protection |
|---------|------|-----|-----------------|-----------|
| External→Nginx | Internet | Authorization boundary | Encrypted user requests | TLS 1.2/1.3 |
| Nginx→Backend | Nginx | Backend | Proxied HTTP requests | Internal Docker network |
| Backend→Database | Application | Data store | SQL queries + results | Internal Docker network |
| Backend→Claude API | Authorization boundary | External cloud | Exercise context only | TLS 1.3 + API key |
| Backend→OIDC | Authorization boundary | External IdP | Authorization codes, tokens | TLS 1.3 |

---

## 6. Data Retention and Disposal

| Data Type | Retention Period | Disposal Method |
|-----------|----------------|----------------|
| Audit logs | 3 years (or per policy) | Secure database deletion + volume wipe |
| User accounts | Duration of account + 90 days | Logical deletion, data anonymization |
| Session/exercise records | 2 years | Logical deletion |
| Application logs | 90 days | Log rotation + secure deletion |
| Nginx access logs | 90 days | Log rotation + secure deletion |

**Secure Disposal:** When decommissioning the system, all Docker volumes containing sensitive data must be securely wiped using `docker volume rm` followed by host-level secure erasure of the storage medium.
