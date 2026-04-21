# Control Implementation Matrix
## CyberTabletop Platform

---

| Field | Value |
|---|---|
| **Document Title** | Control Implementation Matrix — CyberTabletop |
| **System Identifier** | CTT-001 |
| **Version** | 1.0 |
| **Date** | March 2026 |
| **Prepared By** | [ISSO NAME] |
| **Organization** | [ORGANIZATION] |
| **Security Categorization** | MODERATE |

---

## Purpose

This matrix provides an at-a-glance reference for the implementation status of all NIST SP 800-53 Rev. 5 security controls applicable to CyberTabletop. Each entry identifies the control, its implementation status, a brief implementation description, the responsible party, and the location of supporting evidence.

**Status Legend:**
- **I** — Implemented
- **PI** — Partially Implemented
- **P** — Planned
- **NA** — Not Applicable
- **INH** — Inherited from common control provider

---

## Access Control (AC)

| Control ID | Control Name | Status | Implementation Description | Responsible Party | Evidence Location |
|---|---|---|---|---|---|
| AC-1 | Policy and Procedures | I | Access control policy documented in [ORGANIZATION] IS Policy and this SSP; reviewed annually | ISSO / System Owner | [ORGANIZATION] IS Policy; SSP Section 6.1 |
| AC-2 | Account Management | I | Four application roles (`SUPER_ADMIN`, `ORG_ADMIN`, `FACILITATOR`, `PLAYER`); first non-system account becomes SUPER_ADMIN; invite-gated registration and admin role management supported | System Admin / ISSO | SSP §6.1; Account Management SOP; Audit Logs |
| AC-2(1) | Automated Account Management | PI | Account lockout after 5 failed login attempts; first-account bootstrap to SUPER_ADMIN; role changes and user lifecycle events are audit logged. Automated inactivity disable and notification workflow are operator/planned controls. | System / Operator | Application Code; Audit Logs; Operator Policy |
| AC-2(2) | Temp/Emergency Account Management | PI | The application supports admin role changes and account deletion, but does not currently enforce temporary-account expiration dates. Operators should manage temporary access through OIDC/SSO or documented local access reviews. | System Admin | Operator Policy; Audit Logs |
| AC-2(3) | Disable Accounts | I | Non-destructive disablement; accounts disabled within 1 business day of termination notification | System Admin / HR | HR Termination SOP; Audit Logs |
| AC-2(4) | Automated Audit of Account Actions | I | All account CRUD and role change events auto-logged in PostgreSQL audit_events table | System (Automated) | Audit Log Schema; Application Middleware |
| AC-3 | Access Enforcement | I | RBAC enforced at API layer on every endpoint via Express middleware; JWT validation on all protected routes | Dev Team / System | API Authorization Middleware; Role-Permission Matrix |
| AC-4 | Information Flow Enforcement | I | Nginx restricts inbound to HTTPS 443; Docker network prevents external DB/cache access; CSP via Helmet.js | Dev Team / Net Admin | Nginx Config; Docker Compose Network Config; Helmet.js Config |
| AC-5 | Separation of Duties | I | Four-role RBAC prevents single-role accumulation of admin+facilitation functions; dual approval for production changes | System Owner / Dev Team | RBAC Role Definitions; Change Control SOP |
| AC-6 | Least Privilege | I | Roles assigned minimum required permissions; service accounts use minimal DB permissions (no DROP/CREATE/GRANT) | Dev Team / Sys Admin | Role-Permission Matrix; DB Permission Grants; Docker User Config |
| AC-6(1) | Authorize Access to Security Functions | I | Security functions restricted to SUPER_ADMIN and ORG_ADMIN as appropriate; access list should be maintained and reviewed by the operator | Sys Admin / ISSO | Role Definition; Access Review |
| AC-6(2) | Non-Privileged Access for Non-Privileged Functions | I | Admins use separate contexts for admin vs. standard functions | Dev Team | Application Role Switching Logic |
| AC-6(9) | Log Use of Privileged Functions | I | All privileged function invocations logged with user identity, timestamp, and function | System (Automated) | Audit Log; Privileged Functions List |
| AC-6(10) | Prohibit Privileged Functions by Non-Privileged Users | I | API middleware returns HTTP 403 and generates audit entry for unauthorized privilege attempts | Dev Team / System | API Authorization Middleware; Audit Logs |
| AC-7 | Unsuccessful Logon Attempts | I | Account lockout after 5 consecutive failures; 30-minute auto-unlock; failed-login and lockout events visible in audit/security dashboard | System (Automated) | Lockout Configuration; Audit Logs; Security Dashboard |
| AC-8 | System Use Notification | P / OD | CyberTabletop does not currently include a configurable pre-login banner; operators should provide required notice through the identity provider, public reverse proxy, or surrounding access portal | Sys Admin / ISSO | Operator Policy; IdP/Reverse Proxy Configuration |
| AC-9 | Previous Logon Notification | P | Not currently displayed at login; tracked in POA&M for future implementation | Dev Team | POA&M POAM-005 |
| AC-10 | Concurrent Session Control | P / OD | No per-user concurrent-session cap is currently enforced by the application; operators can add IdP/reverse-proxy session controls where required. Short-lived access tokens and refresh-token rotation limit stale-session exposure. | System / Operator | Token Config; Operator Policy |
| AC-11 | Device Lock | NA | Web application; device lock is end-user workstation responsibility outside authorization boundary | N/A | Tailoring Rationale in SSP |
| AC-12 | Session Termination | I | Short-lived access tokens, server-side hashed refresh tokens with rotation/revocation, and cookie clearing on logout | System (Automated) | Token Config; RefreshToken Table; Logout Route |
| AC-14 | Permitted Actions Without I&A | I | Only login page viewing and credential submission permitted unauthenticated; all functional content requires auth | Dev Team | Application Route Configuration |
| AC-17 | Remote Access | I | User access via HTTPS only; admin access requires VPN + MFA; database ports not externally exposed | Net Admin / Sys Admin | Nginx Config; VPN Policy; Firewall Rules |
| AC-18 | Wireless Access | INH | Inherited from [ORGANIZATION] wireless network security program | [ORGANIZATION] Net Ops | [ORGANIZATION] Wireless Security Policy |
| AC-19 | Mobile Device Access Control | NA | Web app; mobile device management is outside system boundary | [ORGANIZATION] MDM | Tailoring Rationale in SSP |
| AC-20 | Use of External Systems | I | External access permitted via HTTPS; users subject to AUP; terms presented at login | System Owner / ISSO | Terms of Use; AUP |
| AC-21 | Information Sharing | I | No automated external data sharing; exports controlled by Facilitator/Admin roles; subject to data handling policy | System Owner / ISSO | Export Function Controls; Data Handling Policy |
| AC-22 | Publicly Accessible Content | NA | System requires authentication for all content; no public-facing user content | N/A | Tailoring Rationale in SSP |
| AC-25 | Reference Monitor | I | Centralized auth + authz middleware on all protected routes; server-side enforcement; tamper-resistant | Dev Team | API Middleware Architecture |

