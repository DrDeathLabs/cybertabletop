# Risk Assessment
## CyberTabletop Platform

---

| Field | Value |
|---|---|
| **Document Title** | Risk Assessment — CyberTabletop |
| **Document ID** | RA-CTT-001 |
| **System Identifier** | CTT-001 |
| **Version** | 1.0 |
| **Date** | March 2026 |
| **Prepared By** | [ISSO NAME], ISSO |
| **Reviewed By** | [SYSTEM OWNER NAME], System Owner |
| **Organization** | [ORGANIZATION] |
| **Security Categorization** | MODERATE |
| **Next Review** | September 2026 (semi-annual) |

---

## 1. Purpose and Scope

This Risk Assessment (RA) identifies, analyzes, and evaluates security risks to the CyberTabletop information system. The assessment supports the Risk Management Framework (RMF) process as required by NIST SP 800-37 Rev. 2 and fulfills the RA-3 security control requirement.

**Scope:** All components within the CyberTabletop authorization boundary, including the React frontend, Node.js/Express backend, PostgreSQL database, Redis cache, and Nginx reverse proxy, as deployed in Docker containers in [ORGANIZATION]'s on-premises or cloud environment.

**Assessment Methodology:** This assessment follows NIST SP 800-30 Rev. 1, *Guide for Conducting Risk Assessments*. Risk levels are determined by combining likelihood and impact scores using the standard risk matrix below.

---

## 2. Assessment Methodology

### 2.1 Likelihood Definitions

| Level | Score | Description |
|---|---|---|
| **Very High** | 5 | Threat source is highly motivated and capable; controls are largely absent or ineffective; the event is likely to occur within a year |
| **High** | 4 | Threat source is motivated and capable; controls are partially effective; the event could realistically occur within a year |
| **Moderate** | 3 | Threat source is reasonably motivated and capable; controls provide moderate protection; the event may occur |
| **Low** | 2 | Threat source has limited motivation or capability; controls are mostly effective; the event is unlikely |
| **Very Low** | 1 | Threat source is unlikely, unmotivated, or incapable; controls are highly effective; the event is very unlikely |

### 2.2 Impact Definitions

| Level | Score | Description |
|---|---|---|
| **Very High** | 5 | Catastrophic effect on operations; severe or catastrophic harm to individuals; major loss of critical assets; criminal liability |
| **High** | 4 | Severe effect on operations; significant harm to individuals; significant financial or reputational loss; potential litigation |
| **Moderate** | 3 | Significant effect on operations; moderate harm to individuals; moderate financial or reputational impact; manageable disruption |
| **Low** | 2 | Limited effect on operations; minor harm to individuals; limited financial or reputational impact; easily recoverable |
| **Very Low** | 1 | Negligible effect on operations; negligible harm to individuals; minimal financial or reputational impact |

### 2.3 Risk Level Matrix

| | **Very Low Impact (1)** | **Low Impact (2)** | **Moderate Impact (3)** | **High Impact (4)** | **Very High Impact (5)** |
|---|---|---|---|---|---|
| **Very High Likelihood (5)** | Moderate | High | High | Critical | Critical |
| **High Likelihood (4)** | Low | Moderate | High | High | Critical |
| **Moderate Likelihood (3)** | Low | Low | Moderate | High | High |
| **Low Likelihood (2)** | Very Low | Low | Low | Moderate | Moderate |
| **Very Low Likelihood (1)** | Very Low | Very Low | Low | Low | Moderate |

### 2.4 Risk Acceptance Thresholds

| Risk Level | Threshold | Required Action |
|---|---|---|
| **Critical** | Unacceptable | Immediate remediation required; AO notification required; may suspend operations |
| **High** | Unacceptable | Remediation required within 30 days; documented in POA&M; AO notification |
| **Moderate** | Conditionally Acceptable | Remediation required within 90 days; documented in POA&M |
| **Low** | Acceptable | Monitor; remediation within 180 days if resources permit |
| **Very Low** | Acceptable | Accept; note in risk register; no immediate action required |

---

## 3. Threat Identification

