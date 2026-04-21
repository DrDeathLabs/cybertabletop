# System Boundary Diagram
## CyberTabletop Platform
**Version:** 1.0 | **Date:** March 15, 2026

---

## 1. Authorization Boundary

The CyberTabletop authorization boundary encompasses all hardware, software, firmware, and data components that are under the direct management and control of the System Owner and processed or transmitted by the system.

**System Name:** CyberTabletop
**System Identifier:** CYBERTABLETOP-001
**System Owner:** [Organization Name]
**Hosting:** Self-hosted (on-premises or cloud IaaS/PaaS)

---

## 2. ASCII Architecture Boundary Diagram

```
╔══════════════════════════════════════════════════════════════════════╗
║              CYBERTABLETOP AUTHORIZATION BOUNDARY                    ║
║                                                                      ║
║  ┌──────────────────────────────────────────────────────────────┐   ║
║  │                    HOST OPERATING SYSTEM                      │   ║
║  │                  (Ubuntu 22.04 / RHEL 9 / Windows Server)     │   ║
║  │                                                               │   ║
║  │  ┌─────────────────────────────────────────────────────┐    │   ║
║  │  │              DOCKER COMPOSE NETWORK                  │    │   ║
║  │  │                                                       │    │   ║
║  │  │  ┌──────────┐  ┌──────────┐  ┌─────────┐           │    │   ║
║  │  │  │ Frontend │  │ Backend  │  │  Nginx  │◄──── :443  │    │   ║
║  │  │  │ (React)  │  │(Node.js) │  │(Proxy)  │◄──── :80  │    │   ║
║  │  │  │ :80      │  │ :3001    │  │         │           │    │   ║
║  │  │  └────┬─────┘  └────┬─────┘  └────┬────┘           │    │   ║
║  │  │       │             │              │                 │    │   ║
║  │  │       └─────────────┤              │                 │    │   ║
║  │  │                     │    internal  │                 │    │   ║
║  │  │                     └──────────────                  │    │   ║
║  │  │                     │                                │    │   ║
║  │  │            ┌────────┴────────┐                      │    │   ║
║  │  │            │                 │                      │    │   ║
║  │  │     ┌──────┴─────┐  ┌────────┴────┐                │    │   ║
║  │  │     │ PostgreSQL  │  │    Redis    │                │    │   ║
║  │  │     │  :5432      │  │   :6379     │                │    │   ║
║  │  │     │ (database)  │  │  (sessions) │                │    │   ║
║  │  │     └─────────────┘  └────────────┘                │    │   ║
║  │  │                                                       │    │   ║
║  │  │  ┌────────────────────────────────────┐              │    │   ║
║  │  │  │         PERSISTENT VOLUMES          │              │    │   ║
║  │  │  │  postgres_data | redis_data          │              │    │   ║
║  │  │  │  backend_logs  | nginx_logs          │              │    │   ║
║  │  │  └────────────────────────────────────┘              │    │   ║
║  │  └─────────────────────────────────────────────────────┘    │   ║
║  └──────────────────────────────────────────────────────────────┘   ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
                              │
           ═══════════════════╪══════════════════════
           BOUNDARY CROSSING  │ (TLS 1.2/1.3 only)
           ═══════════════════╪══════════════════════
                              │
                    ┌─────────┴──────────┐
                    │   EXTERNAL USERS    │
                    │  (browsers, mobile) │
                    └────────────────────┘

EXTERNAL SERVICES (outside boundary, accessed via HTTPS):
  ├── Anthropic Claude API (api.anthropic.com) — optional AI feedback
  ├── OIDC Provider (Microsoft Entra ID / Okta) — optional SSO
  └── Ollama Server (host.docker.internal:11434) — optional local LLM
```

---

## 3. Components Within Boundary

### 3.1 Frontend Container (`cybertabletop-frontend`)
- **Type:** Application (static assets served by Nginx)
- **Technology:** React 18, Vite, TypeScript, Tailwind CSS
- **Function:** User interface for facilitators and players
- **Network:** Internal Docker network only (proxied by Nginx)
- **Data Processed:** User session state (browser memory only), no persistent data storage

### 3.2 Backend Container (`cybertabletop-backend`)
- **Type:** Application Server
- **Technology:** Node.js 20, Express 4, TypeScript, Socket.io, Prisma ORM
- **Function:** REST API, real-time WebSocket, authentication, business logic
- **Network:** Internal Docker network only (proxied by Nginx)
- **Data Processed:** User credentials (hashed), session data, exercise decisions, audit logs

### 3.3 Database Container (`cybertabletop-db`)
- **Type:** Database
- **Technology:** PostgreSQL 16
- **Function:** Persistent data storage for all application data
- **Network:** Internal Docker network only (no external exposure)
- **Data At Rest:** User accounts, scenarios, session records, audit logs

### 3.4 Redis Container (`cybertabletop-redis`)
- **Type:** In-Memory Data Store
- **Technology:** Redis 7
- **Function:** Socket.io session adapter, temporary session state
- **Network:** Internal Docker network only
- **Data Processed:** Active session identifiers, transient game state

### 3.5 Nginx Reverse Proxy (`cybertabletop-nginx`)
- **Type:** Reverse Proxy / TLS Terminator
- **Technology:** Nginx 1.27 (Alpine)
- **Function:** TLS termination, rate limiting, request routing
- **Network:** Both internal (to services) and external (host ports 80/443)
- **Security:** Only container with external network exposure

### 3.6 Persistent Volumes
- `postgres_data` — Database files (encrypted at host level in production)
- `redis_data` — Redis persistence files
- `backend_logs` — Application log files
- `nginx_logs` — Access and error logs

### 3.7 Host Operating System
- Provides container runtime (Docker Engine)
- Manages persistent volume storage
- Network stack for port exposure
- Subject to host-level hardening (CIS benchmark)

---

## 4. Boundary Crossing Points

| Entry/Exit | Protocol | Direction | Encryption | Purpose |
|-----------|---------|-----------|-----------|---------|
| Port 443 (Nginx) | HTTPS/WSS | Inbound | TLS 1.2/1.3 | User access |
| Port 80 (Nginx) | HTTP | Inbound | None (redirect to 443) | HTTP→HTTPS redirect |
| Claude API | HTTPS | Outbound | TLS 1.3 | AI feedback (optional) |
| OIDC Provider | HTTPS | Outbound | TLS 1.3 | SSO authentication (optional) |
| Ollama | HTTP | Outbound | None (localhost only) | Local LLM (optional) |

---

## 5. Trust Zones

| Zone | Components | Trust Level |
|------|-----------|------------|
| External Internet | Users, external services | Untrusted |
| DMZ (Nginx) | Reverse proxy only | Limited trust — validates TLS |
| Internal Network | Backend, Frontend | Trusted (internal Docker network) |
| Data Zone | PostgreSQL, Redis | Highly trusted (no external access) |

---

## 6. External Systems and Interconnections

| System | Type | Data Shared | Authorization Required |
|--------|------|------------|----------------------|
| Anthropic Claude API | Cloud API | Exercise context (no PII) | API key |
| OIDC/SSO Provider | Identity Provider | Email, display name | OAuth2/OIDC tokens |
| Ollama | Local service | Exercise context (no PII) | None (localhost) |

No memorandums of understanding (MOUs) or interconnection security agreements (ISAs) are required for optional AI services. If SSO is configured with an enterprise IdP, an ISA may be required per organizational policy.