---

## Awareness and Training (AT)

| Control ID | Control Name | Status | Implementation Description | Responsible Party | Evidence Location |
|---|---|---|---|---|---|
| AT-1 | Policy and Procedures | I | Security awareness policy maintained by [ORGANIZATION]; reviewed annually | [ORGANIZATION] Security Training | [ORGANIZATION] Security Training Policy |
| AT-2 | Literacy Training and Awareness | I | Annual security awareness training required for all users; completion tracked in LMS | [ORGANIZATION] Training Program | LMS Training Records |
| AT-2(2) | Insider Threat Awareness | I | Insider threat content included in annual security awareness training | [ORGANIZATION] Training Program | Training Curriculum |
| AT-3 | Role-Based Training | I | Admins and Facilitators complete role-based security training covering privileged access, secure config, IR | [ORGANIZATION] Training / System Owner | Role-Based Training Records |
| AT-4 | Training Records | I | Training completion records maintained in LMS for minimum 3 years | [ORGANIZATION] HR / Training | LMS Records |

---

## Audit and Accountability (AU)

| Control ID | Control Name | Status | Implementation Description | Responsible Party | Evidence Location |
|---|---|---|---|---|---|
| AU-1 | Policy and Procedures | I | Audit and accountability policy documented; reviewed annually | ISSO / System Owner | [ORGANIZATION] Security Policy; SSP |
| AU-2 | Event Logging | I | Logs: auth events (success/fail), account management, authz failures, admin actions, session events, errors, config changes | Dev Team / System | Audit Event Types List; Application Logging Code |
| AU-3 | Content of Audit Records | I | Each record: timestamp (UTC ms), event type, outcome, user ID, username, source IP, target resource, details | Dev Team / System | Audit Log Schema; Sample Audit Records |
| AU-4 | Audit Log Storage Capacity | I | PostgreSQL with disk monitoring; 80% threshold alerts; quarterly capacity review; archive procedure for 90+ day records | Sys Admin / DBA | Database Monitoring Config; Archive SOP |
| AU-5 | Response to Logging Failures | I | Audit write failure triggers alert; fallback to file logging; critical ops flagged for manual review if logging unavailable | System / Sys Admin | Failover Logging Config; Alert Config |
| AU-6 | Audit Review, Analysis, Reporting | I | Weekly ISSO audit review; automated alerts for anomalous patterns; monthly summary reports to management | ISSO / Sys Admin | Audit Review SOP; Alert Config; Monthly Report Template |
| AU-7 | Audit Reduction and Report Generation | I | Admin UI provides search/filter by date, user, event type, IP; export capability for external analysis | System / ISSO | Admin Audit Interface; Export Functionality |
| AU-8 | Time Stamps | I | All records use UTC timestamps with millisecond precision; NTP synchronization to authoritative time source | System (Automated) | NTP Configuration; Timestamp Format Documentation |
| AU-9 | Protection of Audit Information | PI | Audit records are application-managed and security events are logged; operators should forward logs to append-only external storage or SIEM for tamper resistance | Dev Team / DBA | Audit Table Schema; Logging Configuration; SIEM Plan |
| AU-9(4) | Access by Subset of Privileged Users | I | Audit access restricted to ISSO, designated reviewers, DBA; app Admin role view-only via UI | ISSO / DBA | Access Control List; DB Role Definitions |
| AU-10 | Non-Repudiation | I | Validated JWT identity immutably recorded in audit log; users cannot deny logged actions | System (Automated) | JWT Validation Logic; Audit Log Immutability |
| AU-11 | Audit Record Retention | I | 1 year online; 3 years total (2 years archived); per [ORGANIZATION] records management policy | Sys Admin / DBA | Retention Schedule; Archive SOP |
| AU-12 | Audit Record Generation | I | All components generate records for events in AU-2; implemented in Express middleware; applied to all routes | Dev Team / System | Audit Middleware Implementation |
| AU-12(1) | System-Wide Correlated Audit Trail | I | UTC timestamps on all components enable cross-component event correlation | System | Timestamp Configuration; Log Aggregation |
| AU-14 | Session Audit | I | Exercise session events linked to session ID and user identity; complete session reconstruction possible | System (Automated) | Session Audit Schema; Exercise Event Logging |