### 3.1 Relevant Threat Sources

The following threat sources are considered relevant to CyberTabletop based on the system's characteristics (web application, security professional user base, training platform):

| Threat Source | Type | Motivation | Capability |
|---|---|---|---|
| External Adversary (cybercriminal) | External, Human | Financial gain; disruption; data theft | Moderate to High |
| Nation-State Actor | External, Human | Intelligence gathering; disruption | High |
| Hacktivist | External, Human | Ideological motivation; embarrassment | Low to Moderate |
| Malicious Insider | Internal, Human | Financial gain; grievance; espionage | Moderate (privileged access) |
| Negligent Insider | Internal, Human | Unintentional; carelessness | Moderate |
| Automated Threat (bots, scanners) | External, Technical | Opportunistic; credential stuffing | High (automated scale) |
| Supply Chain Threat | External, Human/Technical | Compromise via third-party components | Moderate |
| Natural/Environmental | Environmental | N/A | Variable |

### 3.2 Relevant Threat Events

- Unauthorized access to user accounts (credential theft, brute force)
- Exploitation of web application vulnerabilities (injection, XSS, CSRF)
- Privilege escalation within the application
- Data exfiltration of user PII and exercise data
- Denial of service attacks
- Session hijacking or token theft
- Supply chain compromise via malicious npm packages
- Insider threat (data theft, sabotage, misuse of privileges)
- Ransomware or malware deployment on server infrastructure
- Social engineering targeting system administrators
- TLS interception or certificate fraud
- Database compromise via exposed credentials
- Configuration error leading to data exposure

---

## 4. Vulnerability Identification

### 4.1 Vulnerability Sources

Vulnerabilities were identified through:
- Review of system architecture and code
- OWASP Top 10 analysis
- npm dependency audit
- Container image vulnerability scanning
- Configuration review
- Threat modeling sessions
- Review of CWE/NVD for relevant technologies

### 4.2 Key Vulnerabilities Identified

| ID | Vulnerability | Component | Severity |
|---|---|---|---|
| V-01 | Player MFA is optional by default | Authentication | Low |
| V-02 | No Web Application Firewall (WAF) | Network | Medium |
| V-03 | Penetration testing not yet completed | Testing | Medium |
| V-04 | Previous logon notification not implemented | Authentication | Low |
| V-05 | Alternate processing site not established | Continuity | Medium |
| V-06 | Supply chain risk assessment not formalized | Third-Party | Medium |
| V-07 | Container base image vulnerabilities (aging) | Container | Variable |
| V-08 | Secrets potentially in environment variables accessible to container processes | Configuration | Medium |
| V-09 | Redis not configured with authentication in all deployment profiles | Database | Medium |
| V-10 | Threat hunting capability not yet operational | Monitoring | Low |
| V-11 | Log aggregation to SIEM not implemented | Monitoring | Medium |
| V-12 | Formal user account recertification process not automated | Access Control | Low |
| V-13 | DDoS protection relies solely on application-layer rate limiting | Availability | Medium |

---

## 5. Risk Register

The following risk register documents all identified risks, their analysis, current controls, residual risk levels, and recommended mitigations. Risks are numbered RA-001 through RA-020.

---

| **Risk ID** | RA-001 |
|---|---|
| **Threat** | Automated credential stuffing / brute-force attack against the login endpoint |
| **Vulnerability** | Login endpoint publicly accessible; password-based authentication susceptible to automated attacks |
| **Likelihood** | High (4) — credential stuffing attacks are extremely common against web applications |
| **Impact** | High (4) — successful attack leads to unauthorized access to user accounts and exercise data |
| **Inherent Risk Level** | Critical |
| **Current Controls** | Account lockout after 5 consecutive failures (AC-7); rate limiting on login and MFA endpoints (SC-5); bcrypt factor 12 slows offline attacks; TOTP MFA enforced for SUPER_ADMIN, ORG_ADMIN, and FACILITATOR; failed login alerting (IR-4) |
| **Residual Risk Level** | Moderate |
| **Recommended Mitigation** | Consider MFA for all player accounts through OIDC/SSO or local operating policy; implement CAPTCHA for high-failure-rate IPs; integrate with threat intelligence feeds for known malicious IPs |
| **POA&M Reference** | POAM-001 closed for privileged MFA; optional player MFA remains operator policy |

---

| **Risk ID** | RA-002 |
|---|---|
| **Threat** | Exploitation of unpatched vulnerability in a system component (Node.js, npm package, PostgreSQL, Redis, Nginx) |
| **Vulnerability** | Software components may contain known vulnerabilities; patching requires operational coordination and introduces deployment risk |
| **Likelihood** | Moderate (3) — vulnerabilities in open-source components are regularly disclosed |
| **Impact** | High (4) — depending on vulnerability, could allow RCE, data exfiltration, or privilege escalation |
| **Inherent Risk Level** | High |
| **Current Controls** | npm audit in CI/CD; monthly vulnerability scanning; patch timelines by severity (critical: 30d) (SI-2, RA-5); Docker image scanning |
| **Residual Risk Level** | Low |
| **Recommended Mitigation** | Implement automated dependency update PRs (Dependabot); establish container image rebuild policy; subscribe to CVE feeds for all components |
| **POA&M Reference** | POAM-003 |

---

| **Risk ID** | RA-003 |
|---|---|
| **Threat** | Injection attack (SQL injection, command injection, NoSQL injection) against API endpoints |
| **Vulnerability** | Web application processing user-supplied input may be vulnerable to injection if validation is bypassed or incomplete |
| **Likelihood** | Low (2) — Prisma ORM provides strong SQLi protection; Zod validates all inputs; defense in depth implemented |
| **Impact** | High (4) — successful injection could lead to full database compromise, data exfiltration, or system takeover |
| **Inherent Risk Level** | High |
| **Current Controls** | Prisma ORM with parameterized queries prevents SQLi (SI-10); Zod input validation on all endpoints (SI-10); no raw SQL queries in application code |
| **Residual Risk Level** | Low |
| **Recommended Mitigation** | Annual penetration testing to validate injection controls; automated SAST scanning for injection patterns; web application firewall as additional layer |
| **POA&M Reference** | POAM-002 (penetration testing) |

---

| **Risk ID** | RA-004 |
|---|---|
| **Threat** | Cross-Site Scripting (XSS) attack via malicious scenario content or user input injected into exercise UI |
| **Vulnerability** | The platform renders user-supplied scenario content and exercise responses in the browser |
| **Likelihood** | Low (2) — React output encoding, CSP, server-side validation, and httpOnly cookies reduce XSS likelihood and impact |
| **Impact** | Moderate (3) — successful XSS could steal session tokens, redirect users, or modify exercise content |
| **Inherent Risk Level** | Moderate |
| **Current Controls** | React output encoding; Content Security Policy via Helmet.js/Nginx (SC-18); httpOnly cookies prevent token theft via JS; Zod server-side input validation |
| **Residual Risk Level** | Very Low |
| **Recommended Mitigation** | Conduct periodic XSS-focused testing; add sanitization for any future rich-text/HTML rendering paths; refine CSP directives to remove unsafe-inline where possible |
| **POA&M Reference** | None (risk accepted at Very Low) |

---

| **Risk ID** | RA-005 |
|---|---|
| **Threat** | Unauthorized privilege escalation — a PLAYER role user gains FACILITATOR, ORG_ADMIN, or SUPER_ADMIN access |
| **Vulnerability** | If RBAC enforcement has flaws or can be bypassed, lower-privileged users could access higher-privileged functions |
| **Likelihood** | Low (2) — RBAC enforced server-side; client-side manipulation cannot bypass server validation; extensive access control testing performed |
| **Impact** | High (4) — unauthorized admin access could compromise all user accounts, system configuration, and audit logs |
| **Inherent Risk Level** | Moderate |
| **Current Controls** | Server-side RBAC enforcement via Express middleware (AC-3, AC-6); HTTP 403 responses for unauthorized attempts; JWT role claims and current user record validated for protected requests |
| **Residual Risk Level** | Very Low |
| **Recommended Mitigation** | Annual penetration testing with specific RBAC bypass test cases; automated authorization testing in CI/CD; log monitoring for 403 pattern analysis |
| **POA&M Reference** | POAM-002 (penetration testing scope) |