---

## Assessment, Authorization, and Monitoring (CA)

| Control ID | Control Name | Status | Implementation Description | Responsible Party | Evidence Location |
|---|---|---|---|---|---|
| CA-1 | Policy and Procedures | I | CA policy documented in [ORGANIZATION] security policy and authorization package | ISSO / [ORGANIZATION] Security | [ORGANIZATION] Security Policy; ATO Package |
| CA-2 | Control Assessments | I | Annual independent security assessments per SAP-CTT-001; findings in SAR-CTT-001; tracked in POA&M | ISSO / Third-Party Assessor | SAP; SAR; POA&M |
| CA-2(1) | Independent Assessors | I | Annual assessments by independent assessor with no system development/operations involvement; credentials required | ISSO / [THIRD-PARTY ASSESSOR] | Assessor Credentials; Assessment Contract |
| CA-3 | Information Exchange | I | System interconnections documented in SSP Section 3; ISAs in place for all external connections | System Owner / ISSO | SSP Section 3; ISA Documents |
| CA-5 | Plan of Action and Milestones | I | POA&M-CTT-001 maintained; reviewed and updated monthly; tracks all weaknesses and remediation | ISSO / System Owner | POA&M-CTT-001 |
| CA-6 | Authorization | I | ATO from [AUTHORIZING OFFICIAL]; reviewed annually and upon significant changes | Authorizing Official | ATO Letter; Authorization Package |
| CA-7 | Continuous Monitoring | I | Monthly vuln scans, weekly audit log review, quarterly access reviews, monthly security metrics reporting | ISSO / Sys Admin | Continuous Monitoring Plan; Monitoring Reports |
| CA-7(1) | Independent Assessment | I | Rotating subset of controls assessed independently on continuous basis | ISSO / Third-Party | Continuous Monitoring Assessment Records |
| CA-8 | Penetration Testing | PI | Initial pentest planned pre-ATO; annual pentest per policy; scope in SAP | ISSO / [PENTEST FIRM] | POA&M POAM-002; SAP Section 5 |
| CA-9 | Internal System Connections | I | Internal Docker connections documented; all within internal network; not externally accessible; reviewed annually | Sys Admin / Dev Team | Network Diagram; Docker Network Config |

---

## Configuration Management (CM)

| Control ID | Control Name | Status | Implementation Description | Responsible Party | Evidence Location |
|---|---|---|---|---|---|
| CM-1 | Policy and Procedures | I | CM policy documented in CMP-CTT-001; reviewed annually | System Owner / ISSO | CMP-CTT-001 |
| CM-2 | Baseline Configuration | I | Baselines documented for Docker images (pinned tags), Nginx, Node.js, PostgreSQL, Redis; stored in version control | Sys Admin / Dev Team | CMP-CTT-001; Docker Compose File; Git Repository |
| CM-2(2) | Automation Support | PI | Docker Compose baselines are version controlled and CI validates compose configuration/builds; operators should pin image digests and verify signatures for higher-assurance deployments | Dev Team / Operator | CI/CD Pipeline; Compose Files; Operator Deployment Policy |
| CM-3 | Configuration Change Control | I | Change request → security impact analysis → CAB review → non-prod test → prod deployment → verification; emergency process documented | Sys Admin / Dev Team | CMP-CTT-001; Change Control SOP; CAB Charter |
| CM-4 | Impact Analyses | I | Security impact analysis required for all configuration changes; ISSO reviews security-relevant changes | ISSO / Dev Team | Change Request Form; Impact Analysis Template |
| CM-5 | Access Restrictions for Change | I | Write access to production config restricted to designated Sys Admins; devs have no direct production access | Sys Admin / Dev Team | RBAC for Infrastructure; Change Control SOP |
| CM-6 | Configuration Settings | I | Security-relevant settings documented and enforced: TLS 1.2+, cipher suites, HSTS, CSP, bcrypt factor 12, TOTP MFA for privileged roles, lockout after 5 failed attempts | Sys Admin / Dev Team | CMP-CTT-001; Application Security Config |
| CM-7 | Least Functionality | I | Unnecessary services/ports/protocols disabled; Docker exposes only required ports; Nginx blocks non-app endpoints | Sys Admin / Dev Team | Nginx Config; Docker Port Mapping; Service Inventory |
| CM-7(1) | Periodic Review | I | Quarterly configuration review for unnecessary functions; documented findings and tracking | Sys Admin / ISSO | Quarterly Review Records |
| CM-8 | System Component Inventory | I | Software inventory: Docker images, npm packages (package-lock.json); updated each deployment; reviewed monthly for vulns | Sys Admin | Software Inventory; npm Dependency List |
| CM-9 | Configuration Management Plan | I | CMP-CTT-001 documents CM policy, baselines, change control, software inventory, configuration monitoring | System Owner / ISSO | CMP-CTT-001 |
| CM-10 | Software Usage Restrictions | I | All software is [ORGANIZATION]-owned, approved open-source, or licensed; license compliance reviewed annually | System Owner / Legal | Software License Inventory; Legal Review Records |
| CM-11 | User-Installed Software | I | Containerized deployment prevents user software installation; only authorized admins modify container images | Sys Admin / Dev Team | Container Architecture Documentation |
| CM-14 | Signed Components | PI | npm package integrity via package-lock.json; Docker image digest verification; code signing for releases planned | Dev Team | package-lock.json; Image Verification Scripts; POA&M |

---

## Contingency Planning (CP)

| Control ID | Control Name | Status | Implementation Description | Responsible Party | Evidence Location |
|---|---|---|---|---|---|
| CP-1 | Policy and Procedures | I | CP policy documented in CP-CTT-001; reviewed annually | System Owner / ISSO | CP-CTT-001 |
| CP-2 | Contingency Plan | I | CP-CTT-001 documents: RTO 4 hours, RPO 24 hours, roles, activation criteria, backup/recovery procedures, test schedule | System Owner / Sys Admin | CP-CTT-001 |
| CP-3 | Contingency Training | I | Annual training for personnel with contingency roles; training records maintained | System Owner / Sys Admin | Training Records |
| CP-4 | Contingency Plan Testing | I | Annual tabletop exercise + backup restoration validation; test results documented and used to update plan | System Owner / Sys Admin | Test Records; Updated CP |
| CP-6 | Alternate Storage Site | I | Encrypted backups at alternate location (separate DC or cross-region cloud); restoration capability verified quarterly | Sys Admin / DBA | Backup Location Configuration; Restoration Test Records |
| CP-7 | Alternate Processing Site | P | Alternate processing capability planning in progress; containerized architecture supports rapid redeployment | System Owner / Sys Admin | POA&M POAM-007; CP-CTT-001 Alternate Site Section |
| CP-9 | System Backup | PI | Backup and restore scripts are provided for PostgreSQL (`scripts/backup.*`, `scripts/restore.*`); operators must schedule backups, protect backup files, and document retention/encryption | Sys Admin / DBA | Backup Scripts; Backup SOP; Operator Configuration |
| CP-10 | System Recovery | PI | Recovery procedures documented in CP-CTT-001 and restore scripts provided; restore testing must be completed in the operator environment before production reliance | Sys Admin / DBA | CP-CTT-001 Recovery Procedures; Restore Test Records |
| CP-13 | Alternative Security Mechanisms | PI | Containerized architecture enables alternative deployment to alternate cloud region; full alternate site in planning | System Owner | POA&M POAM-007 |

---

## Identification and Authentication (IA)

| Control ID | Control Name | Status | Implementation Description | Responsible Party | Evidence Location |
|---|---|---|---|---|---|
| IA-1 | Policy and Procedures | I | I&A policy documented in [ORGANIZATION] security policy and this SSP | ISSO / System Owner | [ORGANIZATION] Security Policy; SSP |
| IA-2 | Identification and Authentication | I | Unique user ID (email); local auth via bcrypt (factor 12) + JWT (httpOnly cookies); OIDC SSO supported; TOTP MFA enforced for privileged roles and optional for players | System / Dev Team | Authentication Code; bcrypt Configuration; OIDC Integration; MFA E2E Test |
| IA-2(1) | MFA to Privileged Accounts | I | TOTP MFA required for SUPER_ADMIN, ORG_ADMIN, and FACILITATOR accounts; users without MFA are forced into setup before protected access; MFA-enabled users must complete a TOTP or recovery-code challenge before login tokens are issued | System / Dev Team | MFA Enforcement Code; E2E MFA Enrollment Test; Security Dashboard Privileged MFA Metric |
| IA-2(2) | MFA to Non-Privileged Accounts | PI | TOTP MFA is available for player accounts from Profile, but not mandated by the application; organizations requiring MFA for all accounts should enforce it through OIDC/SSO or operating policy | Sys Admin / ISSO | MFA Configuration; Operator Policy |
| IA-2(6) | Access — Separate Device | I | TOTP uses separate authenticator app device for MFA-enabled accounts | System (Automated) | TOTP Implementation |
| IA-3 | Device I&A | NA | No device-to-device communication requiring device authentication in scope | N/A | Tailoring Rationale |
| IA-4 | Identifier Management | I | Unique email-based identifiers; no reuse (disabled accounts retain ID); OIDC subject identifiers mapped to internal accounts | Sys Admin | Account Provisioning SOP; User ID Schema |
| IA-5 | Authenticator Management | I | Passwords: min 12 chars with uppercase/lowercase/number/symbol and bcrypt factor 12; TOTP secrets encrypted with MFA_ENCRYPTION_KEY; recovery codes stored as bcrypt hashes; JWT secrets externalized; key rotation documented | System / Sys Admin | Password Policy Config; bcrypt Config; MFA Service; Secrets Management SOP |
| IA-5(1) | Password-Based Authentication | I | Minimum length and complexity enforced; bcrypt hashing; lockout after 5 failures; passwords are never stored in plaintext or sent in URLs | System (Automated) | Password Policy; Hashing Code; Validation Code |
| IA-6 | Authentication Feedback | I | Generic error "Invalid credentials" on login failure; no username/password distinguishing; TOTP failures are generic | Dev Team | Login Error Messages; Code Review |
| IA-7 | Cryptographic Module Authentication | I | Node.js crypto module + bcrypt; FIPS 140-2 compliant when using appropriate build; TLS via Nginx with approved ciphers | Dev Team | Crypto Library Versions; TLS Configuration |
| IA-8 | Non-Organizational User I&A | I | External users authenticate through local accounts or federated OIDC and typically receive PLAYER access; time-limited access should be managed through OIDC/SSO or operator review | Sys Admin / System Owner | Guest Account SOP; OIDC Federation Config |
| IA-11 | Re-Authentication | I | Short-lived access tokens, refresh-token rotation, and MFA challenge for MFA-enabled logins; password changes and MFA changes require authenticated sessions and current password or current MFA code as applicable | System (Automated) | Token Config; MFA Routes; Sensitive Op Re-Auth Code |
| IA-12 | Identity Proofing | I | Identity proofing via HR onboarding before account provisioning; OIDC users proofed by their organization's IdP | Sys Admin / HR | Account Provisioning SOP; HR Onboarding Records |