---

| **Risk ID** | RA-006 |
|---|---|
| **Threat** | Session hijacking — attacker intercepts or steals a valid user session token |
| **Vulnerability** | Session tokens transmitted over network or accessible in browser storage could be intercepted |
| **Likelihood** | Low (2) — TLS enforced for all connections; httpOnly cookies prevent JS access; HSTS prevents downgrade |
| **Impact** | Moderate (3) — stolen session provides access as that user for remainder of session; impact bounded by user's role |
| **Inherent Risk Level** | Low |
| **Current Controls** | TLS 1.2+ enforced at Nginx (SC-8); httpOnly + Secure + SameSite cookie attributes (SC-23); HSTS with long max-age (SC-8); short-lived access tokens and server-side hashed refresh-token rotation/revocation (AC-12) |
| **Residual Risk Level** | Very Low |
| **Recommended Mitigation** | Monitor for concurrent session anomalies; implement session binding to additional contextual factors; maintain TLS configuration currency |
| **POA&M Reference** | None (risk accepted at Very Low) |

---

| **Risk ID** | RA-007 |
|---|---|
| **Threat** | Denial of Service (DoS) attack — overwhelming the application with requests, rendering it unavailable |
| **Vulnerability** | Publicly accessible login and API endpoints; application-layer rate limiting is the primary protection; no CDN or WAF |
| **Likelihood** | Moderate (3) — DoS attacks against web applications are common and relatively easy to execute |
| **Impact** | Moderate (3) — given LOW availability impact per FIPS 199, exercises would be disrupted but no safety or mission-critical impact |
| **Inherent Risk Level** | Moderate |
| **Current Controls** | Rate limiting at application layer (SC-5); Nginx connection limits; request size limits; containerized architecture enables rapid scaling (limited protection) |
| **Residual Risk Level** | Low |
| **Recommended Mitigation** | Implement upstream DDoS protection (cloud provider, CDN); consider WAF deployment; document DoS response procedures in IRP |
| **POA&M Reference** | POAM-006 |

---

| **Risk ID** | RA-008 |
|---|---|
| **Threat** | Malicious insider — authorized user with privileged access intentionally exfiltrates data or sabotages the system |
| **Vulnerability** | Privileged users (Admins, Facilitators) have access to sensitive data and system functions |
| **Likelihood** | Low (2) — background checks required; least privilege implemented; access reviews conducted; small privileged user population |
| **Impact** | High (4) — privileged insider could access all user accounts, export exercise data, modify configurations, or tamper with audit logs |
| **Inherent Risk Level** | Moderate |
| **Current Controls** | Background checks and periodic access reviews are operator responsibilities; the application enforces least privilege (AC-6), separation of duties through RBAC (AC-5), and audit logging of privileged events (AU-9, AC-6(9)); application code does not expose audit update/delete workflows |
| **Residual Risk Level** | Low |
| **Recommended Mitigation** | Implement user behavior analytics (UBA) alerting for anomalous data access patterns; enforce dual control for critical administrative operations; conduct quarterly access reviews |
| **POA&M Reference** | None (residual risk accepted at Low) |

---

| **Risk ID** | RA-009 |
|---|---|
| **Threat** | Supply chain compromise — malicious code introduced via a compromised npm package or Docker base image |
| **Vulnerability** | System relies on numerous third-party open-source packages; supply chain attacks against npm ecosystem are increasing |
| **Likelihood** | Moderate (3) — npm supply chain attacks are a documented and growing threat; package ecosystem is large |
| **Impact** | High (4) — malicious package could introduce backdoor, exfiltrate data, or provide persistent access |
| **Inherent Risk Level** | High |
| **Current Controls** | npm audit in CI/CD; package-lock.json integrity; Dependabot alerts; Docker image scanning; images from approved registries; code review for new dependencies |
| **Residual Risk Level** | Moderate |
| **Recommended Mitigation** | Formalize supply chain risk assessment (SCRM); implement npm package signing verification; use private npm registry with vetted packages; establish formal third-party component review process |
| **POA&M Reference** | POAM-008 |