---

## Incident Response (IR)

| Control ID | Control Name | Status | Implementation Description | Responsible Party | Evidence Location |
|---|---|---|---|---|---|
| IR-1 | Policy and Procedures | I | IR policy documented in IRP-CTT-001; reviewed annually | ISSO / System Owner | IRP-CTT-001 |
| IR-2 | Incident Response Training | I | Annual IR training for personnel with IR roles; CTT exercises incorporated in training | [ORGANIZATION] Security | Training Records |
| IR-3 | Incident Response Testing | I | Annual IR plan tabletop; results documented; improvements incorporated | ISSO / System Owner | Test Records; Updated IRP |
| IR-4 | Incident Handling | I | IRP-CTT-001 documents: detection/analysis, containment, eradication, recovery, post-incident review procedures | ISSO / IR Team | IRP-CTT-001 |
| IR-5 | Incident Monitoring | I | Incidents tracked from detection to closure; records include: detection time, classification, response, resolution, lessons learned | ISSO | Incident Log; Incident Report Template |
| IR-6 | Incident Reporting | I | SOC notification within 1 hour; US-CERT within 1 hour for major incidents; reporting thresholds and contacts in IRP | ISSO / System Owner | IRP-CTT-001; Reporting Thresholds; Contact List |
| IR-7 | Incident Response Assistance | I | ISSO primary contact; [ORGANIZATION] SOC tier-2; IR retainer available | ISSO / [ORGANIZATION] SOC | IRP Contact List; IR Retainer Contract |
| IR-8 | Incident Response Plan | I | IRP-CTT-001 maintained; reviewed annually; updated following incidents | ISSO / System Owner | IRP-CTT-001 |
| IR-10 | Integrated IR Simulation | I | CyberTabletop platform itself used for IR simulation training; periodic exercises validate incident response procedures | System Owner / ISSO | Exercise Records; IRP-CTT-001 |

---

## Maintenance (MA)

| Control ID | Control Name | Status | Implementation Description | Responsible Party | Evidence Location |
|---|---|---|---|---|---|
| MA-1 | Policy and Procedures | I | Maintenance policy in [ORGANIZATION] policy and SSP | System Owner / ISSO | [ORGANIZATION] Maintenance Policy; SSP |
| MA-2 | Controlled Maintenance | I | Maintenance scheduled, documented, with advance user notification; post-maintenance testing required | Sys Admin | Maintenance Log; Change Control Records |
| MA-3 | Maintenance Tools | I | Approved tools list maintained; remote tools require VPN + MFA | Sys Admin | Approved Tools List |
| MA-4 | Nonlocal Maintenance | I | Remote maintenance via SSH with key auth + MFA required; VPN required; sessions logged | Sys Admin | Remote Access Policy; SSH Config; VPN Config |
| MA-5 | Maintenance Personnel | I | Background checks per [ORGANIZATION] HR; third-party under supervision | System Owner / HR | HR Records; Third-Party Vendor Agreements |
| MA-6 | Timely Maintenance | I | Critical patches: 30 days; High: 60 days; Medium: 90 days; Low: 180 days | Sys Admin / Dev Team | CMP-CTT-001; Patch Management SOP |

---

## Media Protection (MP)

| Control ID | Control Name | Status | Implementation Description | Responsible Party | Evidence Location |
|---|---|---|---|---|---|
| MP-1 | Policy and Procedures | I | Media protection in [ORGANIZATION] data classification and media handling policy | System Owner / ISSO | [ORGANIZATION] Media Policy |
| MP-2 | Media Access | I | Access to media with system data restricted to authorized personnel; backup media access controlled | Sys Admin / DBA | Access Control List; Backup Storage Access Policy |
| MP-3 | Media Marking | NA | No removable physical media in normal operations; backup media labeled per [ORGANIZATION] policy when used | N/A | Tailoring Rationale |
| MP-4 | Media Storage | I | Encrypted backup storage in physically secured location or encrypted cloud storage; access restricted | Sys Admin | Backup Storage Config; Physical Security Controls |
| MP-5 | Media Transport | NA | Physical media transport not part of normal operations; backups transmitted electronically over encrypted connections | N/A | Tailoring Rationale |
| MP-6 | Media Sanitization | I | Storage media sanitized per NIST SP 800-88 on decommission; certificates retained | Sys Admin | Sanitization SOP; Sanitization Certificates |
| MP-7 | Media Use | NA | Removable media not used in system operations; containerized deployment does not require physical media | N/A | Tailoring Rationale |

---

## Personnel Security (PS)

| Control ID | Control Name | Status | Implementation Description | Responsible Party | Evidence Location |
|---|---|---|---|---|---|
| PS-1 | Policy and Procedures | INH | Personnel security policy maintained by [ORGANIZATION] HR | [ORGANIZATION] HR | [ORGANIZATION] HR Policy |
| PS-2 | Position Risk Designation | INH | Position risk designations maintained by [ORGANIZATION] HR | [ORGANIZATION] HR | Position Risk Designations |
| PS-3 | Personnel Screening | INH | Background investigations per position risk designation before access granted | [ORGANIZATION] HR | Background Investigation Records |
| PS-4 | Personnel Termination | I | Access revoked within 1 business day of HR notification; sessions terminated; exit procedures documented | Sys Admin / HR | Termination SOP; Audit Logs |
| PS-5 | Personnel Transfer | I | Access reviewed and adjusted within 1 business day of transfer/role change; excess access revoked | Sys Admin / HR | Transfer/Reassignment SOP |
| PS-6 | Access Agreements | I | AUP and rules of behavior signed before access granted; reviewed annually | [ORGANIZATION] HR / Legal | Signed Access Agreements |
| PS-7 | External Personnel Security | I | Third-party personnel: same screening, agreements, and termination procedures as employees; access time-limited | System Owner / Contracting | Vendor Contracts; Third-Party Access Records |
| PS-8 | Personnel Sanctions | INH | Formal sanctions process maintained by [ORGANIZATION] HR/Legal | [ORGANIZATION] HR | [ORGANIZATION] Sanctions Policy |
| PS-9 | Position Descriptions | INH | Security responsibilities in position descriptions for significant-access roles | [ORGANIZATION] HR | Position Descriptions |

---

## Physical and Environmental Protection (PE)

| Control ID | Control Name | Status | Implementation Description | Responsible Party | Evidence Location |
|---|---|---|---|---|---|
| PE-1 | Policy and Procedures | INH | Physical security policy maintained by [ORGANIZATION] facilities | [ORGANIZATION] Facilities | [ORGANIZATION] Physical Security Policy |
| PE-2 | Physical Access Authorizations | INH | Physical access to data center controlled per [ORGANIZATION] facilities program | [ORGANIZATION] Facilities | Physical Access Control List |
| PE-3 | Physical Access Control | INH | Data center physical access controls: badge readers, security cameras, visitor log | [ORGANIZATION] Facilities / Cloud Provider | Physical Security Assessment |
| PE-6 | Monitoring Physical Access | INH | Physical access monitoring via CCTV and access logs | [ORGANIZATION] Facilities / Cloud Provider | Physical Monitoring Records |
| PE-8 | Visitor Access Records | INH | Visitor logs maintained at data center | [ORGANIZATION] Facilities | Visitor Log |
| PE-12 | Emergency Lighting | INH | Emergency lighting in data center per building codes | [ORGANIZATION] Facilities / Cloud Provider | Facilities Assessment |
| PE-13 | Fire Protection | INH | Fire suppression systems in data center | [ORGANIZATION] Facilities / Cloud Provider | Fire Safety Certification |
| PE-14 | Environmental Controls | INH | Temperature/humidity controls in data center | [ORGANIZATION] Facilities / Cloud Provider | Environmental Monitoring Records |
| PE-15 | Water Damage Protection | INH | Water detection and protection in data center | [ORGANIZATION] Facilities / Cloud Provider | Facilities Assessment |
| PE-16 | Delivery and Removal | INH | Controlled delivery/removal at data center | [ORGANIZATION] Facilities | Delivery/Removal Log |

---

## Planning (PL)

| Control ID | Control Name | Status | Implementation Description | Responsible Party | Evidence Location |
|---|---|---|---|---|---|
| PL-1 | Policy and Procedures | I | Security planning policy documented and maintained | ISSO / System Owner | [ORGANIZATION] Security Policy |
| PL-2 | System Security Plan | I | This SSP (SSP-CTT-001); reviewed annually; updated upon significant changes | ISSO / System Owner | SSP-CTT-001 |
| PL-4 | Rules of Behavior | I | Rules of behavior presented during onboarding; signed before access; reviewed annually | System Owner / ISSO | Signed Rules of Behavior; AUP |
| PL-7 | Concept of Operations | I | CONOPS document maintained describing purpose, user roles, operational procedures | System Owner | CONOPS-CTT-001 |
| PL-8 | Security and Privacy Architectures | I | Architecture documented in BD-CTT-001 (Boundary Diagram) and DFD-CTT-001 (Data Flow Diagram) | Dev Team / ISSO | BD-CTT-001; DFD-CTT-001 |
| PL-10 | Baseline Selection | I | MODERATE baseline selected per FIPS199-CTT-001 categorization | ISSO | FIPS199-CTT-001; SSP |
| PL-11 | Baseline Tailoring | I | Tailoring decisions documented in SSP; NA controls justified and approved by AO | ISSO / AO | SSP Tailoring Decisions; AO Approval |

---

## Risk Assessment (RA)

| Control ID | Control Name | Status | Implementation Description | Responsible Party | Evidence Location |
|---|---|---|---|---|---|
| RA-1 | Policy and Procedures | I | Risk assessment policy documented | ISSO / System Owner | [ORGANIZATION] Security Policy; SSP |
| RA-2 | Security Categorization | I | FIPS 199 categorization: MODERATE; documented in FIPS199-CTT-001; AO approved | ISSO / System Owner | FIPS199-CTT-001 |
| RA-3 | Risk Assessment | I | Risk assessment RA-CTT-001 documents threats, vulnerabilities, likelihood, impact, risk levels; reviewed quarterly | ISSO | RA-CTT-001 |
| RA-3(1) | Supply Chain Risk Assessment | PI | npm audit + Dependabot for dependency scanning; formal SCRM documentation in development | Dev Team / ISSO | npm audit Reports; Dependabot Alerts; POA&M POAM-008 |
| RA-5 | Vulnerability Monitoring and Scanning | PI | npm audit and CodeQL are configured in GitHub workflows; operators should add container image scanning and recurring production vulnerability scans | ISSO / Sys Admin | CI/CD Config; Scan Reports; Remediation Tracking |
| RA-5(2) | Update Vulnerabilities to Be Scanned | I | Scan signatures updated before each scan; CISA KEV catalog reviewed weekly | Sys Admin | Scan Configuration; KEV Review Records |
| RA-7 | Risk Response | I | Risk response decisions documented; options (accept/mitigate/transfer/avoid) documented per risk | ISSO / System Owner | Risk Register; Risk Response Decisions |
| RA-9 | Criticality Analysis | I | Critical functions, data, and components identified; informs control prioritization and recovery planning | System Owner / ISSO | Criticality Analysis Document |
| RA-10 | Threat Hunting | P | Periodic threat hunting being developed by [ORGANIZATION] SOC | [ORGANIZATION] SOC | POA&M POAM-009 |