---

| **Risk ID** | RA-010 |
|---|---|
| **Threat** | Unauthorized access via compromised administrator credentials (phishing, credential theft) |
| **Vulnerability** | Administrator accounts have broad system access; if credentials are compromised, full system compromise is possible |
| **Likelihood** | Low (2) — administrator accounts are small in number; MFA required; access from VPN required |
| **Impact** | Very High (5) — compromised admin account enables full system access, account manipulation, audit log access, and potential data destruction |
| **Inherent Risk Level** | Moderate |
| **Current Controls** | TOTP MFA required for SUPER_ADMIN, ORG_ADMIN, and FACILITATOR accounts (IA-2(1)); VPN + MFA for remote infrastructure access (AC-17); account lockout (AC-7); privileged action audit logging (AC-6(9)); named admin accounts (no shared credentials) |
| **Residual Risk Level** | Low |
| **Recommended Mitigation** | Implement privileged access workstations (PAWs) for admin functions; consider just-in-time (JIT) privileged access; conduct phishing simulation training targeting admins; implement admin session monitoring |
| **POA&M Reference** | None (residual risk accepted at Low) |

---

| **Risk ID** | RA-011 |
|---|---|
| **Threat** | Data breach — unauthorized exfiltration of user PII (email addresses, display names) and exercise data |
| **Vulnerability** | User PII and exercise data stored in PostgreSQL; breach could occur via application compromise, database exposure, or backup theft |
| **Likelihood** | Low (2) — database not externally exposed; application input validation reduces SQLi risk; backup encryption depends on operator configuration |
| **Impact** | High (4) — PII exposure affecting security professionals could enable targeted attacks; exercise data could reveal organizational IR gaps; regulatory notification requirements |
| **Inherent Risk Level** | Moderate |
| **Current Controls** | Database not externally accessible; TLS encryption in transit (SC-8); application-level encryption for TOTP MFA secrets; bcrypt hashed passwords; Prisma ORM prevents SQLi; backup encryption is operator-controlled (CP-9) |
| **Residual Risk Level** | Low |
| **Recommended Mitigation** | Implement column-level encryption for email addresses; establish data breach notification procedures; minimize PII collection; consider pseudonymization of user identifiers in exercise records |
| **POA&M Reference** | None (residual risk accepted at Low) |

---

| **Risk ID** | RA-012 |
|---|---|
| **Threat** | Ransomware deployment on the Docker host or cloud infrastructure |
| **Vulnerability** | System infrastructure could be targeted by ransomware delivered via phishing, unpatched vulnerabilities, or stolen credentials |
| **Likelihood** | Low (2) — containerized architecture provides some isolation; endpoint security on Docker host provides protection |
| **Impact** | High (4) — ransomware could encrypt database volumes, backups, and configuration; recovery time could exceed RTO; data loss possible |
| **Inherent Risk Level** | Moderate |
| **Current Controls** | Encrypted offsite backups (CP-9); containerized isolation limits lateral movement; host endpoint security; access controls on Docker host; patch management (SI-2, MA-6) |
| **Residual Risk Level** | Low |
| **Recommended Mitigation** | Implement immutable backup storage (WORM); test backup restoration monthly; implement network segmentation to limit lateral movement; ensure anti-malware on Docker host |
| **POA&M Reference** | None (residual risk accepted at Low) |

---