---

## System and Services Acquisition (SA)

| Control ID | Control Name | Status | Implementation Description | Responsible Party | Evidence Location |
|---|---|---|---|---|---|
| SA-1 | Policy and Procedures | I | SA policy in [ORGANIZATION] procurement and IT governance policies | System Owner / Contracting | [ORGANIZATION] Procurement Policy |
| SA-2 | Allocation of Resources | I | Security resources allocated in system budget: staffing, assessments, scanning tools, training | System Owner / Management | Budget Records |
| SA-3 | System Development Life Cycle | I | SSDLC with security at each phase: requirements, design (threat modeling), implementation, testing, deployment, operations | Dev Team / ISSO | SSDLC Documentation; Development Standards |
| SA-4 | Acquisition Process | I | Security requirements in acquisition documents; third-party components reviewed before adoption | System Owner / Contracting | Procurement Requirements; Component Review Records |
| SA-5 | System Documentation | I | Architecture, data flow, API, configuration, and operational documentation maintained in version control | Dev Team / System Owner | Documentation Repository |
| SA-8 | Security Engineering Principles | I | Applied: defense in depth, least privilege, fail secure, economy of mechanism, complete mediation, open design | Dev Team | Design Documentation; Code Review Standards |
| SA-9 | External System Services | I | External services evaluated pre-use; ISAs in place; providers must maintain commensurate controls | System Owner / Contracting | ISA Documents; Vendor Security Assessments |
| SA-10 | Developer Configuration Management | I | Source code in Git; all changes require code review before merge; Docker builds automated; dependencies pinned | Dev Team | Git Repository; Code Review Records; CI/CD Config |
| SA-11 | Developer Testing and Evaluation | PI | TypeScript build, automated tests, npm audit, CodeQL, and manual pre-release review are used; dedicated SAST/DAST and formal developer security training are operator/project governance activities | Dev Team | CI Results; Audit Reports; Security Review Records |
| SA-15 | Development Process, Standards, Tools | I | Documented coding standards (OWASP Top 10 mitigations); security user stories; security test cases | Dev Team | Coding Standards; Security Test Cases |
| SA-17 | Developer Security Architecture | I | Security architecture (BD, DFD, threat model) reviewed with significant design changes | Dev Team / ISSO | Architecture Documents; Threat Model |

---

## System and Communications Protection (SC)

| Control ID | Control Name | Status | Implementation Description | Responsible Party | Evidence Location |
|---|---|---|---|---|---|
| SC-1 | Policy and Procedures | I | SC policy in [ORGANIZATION] network security policy and SSP | ISSO / Net Admin | [ORGANIZATION] Network Security Policy; SSP |
| SC-2 | Separation of System and User Functionality | I | Administrative functions separated; admin endpoints restricted to ORG_ADMIN/SUPER_ADMIN as appropriate; admin UI requires authenticated admin session | Dev Team | Role-Permission Matrix; API Routing |
| SC-3 | Security Function Isolation | I | Security functions (auth, authz, audit, session mgmt) implemented as isolated middleware modules | Dev Team | Middleware Architecture; Code Structure |
| SC-4 | Information in Shared Resources | I | Sensitive data cleared from shared resources on session termination; cache-control headers; Redis namespaces isolated per session | Dev Team | Session Cleanup Code; HTTP Response Headers |
| SC-5 | DoS Protection | I | Rate limiting: auth endpoint 5/min/IP, API 100/min/user, registration 3/hr/IP; Nginx connection limits; alerts | Dev Team / Sys Admin | Rate Limit Configuration; Nginx Config; Alert Config |
| SC-7 | Boundary Protection | I | Nginx reverse proxy accepts HTTPS 443 only; Docker network prevents external DB/cache access; firewall rules: 80/443 only | Sys Admin / Net Admin | Nginx Config; Docker Network Config; Firewall Rules |
| SC-8 | Transmission C&I | I | TLS 1.2+ enforced at Nginx; HSTS with long max-age; HTTP → HTTPS redirect; internal Docker TLS where applicable | Sys Admin / Dev Team | Nginx TLS Config; HSTS Config |
| SC-8(1) | Cryptographic Protection | I | Approved cipher suites: TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256 (TLS 1.3); weak ciphers disabled | Sys Admin | Nginx SSL Configuration; SSL Labs Report |
| SC-10 | Network Disconnect | I | Short-lived access tokens and WebSocket keepalive/timeout mechanisms limit stale connections; logout clears browser cookies and revokes refresh token when present | System (Automated) | Token Config; Socket.io Config |
| SC-12 | Cryptographic Key Management | I | TLS keys in restricted Nginx location; JWT secrets externalized to env vars/secrets manager; key rotation documented | Sys Admin / Dev Team | Key Management SOP; Secrets Configuration |
| SC-13 | Cryptographic Protection | I | bcrypt (passwords and recovery-code hashes), HMAC-SHA256 JWT signing, AES-256-GCM for TOTP secret encryption, TLS 1.2+ transport, and operator-managed backup encryption | Dev Team / Sys Admin | Crypto Library Config; TLS Configuration; MFA Service |
| SC-17 | PKI Certificates | I | TLS certs from approved CA; expiration monitored; renewal initiated 30+ days before expiration | Sys Admin | Certificate Inventory; Renewal Alerts |
| SC-18 | Mobile Code | I | CSP via Helmet.js restricts JS to approved sources; inline scripts restricted; third-party library SRI hashes | Dev Team | Helmet.js Configuration; CSP Policy |
| SC-20 | Secure Name/Address Resolution | I | DNS via [ORGANIZATION] authoritative DNS; DNSSEC implemented where supported | Sys Admin / Net Admin | DNS Configuration; DNSSEC Records |
| SC-23 | Session Authenticity | I | Cryptographically random JWT tokens; httpOnly cookies; SameSite attribute; CSRF token validation | Dev Team | Session Config; Cookie Configuration; CSRF Implementation |
| SC-28 | Protection at Rest | PI | TOTP secrets encrypted by the application; database, volume, Redis persistence, and backup encryption are deployment responsibilities documented for operators | Sys Admin / DBA | MFA Service; Encryption Configuration; Backup Configuration |
| SC-39 | Process Isolation | I | Docker container isolation between all components; AppArmor/seccomp profiles; non-root users in containers | Dev Team / Sys Admin | Docker Security Config; Container Security Profile |

---

## System and Information Integrity (SI)

| Control ID | Control Name | Status | Implementation Description | Responsible Party | Evidence Location |
|---|---|---|---|---|---|
| SI-1 | Policy and Procedures | I | SI policy in [ORGANIZATION] security policy and SSP | ISSO / System Owner | [ORGANIZATION] Security Policy; SSP |
| SI-2 | Flaw Remediation | I | npm audit + vuln scanning identify flaws; patch timelines: critical 30d, high 60d, medium 90d, low 180d; non-prod testing before production | Dev Team / Sys Admin | CMP-CTT-001 Patch Section; Remediation Tracking |
| SI-3 | Malicious Code Protection | I | Docker image scanning; npm lockfile integrity; CI/CD security scanning; host-based security tools; images from approved registries | Dev Team / Sys Admin | Image Scan Reports; CI/CD Security Config; Registry Policy |
| SI-4 | System Monitoring | I | Nginx log analysis; application error monitoring via Winston; failed auth alerts (5 attempts); rate limit alerts; resource monitoring | Sys Admin / ISSO | Monitoring Config; Alert Thresholds; Monitoring Dashboards |
| SI-5 | Security Alerts, Advisories | I | ISSO subscribes to Node.js, PostgreSQL, Redis, Nginx, npm advisories; US-CERT; NVD; CISA KEV; action per remediation timelines | ISSO / Sys Admin | Advisory Subscription List; Advisory Review Records |
| SI-6 | Security Function Verification | I | Verification at startup (config validation), post-deployment (security checklist), post-patch (regression testing); failures halt deployment | Dev Team / Sys Admin | Deployment Checklist; Security Test Suite |
| SI-7 | Software, Firmware, Information Integrity | I | Docker image SHA256 at deployment; npm lockfile integrity; Git commit signing for releases; post-deployment file integrity | Dev Team / Sys Admin | Image Verification; npm Integrity; Git Signing Config |
| SI-10 | Information Input Validation | I | Zod validation on all API endpoints (type, format, length, business rules); Prisma ORM prevents SQLi; applied at framework layer | Dev Team | Zod Schema Definitions; Input Validation Middleware; Prisma Config |
| SI-12 | Information Management and Retention | I | Retention: audit logs 3 yrs, inactive accounts 1 yr post-disable, exercise data 3 yrs; disposal per [ORGANIZATION] policy | System Owner / ISSO | Retention Schedule; Data Disposal SOP |
| SI-15 | Information Output Filtering | I | API responses filtered to authorized data only; production error messages sanitized (no stack traces to users); server-side only logging | Dev Team | API Response Filtering Code; Error Handler Config |
| SI-16 | Memory Protection | I | Node.js ASLR; sensitive data not in swap; tokens/passwords cleared from memory after use | Dev Team / Sys Admin | Runtime Config; Memory Handling Standards |
| SI-18 | Sensitive Information Processing | I | PII minimized in logs (passwords never logged, tokens truncated); data retention limited; email used only for auth/notifications | Dev Team / ISSO | Logging Standards; Data Minimization Policy |

---

## Summary Statistics

| Status | Count | Percentage |
|---|---|---|
| Implemented (I) | 112 | 74% |
| Partially Implemented (PI) | 8 | 5% |
| Planned (P) | 6 | 4% |
| Not Applicable (NA) | 14 | 9% |
| Inherited (INH) | 12 | 8% |
| **Total** | **152** | **100%** |

**Controls with open POA&M items:** 9 (see POA&M-CTT-001 for details)

---

*Document Version: 1.0 | Classification: UNCLASSIFIED // For Official Use Only*
*CyberTabletop ATO Package — [ORGANIZATION]*
*Next Review Due: March 2027*