| **Risk ID** | RA-013 |
|---|---|
| **Threat** | TLS certificate expiration causing service outage or degraded security |
| **Vulnerability** | If TLS certificate expires without renewal, HSTS enforcement could make the site inaccessible to browsers or force users to bypass security warnings |
| **Likelihood** | Low (2) — certificate monitoring alerts configured; renewal process documented |
| **Impact** | Moderate (3) — service unavailability for users; potential for users to bypass security warnings if they disable TLS verification |
| **Inherent Risk Level** | Low |
| **Current Controls** | Certificate expiration monitoring with alerts at 30 days (SC-17); documented renewal procedures; HSTS with long max-age |
| **Residual Risk Level** | Very Low |
| **Recommended Mitigation** | Implement automated certificate renewal (Let's Encrypt / ACME protocol); configure monitoring at 60-day and 30-day thresholds; include certificate validation in monthly operational checks |
| **POA&M Reference** | None (risk accepted at Very Low) |

---

| **Risk ID** | RA-014 |
|---|---|
| **Threat** | Misconfiguration of Docker containers or Nginx exposing sensitive internal services |
| **Vulnerability** | Misconfiguration of port mappings, network settings, or Nginx proxy rules could inadvertently expose internal services (PostgreSQL, Redis, Node.js) to external networks |
| **Likelihood** | Low (2) — configuration stored in version control; change control process; configuration review in deployment checklist |
| **Impact** | Very High (5) — exposure of PostgreSQL or Redis directly to the internet would enable direct database compromise |
| **Inherent Risk Level** | Moderate |
| **Current Controls** | Docker Compose network configuration reviewed before deployment (CM-3); change control process (CM-3); Nginx configured to proxy only to approved backend endpoints; firewall rules restrict external access to 80/443 only; deployment verification checklist (SI-6) |
| **Residual Risk Level** | Low |
| **Recommended Mitigation** | Implement automated configuration scanning (e.g., Docker Bench Security); regular external port scans to validate exposed services; infrastructure-as-code policy checks in CI/CD |
| **POA&M Reference** | None (residual risk accepted at Low) |

---

| **Risk ID** | RA-015 |
|---|---|
| **Threat** | Compromise or unauthorized access via OIDC SSO integration — misconfigured redirect URIs, token leakage, or OIDC provider compromise |
| **Vulnerability** | OIDC integration introduces dependency on external identity provider; misconfiguration of redirect URIs or token handling could enable authentication bypass |
| **Likelihood** | Low (2) — OIDC configuration reviewed; redirect URIs whitelisted; token validation implemented per specification |
| **Impact** | High (4) — successful OIDC attack could enable unauthorized access to any account that uses SSO |
| **Inherent Risk Level** | Moderate |
| **Current Controls** | OIDC redirect URIs explicitly whitelisted (no wildcards); JWT token validation including issuer, audience, and expiration; ISA with identity provider (CA-3); state parameter used for CSRF prevention |
| **Residual Risk Level** | Low |
| **Recommended Mitigation** | Annual review of OIDC configuration; implement token binding; monitor for anomalous OIDC authentication patterns; document OIDC provider compromise response in IRP |
| **POA&M Reference** | None (residual risk accepted at Low) |

---

| **Risk ID** | RA-016 |
|---|---|
| **Threat** | Audit log tampering — authorized user with database access modifies audit records to conceal malicious activity |
| **Vulnerability** | A sufficiently privileged database user could potentially modify audit records at the database level unless the operator forwards logs to tamper-resistant external storage |
| **Likelihood** | Very Low (1) — audit modification is not exposed through the application; DBA access should be controlled and logged by the operator |
| **Impact** | High (4) — tampered audit logs undermine non-repudiation, forensic capability, and compliance |
| **Inherent Risk Level** | Low |
| **Current Controls** | Application-managed audit records (AU-9); no application workflow to edit or delete audit entries; DBA access should be controlled and documented; operators should forward audit logs to separate storage or SIEM for tamper resistance |
| **Residual Risk Level** | Very Low |
| **Recommended Mitigation** | Implement write-once audit log storage or SIEM forwarding for real-time audit log duplication; cryptographic audit log signing to detect modification; separate DBA role from ISSO role |
| **POA&M Reference** | POAM-010 (SIEM integration) |

---

| **Risk ID** | RA-017 |
|---|---|
| **Threat** | Unplanned system outage due to infrastructure failure (hardware failure, cloud provider incident, network outage) |
| **Vulnerability** | Single-instance deployment without redundancy; no alternate processing site currently established |
| **Likelihood** | Moderate (3) — infrastructure failures are common; average MTTR for cloud instances typically 1-4 hours |
| **Impact** | Low (2) — availability is LOW impact per FIPS 199; exercises can be rescheduled; no safety-critical functions affected |
| **Inherent Risk Level** | Low |
| **Current Controls** | PostgreSQL backup and restore scripts provided (CP-9/CP-10); documented recovery procedures; containerized architecture enables rapid redeployment; operator must schedule backups and complete restore drills |
| **Residual Risk Level** | Very Low |
| **Recommended Mitigation** | Document and test alternate site redeployment procedures; consider container orchestration (Kubernetes) for improved availability; conduct quarterly backup restoration tests |
| **POA&M Reference** | POAM-007 (alternate processing site) |

---

| **Risk ID** | RA-018 |
|---|---|
| **Threat** | Information disclosure through verbose error messages — application errors revealing system internals to attackers |
| **Vulnerability** | Unhandled exceptions may expose stack traces, file paths, database schema, or configuration details |
| **Likelihood** | Moderate (3) — error handling gaps are common in web applications; automated scanners actively probe for error messages |
| **Impact** | Low (2) — information disclosure aids attacker reconnaissance but does not by itself enable direct system access |
| **Inherent Risk Level** | Low |
| **Current Controls** | Generic error messages in production (SI-15); stack traces logged server-side only; NODE_ENV=production disables debug output; error handling middleware configured |
| **Residual Risk Level** | Very Low |
| **Recommended Mitigation** | Conduct periodic error handling testing; include error message disclosure in penetration testing scope; implement error message testing in CI/CD security tests |
| **POA&M Reference** | None (risk accepted at Very Low) |

---

| **Risk ID** | RA-019 |
|---|---|
| **Threat** | Unauthorized access to backup media — encrypted backup files accessed, decrypted, or stolen by unauthorized parties |
| **Vulnerability** | Backup media contains all system data; if encryption key is compromised or backup storage is breached, full data compromise possible |
| **Likelihood** | Very Low (1) — backup media is encrypted; storage access is restricted; encryption key is separately managed |
| **Impact** | High (4) — backup compromise could expose all historical user and exercise data |
| **Inherent Risk Level** | Low |
| **Current Controls** | Backup scripts provided; operators are responsible for access-controlled backup storage, encryption, key management, and backup access logging appropriate to their deployment |
| **Residual Risk Level** | Very Low |
| **Recommended Mitigation** | Implement backup integrity verification; store encryption keys in hardware security module (HSM) or key management service; review backup storage access quarterly |
| **POA&M Reference** | None (risk accepted at Very Low) |

---

| **Risk ID** | RA-020 |
|---|---|
| **Threat** | Compromise of Redis real-time state cache — attacker disrupts or manipulates game/session runtime state |
| **Vulnerability** | Redis stores real-time/cache data for the application; if Redis is directly accessible or has weak authentication, an attacker could disrupt active exercises or access transient runtime data |
| **Likelihood** | Very Low (1) — Redis is not externally accessible; bound to Docker internal network only; authentication configured in production profiles |
| **Impact** | Moderate (3) — compromise could disrupt active exercises or expose transient runtime state; login refresh tokens are stored as server-side hashes in PostgreSQL, not Redis |
| **Inherent Risk Level** | Moderate |
| **Current Controls** | Redis bound to Docker internal network (SC-7); Redis authentication configured; network segmentation prevents external access; access tokens are short-lived and refresh tokens are stored as server-side hashes (AC-12) |
| **Residual Risk Level** | Low |
| **Recommended Mitigation** | Verify Redis authentication is enforced in all deployment profiles; implement Redis ACLs to restrict commands; consider Redis TLS for internal communications; audit Redis configuration in deployment checklist |
| **POA&M Reference** | None (residual risk accepted at Low) |

---

## 6. Risk Summary

### 6.1 Risk Distribution

| Risk Level | Inherent Count | Residual Count |
|---|---|---|
| Critical | 1 | 0 |
| High | 4 | 0 |
| Moderate | 12 | 4 |
| Low | 3 | 10 |
| Very Low | 0 | 6 |
| **Total** | **20** | **20** |

### 6.2 Risks Requiring POA&M Action

| Risk ID | Risk Description | Residual Risk | POA&M Reference |
|---|---|---|---|
| RA-001 | Credential stuffing / brute force | Moderate | POAM-001 closed for privileged MFA; consider player MFA policy |
| RA-002 | Unpatched component vulnerabilities | Low | POAM-003 |
| RA-007 | Denial of service | Low | POAM-006 |
| RA-009 | Supply chain compromise | Moderate | POAM-008 |
| RA-010 | Compromised admin credentials | Low | (accepted) |
| RA-016 | Audit log tampering | Very Low | POAM-010 |

### 6.3 Accepted Risks

The following residual risks are accepted by the System Owner and Authorizing Official at the current level without specific POA&M items, subject to annual review:

| Risk ID | Risk Description | Residual Risk | Basis for Acceptance |
|---|---|---|---|
| RA-003 | SQL/injection attacks | Low | Prisma ORM + Zod provide strong protection; pentest will validate |
| RA-004 | Cross-Site Scripting | Very Low | React output encoding, CSP, httpOnly cookies, and Zod validation provide defense in depth |
| RA-005 | Privilege escalation | Very Low | Server-side RBAC; no client-side bypass possible |
| RA-006 | Session hijacking | Very Low | TLS + httpOnly + HSTS eliminate primary attack vectors |
| RA-008 | Malicious insider | Low | Background checks + audit logging + separation of duties |
| RA-011 | Data breach | Low | Encryption in transit and at rest; DB not externally exposed |
| RA-012 | Ransomware | Low | Encrypted offsite backups; containerized isolation |
| RA-013 | TLS certificate expiration | Very Low | Monitoring alerts; automated renewal planned |
| RA-014 | Misconfiguration exposing services | Low | Version-controlled config; change control; deployment verification |
| RA-015 | OIDC SSO attack | Low | Redirect URI whitelisting; token validation |
| RA-017 | Infrastructure outage | Very Low | Availability is LOW impact; RTO 4 hours acceptable |
| RA-018 | Verbose error messages | Very Low | Generic production errors; server-side logging |
| RA-019 | Backup media compromise | Very Low | Operator-controlled backup encryption and key management required |
| RA-020 | Redis real-time state cache compromise | Low | Internal network only; authentication configured |

---

## 7. Recommendations Summary

1. **Consider MFA for all player accounts** — Priority: Medium. Privileged local MFA is implemented; organizations with stricter requirements should mandate MFA for players through OIDC/SSO or operating policy.
2. **Complete penetration testing** — Priority: High. Required for ATO; validates all technical controls.
3. **Formalize supply chain risk assessment** — Priority: Medium. Growing threat to npm ecosystem.
4. **Implement SIEM or centralized log aggregation** — Priority: Medium. Enhances detection capability.
5. **Deploy Web Application Firewall (WAF)** — Priority: Medium. Additional protection against application attacks.
6. **Establish alternate processing site capability** — Priority: Medium. Supports contingency planning.
7. **Implement automated dependency updates** — Priority: Medium. Reduces window of exposure for known CVEs.
8. **Implement immutable backup storage** — Priority: Low. Enhances ransomware recovery capability.
9. **Develop threat hunting capability** — Priority: Low. Proactive detection of advanced threats.
10. **Implement column-level PII encryption** — Priority: Low. Enhanced protection for email addresses.

---

## 8. Review and Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Prepared By | [ISSO NAME] | _____________ | March 2026 |
| Reviewed By | [SYSTEM OWNER NAME] | _____________ | March 2026 |
| Accepted By | [AUTHORIZING OFFICIAL] | _____________ | March 2026 |

*Next Review: September 2026 (semi-annual review cycle)*

---

*Document Version: 1.0 | Classification: UNCLASSIFIED // For Official Use Only*
*CyberTabletop ATO Package — [ORGANIZATION]*
