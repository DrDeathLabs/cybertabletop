# System Security Plan (SSP)
## CyberTabletop — Gamified Cybersecurity Incident Response Tabletop Exercise Platform

---

| Field | Value |
|---|---|
| **Document Title** | System Security Plan |
| **System Name** | CyberTabletop |
| **System Abbreviation** | CTT |
| **Version** | 1.0 |
| **Date** | March 15, 2026 |
| **Classification** | Unclassified // For Official Use Only |
| **FIPS 199 Categorization** | MODERATE |
| **Status** | Initial Authorization |

---

## Table of Contents

1. System Identification
2. System Owner and Points of Contact
3. System Description and Purpose
4. System Categorization (FIPS 199)
5. System Environment and Architecture
6. System Boundary and Interconnections
7. Information Types
8. Applicable Laws, Regulations, and Standards
9. Security Control Implementation
   - 9.1 Access Control (AC)
   - 9.2 Awareness and Training (AT)
   - 9.3 Audit and Accountability (AU)
   - 9.4 Assessment, Authorization, and Monitoring (CA)
   - 9.5 Configuration Management (CM)
   - 9.6 Contingency Planning (CP)
   - 9.7 Identification and Authentication (IA)
   - 9.8 Incident Response (IR)
   - 9.9 Maintenance (MA)
   - 9.10 Media Protection (MP)
   - 9.11 Physical and Environmental Protection (PE)
   - 9.12 Planning (PL)
   - 9.13 Program Management (PM)
   - 9.14 Personnel Security (PS)
   - 9.15 Risk Assessment (RA)
   - 9.16 System and Services Acquisition (SA)
   - 9.17 System and Communications Protection (SC)
   - 9.18 System and Information Integrity (SI)
   - 9.19 Supply Chain Risk Management (SR)
10. Signature Page

---

## 1. System Identification

| Attribute | Value |
|---|---|
| **System Name** | CyberTabletop |
| **System Acronym** | CTT |
| **System Unique Identifier** | CTT-2026-001 |
| **System Type** | Major Application |
| **Operational Status** | Operational |
| **System Function** | Gamified cybersecurity incident response tabletop exercise platform |
| **FIPS 199 Categorization** | MODERATE |
| **Authorization Boundary** | All CTT Docker containers, supporting infrastructure, and managed cloud resources |
| **Deployment Environment** | On-premises (Docker) and Cloud (AWS / Azure) |
| **Assessment Date** | March 15, 2026 |
| **ATO Expiration Date** | March 14, 2029 |

---

## 2. System Owner and Points of Contact

| Role | Name | Organization | Phone | Email |
|---|---|---|---|---|
| **System Owner (SO)** | [System Owner Name] | [Organization] | [Phone] | so@organization.gov |
| **Information System Security Officer (ISSO)** | [ISSO Name] | [Organization] | [Phone] | isso@organization.gov |
| **Information System Security Manager (ISSM)** | [ISSM Name] | [Organization] | [Phone] | issm@organization.gov |
| **Authorizing Official (AO)** | [AO Name] | [Organization] | [Phone] | ao@organization.gov |
| **System Administrator** | [SysAdmin Name] | [Organization] | [Phone] | sysadmin@organization.gov |
| **Application Developer/Maintainer** | [Dev Name] | [Organization] | [Phone] | dev@organization.gov |

---

## 3. System Description and Purpose

### 3.1 Purpose

CyberTabletop (CTT) is a web-based, gamified platform designed to facilitate cybersecurity incident response tabletop exercises for teams and organizations. The platform enables security practitioners, executives, and technical staff to participate in simulated incident response scenarios, make decisions under realistic conditions, receive immediate feedback on those decisions, and generate after-action reports for training and compliance purposes.

The primary mission of CyberTabletop is to improve organizational cybersecurity readiness by providing a repeatable, scalable, and engaging training environment that reduces the cost and complexity of traditional in-person tabletop exercises.

### 3.2 System Functionality

CyberTabletop provides the following core capabilities:

**Exercise Facilitation:** Facilitators can create, configure, and launch tabletop exercise sessions based on predefined or custom scenarios. Scenarios cover threat categories including ransomware, data breach, insider threat, supply chain compromise, and advanced persistent threat (APT) incidents.

**Participant Interface:** Participants join sessions via unique session codes or direct invitation links. Participants assume roles (e.g., CISO, IT Director, Legal Counsel, Communications Lead) and respond to scenario injects presented in real time.

**Real-Time Collaboration:** The platform uses WebSocket technology (Socket.io) to deliver scenario injects and decision prompts in real time, enabling synchronous multi-participant exercises regardless of geographic location.

**Scoring and Feedback:** Participant decisions are evaluated against a rubric embedded in each scenario. Immediate feedback is provided after each decision point, and cumulative scoring reflects the quality of the incident response throughout the exercise.

**Reporting and Analytics:** Upon exercise completion, the system generates after-action reports detailing participant decisions, scores, time-to-respond metrics, and areas for improvement. Reports can be exported in PDF format.

**Role-Based Access Control:** The system enforces distinct roles - `SUPER_ADMIN`, `ORG_ADMIN`, `FACILITATOR`, and `PLAYER` - with each role granted access only to the functions appropriate to its responsibilities.

**Single Sign-On Integration:** CTT supports both local authentication and OpenID Connect (OIDC)-based single sign-on for enterprise environments using identity providers such as Microsoft Entra ID (Azure AD), Okta, or similar OIDC-compliant identity providers.

**AI-Assisted Scenario Generation:** An optional integration with large language model (LLM) APIs (Anthropic Claude API for cloud deployments, Ollama for local deployments) enables facilitators to generate custom scenario content and tailored injects.

### 3.3 User Community

CyberTabletop serves the following user populations:

- **System Administrators:** Personnel responsible for deploying, configuring, and maintaining the CTT platform. `SUPER_ADMIN` and `ORG_ADMIN` roles provide application administration.
- **Facilitators:** Security training professionals, ISSOs, and managers who design and run tabletop exercises. Create and manage sessions and scenarios.
- **Players:** Exercise participants including IT staff, executives, legal, communications, and operations personnel. Access limited to active exercise sessions they join.

### 3.4 System Environment

CyberTabletop is containerized using Docker and can be deployed in the following configurations:

- **Local/On-Premises Deployment:** All components run as Docker containers orchestrated via Docker Compose on organization-managed infrastructure.
- **Cloud Deployment (AWS):** Components deployed as Docker containers on AWS EC2 instances or AWS ECS, with PostgreSQL hosted on AWS RDS, and static frontend assets optionally served via AWS CloudFront.
- **Cloud Deployment (Azure):** Components deployed on Azure Container Instances or Azure Kubernetes Service, with PostgreSQL on Azure Database for PostgreSQL.

---

## 4. System Categorization (FIPS 199)

Pursuant to Federal Information Processing Standard 199 (FIPS 199), *Standards for Security Categorization of Federal Information and Information Systems*, CyberTabletop is categorized as follows:

| Information Type | Confidentiality | Integrity | Availability |
|---|---|---|---|
| User Account Data | MODERATE | MODERATE | LOW |
| Exercise Session Data | LOW | MODERATE | LOW |
| Scenario Content | LOW | MODERATE | LOW |
| Audit and Log Data | MODERATE | HIGH | LOW |
| System Configuration Data | MODERATE | HIGH | LOW |

**Overall System Categorization: MODERATE**

`SC CyberTabletop = {(Confidentiality, MODERATE), (Integrity, MODERATE), (Availability, LOW)}`

The overall categorization is MODERATE because the highest applicable impact level across all information types and security objectives results in a MODERATE determination. Refer to the FIPS 199 Categorization document (fips199-categorization.md) for the complete categorization rationale.

---

## 5. System Environment and Architecture

### 5.1 Hardware and Infrastructure

**On-Premises Deployment:**
- Host server(s) running a supported Linux distribution (Ubuntu 22.04 LTS or RHEL 9) with Docker Engine and Docker Compose installed.
- Minimum specifications: 4 vCPU, 8 GB RAM, 100 GB SSD storage.

**Cloud Deployment (AWS):**
- EC2 instances (t3.medium or larger) or ECS Fargate tasks for container hosting.
- RDS PostgreSQL (db.t3.medium or larger) for database services.
- Application Load Balancer (ALB) for HTTPS termination and traffic distribution.
- AWS Certificate Manager for TLS certificates.
- AWS CloudWatch for logging and monitoring.

**Cloud Deployment (Azure):**
- Azure Container Instances or AKS node pools for container hosting.
- Azure Database for PostgreSQL (Flexible Server) for database services.
- Azure Application Gateway or Azure Front Door for HTTPS termination.
- Azure Monitor and Log Analytics for logging and monitoring.

### 5.2 Software Components

| Component | Technology | Version | Purpose |
|---|---|---|---|
| Frontend | React.js | 18.x | User interface |
| Backend API | Node.js / Express | 20.x LTS / 4.x | Application logic and API |
| Database | PostgreSQL | 16.x | Persistent data storage |
| Real-Time Engine | Socket.io | 4.x | WebSocket-based real-time communication |
| Reverse Proxy | Nginx | 1.24.x | TLS termination, load balancing, static file serving |
| Container Runtime | Docker Engine | 24.x | Container execution |
| Container Orchestration | Docker Compose / ECS / AKS | - | Multi-container management |
| Real-Time State Cache | Redis | 7.x | Socket.io/game-state support and cache data |
| Authentication Library | Passport.js | 0.6.x | Local and OIDC authentication |
| ORM | Prisma | 5.x | Database abstraction |
| LLM Integration (Cloud) | Anthropic Claude API | API v1 | AI-assisted scenario generation |
| LLM Integration (Local) | Ollama | 0.1.x | Local LLM for scenario generation |

### 5.3 Network Architecture

The system is designed with a layered network architecture. All external traffic enters through Nginx, which acts as the sole internet-facing component. Backend services and the database are not directly accessible from external networks.

```
Internet --> [Nginx Reverse Proxy / TLS Termination]
                 |
         [React Frontend (static)] <-- served by Nginx
                 |
         [Node.js / Express API Backend]
                 |                  |
     [PostgreSQL Database]   [Redis Real-Time State Cache]
```

### 5.4 Data at Rest

Persistent application data is stored in PostgreSQL. CyberTabletop encrypts TOTP MFA secrets at the application layer. Database, host-volume, Redis persistence, and backup encryption are deployment responsibilities and should be implemented using the operator's platform controls, such as host full-disk encryption, cloud-managed database encryption, encrypted Docker volumes, or encrypted backup storage.

### 5.5 Data in Transit

All data in transit is protected using TLS 1.2 or higher. Nginx is configured to reject TLS 1.0 and 1.1 connections. WebSocket (Socket.io) connections are established over WSS (WebSocket Secure), using the same TLS configuration as HTTPS. Internal container-to-container communication occurs on a private Docker network not accessible from outside the container network.

---

## 6. System Boundary and Interconnections

### 6.1 Authorization Boundary

The CyberTabletop authorization boundary encompasses all software components, Docker containers, container networks, and managed data stores deployed as part of the CTT system. This includes:

- Nginx reverse proxy container
- React frontend application (served as static files from Nginx)
- Node.js/Express backend API container
- PostgreSQL database container (or managed cloud database service)
- Redis real-time state cache container (or managed cloud cache service)
- All Docker networks interconnecting the above components
- Configuration files, environment variables, and secrets managed by the deployment

### 6.2 What Is Excluded from the Boundary

The following components are explicitly excluded from the CTT authorization boundary and are covered under their respective provider's authorization:

- AWS underlying infrastructure (covered under AWS FedRAMP authorization)
- Azure underlying infrastructure (covered under Azure FedRAMP authorization)
- Organization enterprise identity provider (OIDC/SSO) — covered under the organization's existing ATO
- Organization network infrastructure (firewalls, routers, enterprise DNS)
- End-user workstations and browsers

### 6.3 External Interconnections

| Connection | Direction | Protocol | Data Shared | Authorization |
|---|---|---|---|---|
| Enterprise OIDC/SSO Provider | Inbound (auth redirect) | HTTPS / OIDC | User identity assertions (sub, email, name) | Organization IDP ATO |
| Anthropic Claude API (optional) | Outbound | HTTPS/TLS | Scenario prompt text (no PII) | Anthropic Cloud Service |
| Ollama Local LLM (optional) | Internal | HTTP (localhost) | Scenario prompt text (no PII) | Within boundary |
| AWS CloudWatch (cloud deployments) | Outbound | HTTPS | Application log events (no PII in log messages) | AWS FedRAMP authorization |
| Azure Monitor (cloud deployments) | Outbound | HTTPS | Application log events (no PII in log messages) | Azure FedRAMP authorization |

---

## 7. Information Types

The following information types are processed, stored, or transmitted by CyberTabletop, categorized in accordance with NIST SP 800-60 Volume II:

### 7.1 User Account Data
- **Description:** User display names, email addresses, hashed passwords (bcrypt), OIDC subject identifiers, assigned roles, account creation and last login timestamps.
- **NIST SP 800-60 Type:** C.2.8.12 — General Contact Information
- **Sensitivity:** This data is limited to email and display name. No Social Security Numbers, financial data, health data, or other sensitive PII is collected.
- **Categorization:** Confidentiality: MODERATE | Integrity: MODERATE | Availability: LOW

### 7.2 Exercise Session Data
- **Description:** Session metadata, participant rosters, scenario inject delivery timestamps, participant decision records, scoring data, and after-action report content.
- **NIST SP 800-60 Type:** C.3.2.1 — Training and Education
- **Sensitivity:** Low sensitivity. Data represents exercise performance and does not reflect real operational security posture.
- **Categorization:** Confidentiality: LOW | Integrity: MODERATE | Availability: LOW

### 7.3 Scenario Content
- **Description:** Scenario templates, inject text, decision option rubrics, scoring criteria. May include descriptions of hypothetical threat scenarios.
- **NIST SP 800-60 Type:** C.3.2.1 — Training and Education
- **Sensitivity:** Low. Scenario descriptions are fictional training content.
- **Categorization:** Confidentiality: LOW | Integrity: MODERATE | Availability: LOW

### 7.4 Audit and Log Data
- **Description:** System event logs including login events, session creation/termination, API calls, administrative actions, and error events. Logs capture timestamps, user IDs, IP addresses, and action descriptions.
- **NIST SP 800-60 Type:** C.3.5.1 — Corrective Action
- **Sensitivity:** Moderate. Log data may reveal operational patterns or be used to reconstruct user activity.
- **Categorization:** Confidentiality: MODERATE | Integrity: HIGH | Availability: LOW

### 7.5 System Configuration Data
- **Description:** Application configuration files, environment variables (excluding secrets), Docker Compose configuration, TLS certificate metadata, and database schema definitions.
- **NIST SP 800-60 Type:** C.3.5.1 — Corrective Action
- **Sensitivity:** Moderate. Configuration data could facilitate attacks if disclosed.
- **Categorization:** Confidentiality: MODERATE | Integrity: HIGH | Availability: LOW

---

## 8. Applicable Laws, Regulations, and Standards

| Document | Applicability |
|---|---|
| Federal Information Security Modernization Act (FISMA), 44 U.S.C. § 3551 et seq. | Primary governing statute for federal information security |
| OMB Circular A-130, *Managing Information as a Strategic Resource* | Policy requirements for federal information management and security |
| NIST SP 800-53 Rev 5, *Security and Privacy Controls for Information Systems and Organizations* | Primary control framework |
| NIST SP 800-37 Rev 2, *Risk Management Framework* | RMF process guidance |
| FIPS 199, *Standards for Security Categorization* | System categorization |
| FIPS 200, *Minimum Security Requirements for Federal Information and Information Systems* | Minimum security requirements for MODERATE systems |
| NIST SP 800-60 Vol. 2, *Guide for Mapping Types of Information and Information Systems* | Information type categorization |
| NIST SP 800-63B, *Digital Identity Guidelines* | Authentication assurance level requirements |
| Executive Order 14028, *Improving the Nation's Cybersecurity* | Zero Trust and software supply chain security directives |
| Privacy Act of 1974, 5 U.S.C. § 552a | Privacy protections for personally identifiable information |

---

## 9. Security Control Implementation

Implementation status codes:
- **I** = Implemented
- **PI** = Partially Implemented
- **P** = Planned
- **NA** = Not Applicable

---

### 9.1 Access Control (AC)

#### AC-1 — Access Control Policy and Procedures
**Status:** Implemented

**Implementation:** The CyberTabletop Access Control Policy is documented in this SSP and the Configuration Management Plan. The policy establishes requirements for user account provisioning, role assignment, authentication, and least privilege. The ISSO is responsible for reviewing and updating the policy annually or upon significant changes to the system. Procedures for access control are implemented through the role-based access control (RBAC) system built into the application and documented in the system administrator guide.

**Responsible Role:** ISSO, System Owner

---

#### AC-2 — Account Management
**Status:** Implemented

**Implementation:** CTT implements account management through invite-gated registration and its administrative interface. The first non-system account becomes `SUPER_ADMIN`; subsequent self-registered accounts become `PLAYER` unless an administrator changes their role. Supported roles are `SUPER_ADMIN`, `ORG_ADMIN`, `FACILITATOR`, and `PLAYER`. Administrators can review users, change roles within their authority, and reset MFA for another user after identity verification. The built-in `system@cybertabletop.internal` identity owns seeded/built-in records and is not intended for interactive login. The system maintains audit records for user lifecycle and authentication events.

**Responsible Role:** System Administrator, ISSO

---

#### AC-3 — Access Enforcement
**Status:** Implemented

**Implementation:** Access enforcement is implemented through middleware in the Express.js backend. Protected API endpoints verify the user's JWT and current user record. Role-based authorization middleware evaluates the user's assigned role against the required permissions for each endpoint. The RBAC matrix defines: `SUPER_ADMIN` has full platform administration, `ORG_ADMIN` has organization-level administration, `FACILITATOR` can create and manage sessions and scenarios, and `PLAYER` can access sessions they join. The React frontend enforces the same role checks on the client side, with server-side enforcement as the authoritative control.

**Responsible Role:** Application Developer, System Administrator

---

#### AC-4 — Information Flow Enforcement
**Status:** Implemented

**Implementation:** Information flow within CTT is controlled through the system architecture. All external traffic must pass through Nginx, which only forwards traffic to authorized backend routes. The backend API enforces data access controls ensuring participants can only retrieve data for sessions they are enrolled in. Scenario scoring rubrics are not exposed to participants during an active session. Database queries are parameterized to prevent unauthorized data access through injection attacks. Internal Docker networks isolate backend and database containers from direct external access.

**Responsible Role:** Application Developer, System Administrator

---

#### AC-5 — Separation of Duties
**Status:** Partially Implemented

**Implementation:** The system enforces separation of duties through its role hierarchy. `FACILITATOR` users can manage exercises but cannot administer users or platform security settings. `PLAYER` users cannot access administrative functions. `SUPER_ADMIN` and `ORG_ADMIN` users have administrative capabilities appropriate to their scope. In small deployments, a single individual may hold both administrative and facilitator responsibilities; compensating controls include audit logging of role changes and administrative actions, plus periodic access review by the operator.

**Responsible Role:** System Owner, ISSO

---

#### AC-6 — Least Privilege
**Status:** Implemented

**Implementation:** CTT applies the principle of least privilege at multiple layers. The application enforces role-based permissions such that no user has more access than required for their function. The Node.js backend process runs as a non-root user within its container. PostgreSQL and Redis are isolated on Docker internal networks and are not published to the host by default. Administrative functions are restricted to users explicitly assigned `SUPER_ADMIN` or `ORG_ADMIN` as appropriate.

**Responsible Role:** System Administrator, Application Developer

---

#### AC-7 — Unsuccessful Login Attempts
**Status:** Implemented

**Implementation:** The authentication module implements account lockout after five consecutive failed login attempts. Upon five failed attempts, the account is locked for 30 minutes before the user may attempt again. Failed login and lockout events are recorded in the audit log with timestamp, account context, source IP address, and user-agent when available. The Admin security dashboard highlights failed-login and lockout activity for operator review.

**Responsible Role:** Application Developer, System Administrator

---

#### AC-8 — System Use Notification
**Status:** Planned / Operator Dependent

**Implementation:** CyberTabletop currently provides the login and registration screens but does not include a configurable pre-authentication system-use banner in the application UI. Organizations that require AC-8 style notification should add an approved banner at the public reverse proxy/identity-provider layer or track application-level banner support as a local enhancement.

**Responsible Role:** System Administrator, ISSO

---

#### AC-11 — Device Lock
**Status:** Not Applicable

**Implementation:** CTT is a web application that does not manage device lock functionality. Session lifetime controls are implemented with short-lived access tokens and refresh-token rotation (see AC-12). Device lock is the responsibility of the end-user's operating system and is outside the CTT authorization boundary.

**Responsible Role:** N/A

---

#### AC-12 — Session Termination
**Status:** Implemented

**Implementation:** CTT implements session management with 15-minute JWT access tokens and 7-day server-side refresh tokens stored only as hashes. Refresh tokens are rotated on use and revoked on logout. Protected API requests validate the token issuer, audience, user identifier, role, organization, and current user record. Deleted users cannot continue refreshing because their refresh-token relationship no longer resolves to a valid account; existing access tokens expire naturally within 15 minutes.

**Responsible Role:** Application Developer, System Administrator

---

#### AC-14 — Permitted Actions Without Identification or Authentication
**Status:** Implemented

**Implementation:** The only actions permitted without authentication are viewing the login and registration pages, submitting local authentication/registration requests, completing MFA login/setup flow prerequisites, and initiating the OIDC authentication redirect. No application data, scenario content, or exercise results are accessible without a valid authenticated session. The `/health` status endpoint returns only system availability status and contains no sensitive information.

**Responsible Role:** Application Developer

---

#### AC-17 — Remote Access
**Status:** Implemented

**Implementation:** All remote access to CTT is conducted over HTTPS (TLS 1.2 minimum) through the Nginx reverse proxy. Administrative access to underlying infrastructure (SSH to host servers, cloud management consoles) requires multi-factor authentication and is restricted to authorized IP ranges via firewall rules. All remote administrative sessions are logged. Remote access to on-premises deployment management interfaces requires VPN.

**Responsible Role:** System Administrator, ISSO

---

#### AC-18 — Wireless Access
**Status:** Not Applicable

**Implementation:** CTT does not implement or manage wireless access points. Wireless network access is managed by the organization's network infrastructure team and is outside the CTT authorization boundary.

**Responsible Role:** N/A

---

#### AC-19 — Access Control for Mobile Devices
**Status:** Not Applicable

**Implementation:** CTT does not manage mobile device configuration. Mobile device management (MDM) is outside the CTT authorization boundary and is managed by the organization.

**Responsible Role:** N/A

---

#### AC-20 — Use of External Systems
**Status:** Implemented

**Implementation:** CTT's use of external systems is limited and documented in Section 6.3. All external integrations use TLS-encrypted connections. The optional Claude API integration transmits only scenario prompt text — no user PII, credentials, or sensitive system data is sent to external APIs. External system usage is reviewed annually by the ISSO.

**Responsible Role:** System Administrator, ISSO

---

#### AC-22 — Publicly Accessible Content
**Status:** Implemented

**Implementation:** CTT does not host publicly accessible content beyond authentication, registration, health, and SSO bootstrap surfaces. No application data, scenario content, user data, or exercise results are accessible without authentication. The ISSO or operator should review publicly accessible components periodically to confirm no sensitive information has been inadvertently exposed.

**Responsible Role:** ISSO, System Administrator

---

### 9.2 Awareness and Training (AT)

#### AT-1 — Awareness and Training Policy and Procedures
**Status:** Implemented

**Implementation:** The organization maintains a security awareness and training policy covering all personnel with access to federal information systems. The policy requires initial security awareness training upon system access and annual refresher training. Procedures for tracking training completion are maintained by the ISSO and Human Resources.

**Responsible Role:** ISSO, Human Resources

---

#### AT-2 — Awareness Training
**Status:** Implemented

**Implementation:** All CTT users complete the organization's security awareness training program prior to receiving system access. Training covers phishing awareness, password security, incident reporting, and acceptable use. Training completion is tracked in the organization's Learning Management System (LMS). Users who do not complete annual refresher training have their CTT accounts suspended until training is complete.

**Responsible Role:** ISSO, System Administrator

---

#### AT-3 — Role-Based Training
**Status:** Implemented

**Implementation:** CTT Administrators and Facilitators receive role-based training covering their specific responsibilities. Administrator training covers secure system configuration, account management procedures, patch management, and incident reporting. Facilitator training covers secure exercise facilitation, data handling, and proper use of AI-assisted scenario generation features. Training materials are maintained by the ISSO and updated annually.

**Responsible Role:** ISSO, System Owner

---

#### AT-4 — Training Records
**Status:** Implemented

**Implementation:** Training completion records for all CTT users are maintained in the organization's LMS and retained for a minimum of three years. The ISSO reviews training completion records quarterly and reports status to the System Owner. Non-compliant users are notified, and accounts are suspended after a 30-day grace period.

**Responsible Role:** ISSO, Human Resources

---

### 9.3 Audit and Accountability (AU)

#### AU-1 — Audit and Accountability Policy and Procedures
**Status:** Implemented

**Implementation:** The CTT Audit and Accountability Policy is documented in this SSP. The policy requires comprehensive logging of security-relevant events, log protection, regular log review, and defined retention. Procedures for log management are documented in the system administrator guide and the Configuration Management Plan. The ISSO reviews and updates the policy annually.

**Responsible Role:** ISSO

---

#### AU-2 — Event Logging
**Status:** Implemented

**Implementation:** CTT logs the following security-relevant events: user login and logout (successful and failed); user account creation, modification, and deletion; role assignment changes; session creation and termination; API calls to administrative endpoints; scenario and exercise creation, modification, and deletion; export of after-action reports; changes to system configuration via the administrative interface; and system errors indicating potential security-relevant conditions. Each log event includes timestamp (UTC), user identifier, source IP address, action performed, target object, and outcome.

**Responsible Role:** Application Developer, System Administrator

---

#### AU-3 — Content of Audit Records
**Status:** Implemented

**Implementation:** Each audit log record contains: (1) date and time in UTC ISO 8601 format; (2) the component generating the event; (3) the event type; (4) the subject identity (user ID or service account); (5) the outcome (success or failure); (6) the source IP address; (7) the object or resource affected; and (8) contextual data needed to reconstruct the event. Log records are structured as JSON for machine-parseable analysis.

**Responsible Role:** Application Developer

---

#### AU-4 — Audit Log Storage Capacity
**Status:** Implemented

**Implementation:** Log storage capacity is monitored and managed. On-premises deployments use log rotation via logrotate, retaining compressed logs for 90 days with a minimum of 10 GB reserved for log storage. Cloud deployments forward logs to AWS CloudWatch or Azure Monitor with 90-day retention policies. Alerts are triggered when log storage utilization exceeds 80% of allocated capacity. The ISSO reviews log storage capacity monthly.

**Responsible Role:** System Administrator

---

#### AU-5 — Response to Audit Processing Failures
**Status:** Implemented

**Implementation:** The CTT application monitors the health of its logging subsystem. If the logging pipeline fails, the system generates an alert to the System Administrator and ISSO. The system continues to operate but records the logging failure event and the duration of the outage once logging is restored. Critical security events that could not be logged are flagged for manual review upon recovery.

**Responsible Role:** System Administrator, ISSO

---

#### AU-6 — Audit Record Review, Analysis, and Reporting
**Status:** Implemented

**Implementation:** The ISSO or designated security analyst reviews CTT audit logs weekly for indicators of unauthorized access, account anomalies, and policy violations. Automated log analysis tools (AWS CloudWatch Insights, Azure Log Analytics, or equivalent SIEM) detect anomalous activity patterns. Log review findings are documented and retained. Significant findings are escalated to the System Owner per the Incident Response Plan. A summary of audit review findings is included in the annual security assessment report.

**Responsible Role:** ISSO, System Administrator

---

#### AU-7 — Audit Record Reduction and Report Generation
**Status:** Implemented

**Implementation:** CTT logs are in structured JSON format, enabling automated parsing and report generation. Cloud deployments use native cloud log analytics for reporting. On-premises deployments may use open-source tools such as the ELK Stack. Log reduction does not alter original log records, which are retained in their complete form.

**Responsible Role:** System Administrator, ISSO

---

#### AU-8 — Time Stamps
**Status:** Implemented

**Implementation:** All CTT components synchronize their system clocks with the organization's NTP servers or a trusted public NTP source (pool.ntp.org). All log timestamps are recorded in Coordinated Universal Time (UTC) in ISO 8601 format. Time synchronization is verified monthly. Clock drift is monitored and alerted if it exceeds 500 milliseconds.

**Responsible Role:** System Administrator

---

#### AU-9 — Protection of Audit Information
**Status:** Partially Implemented

**Implementation:** CTT records security-relevant events in application audit records and structured service logs. Application code does not expose audit deletion or modification workflows. Operators should forward logs to append-only external storage or a SIEM for tamper-resistant retention and should restrict direct database administrative access.

**Responsible Role:** System Administrator, ISSO

---

#### AU-11 — Audit Record Retention
**Status:** Implemented

**Implementation:** CTT audit records are retained for a minimum of three years in accordance with NARA General Records Schedule requirements. Records older than three years are archived to cold storage (AWS S3 Glacier, Azure Blob Archive, or equivalent) for an additional two years before disposal. Log disposal is documented and approved by the ISSO and System Owner.

**Responsible Role:** System Administrator, ISSO

---

#### AU-12 — Audit Record Generation
**Status:** Implemented

**Implementation:** Audit record generation is implemented at the application layer (Node.js middleware), the infrastructure layer (Nginx access logs, PostgreSQL logs, Docker daemon logs). Each layer independently generates records, providing defense-in-depth coverage. The application audit module writes structured JSON log records to local log files and, in cloud deployments, forwards them to the cloud provider's managed log service. The Nginx access log captures all HTTP requests and responses. PostgreSQL logs failed connection attempts and DDL operations.

**Responsible Role:** Application Developer, System Administrator

---

### 9.4 Assessment, Authorization, and Monitoring (CA)

#### CA-1 — Assessment, Authorization, and Monitoring Policy
**Status:** Implemented

**Implementation:** The organization maintains an Assessment, Authorization, and Monitoring policy requiring periodic security assessments, formal authorization to operate, and continuous monitoring. CTT operates under this policy. The ISSO maintains the Authorization package and reports continuously monitored security metrics to the AO.

**Responsible Role:** ISSO, AO

---

#### CA-2 — Control Assessments
**Status:** Implemented

**Implementation:** CTT undergoes an annual security control assessment conducted by an independent assessor. The Security Assessment Plan (SAP.md) documents the scope, methodology, and schedule. Assessment findings are documented in the Security Assessment Report (SAR-template.md). The ISSO coordinates the assessment and tracks findings in the POA&M.

**Responsible Role:** ISSO, Independent Assessor

---

#### CA-5 — Plan of Action and Milestones
**Status:** Implemented

**Implementation:** The ISSO maintains a Plan of Action and Milestones (POAM.md) tracking all identified security weaknesses. The POA&M is updated monthly and submitted to the AO quarterly. Findings from security assessments, continuous monitoring, and audits are added within 30 days of identification.

**Responsible Role:** ISSO

---

#### CA-6 — Authorization
**Status:** Implemented

**Implementation:** CTT operates under a formal Authorization to Operate (ATO) granted by the designated Authorizing Official based on the complete authorization package (SSP, PIA, SAR, POA&M). The ATO has a three-year validity period, subject to annual reviews and continuous monitoring. Significant changes trigger a change in authorization determination review.

**Responsible Role:** AO, ISSO

---

#### CA-7 — Continuous Monitoring
**Status:** Implemented

**Implementation:** CTT's continuous monitoring program includes: automated vulnerability scanning of container images and dependencies monthly; audit log review weekly; system configuration compliance review quarterly; security control review annually; and real-time alerting for critical security events. Monitoring metrics and findings are reported to the AO via quarterly security status reports.

**Responsible Role:** ISSO, System Administrator

---

#### CA-8 — Penetration Testing
**Status:** Planned

**Implementation:** Penetration testing has not yet been conducted. A penetration test is planned for Q3 2026. Subsequent penetration tests will be conducted every three years or following significant system changes. This item is tracked in the POA&M (POAM-003).

**Responsible Role:** ISSO, Third-Party Assessor

---

#### CA-9 — Internal System Connections
**Status:** Implemented

**Implementation:** Internal connections between CTT components (Nginx to backend, backend to PostgreSQL, backend to Redis) are established over private Docker networks not accessible externally. All internal connections are documented in the boundary diagram and data flow diagram. Connection parameters are reviewed as part of the annual security assessment.

**Responsible Role:** System Administrator

---

### 9.5 Configuration Management (CM)

#### CM-1 — Configuration Management Policy and Procedures
**Status:** Implemented

**Implementation:** The CTT Configuration Management Plan (config-management-plan.md) documents the policy and procedures for managing system configuration baselines, changes, patches, and software inventory. The policy is reviewed annually.

**Responsible Role:** ISSO, System Administrator

---

#### CM-2 — Baseline Configuration
**Status:** Implemented

**Implementation:** Baseline configurations are established and maintained for all CTT components, including Docker base images, Node.js application configuration, Nginx configuration, PostgreSQL configuration, and Docker Compose definitions. Baselines are stored in the version-controlled repository. Configuration deviations from baseline require a formal change request.

**Responsible Role:** System Administrator

---

#### CM-3 — Configuration Change Control
**Status:** Implemented

**Implementation:** All configuration changes are subject to a formal change control process. Changes are proposed through the organization's change management system, reviewed for security impact by the ISSO, approved by the System Owner, tested in a development environment, and deployed via the CI/CD pipeline. Emergency changes may be approved verbally with documentation within 24 hours. The change log is maintained in version control.

**Responsible Role:** System Administrator, ISSO, System Owner

---

#### CM-4 — Impact Analyses
**Status:** Implemented

**Implementation:** Security impact analyses are performed for all proposed changes. The ISSO reviews each change request for potential security impact including effects on: security controls, authentication, authorization, data protection, and audit logging. High-impact changes require AO concurrence before implementation. Impact analysis results are documented in the change request record.

**Responsible Role:** ISSO

---

#### CM-6 — Configuration Settings
**Status:** Implemented

**Implementation:** Security-relevant configuration settings are documented and enforced for CTT components. Key settings include: Nginx TLS configuration (TLS 1.2+, strong cipher suites, HSTS enabled); Node.js security headers via helmet.js; privileged-role TOTP MFA; PostgreSQL and Redis internal networking; Docker `no-new-privileges`; and environment variable management through `.env`, Docker secrets, or cloud-native secrets management depending on deployment maturity.

**Responsible Role:** System Administrator

---

#### CM-7 — Least Functionality
**Status:** Implemented

**Implementation:** CTT containers are built from minimal base images (node:20-alpine, nginx:alpine, postgres:16-alpine, and redis:7-alpine) to reduce the attack surface. Unnecessary OS packages are not installed. Only required ports are exposed. The Nginx configuration exposes frontend, API, health, and Socket.io routes. The Node.js application does not expose debug endpoints in production. Package dependencies are audited through npm audit and CI checks.

**Responsible Role:** Application Developer, System Administrator

---

#### CM-8 — System Component Inventory
**Status:** Implemented

**Implementation:** A component inventory is maintained documenting all CTT software components, Docker images, and third-party libraries including version numbers. The inventory is automatically updated by the CI/CD pipeline upon each deployment. Dependency inventory is generated using `npm audit` and `docker inspect`. The inventory is reviewed quarterly.

**Responsible Role:** System Administrator

---

#### CM-10 — Software Usage Restrictions
**Status:** Implemented

**Implementation:** CTT uses only open-source software with licenses compatible with federal use (MIT, Apache 2.0, BSD, PostgreSQL License) and commercially licensed software with appropriate agreements. An approved software list is maintained in the Configuration Management Plan. Installation of unapproved software is prohibited and enforced through access controls on host servers.

**Responsible Role:** System Administrator, ISSO

---

#### CM-11 — User-Installed Software
**Status:** Implemented

**Implementation:** Users of the CTT web application cannot install software on CTT infrastructure. System administrators may only install software from the approved software list following the change control process. This is enforced through access controls and container configurations.

**Responsible Role:** System Administrator

---

### 9.6 Contingency Planning (CP)

#### CP-1 — Contingency Planning Policy
**Status:** Implemented

**Implementation:** The CTT Contingency Plan (contingency-plan.md) documents the policy and procedures for system recovery. The policy establishes an RTO of 4 hours and RPO of 24 hours consistent with the LOW availability categorization.

**Responsible Role:** ISSO, System Owner

---

#### CP-2 — Contingency Plan
**Status:** Implemented

**Implementation:** A full Contingency Plan is documented in contingency-plan.md. The plan covers activation criteria, roles and responsibilities, notification procedures, recovery procedures for each component, and reconstitution procedures.

**Responsible Role:** ISSO

---

#### CP-4 — Contingency Plan Testing
**Status:** Planned

**Implementation:** Contingency plan testing via tabletop exercise is scheduled for Q4 2026. Annual testing thereafter. This is tracked in the POA&M.

**Responsible Role:** ISSO, System Administrator

---

#### CP-9 — Information System Backup
**Status:** Implemented

**Implementation:** CyberTabletop provides PostgreSQL backup and restore scripts for Docker deployments (`scripts/backup.sh`, `scripts/backup.ps1`, `scripts/restore.sh`, and `scripts/restore.ps1`). Operators are responsible for scheduling backups, protecting backup files, applying encryption or secure storage appropriate to their environment, and testing restore into a clean stack before relying on backups for production recovery. Configuration and source-controlled scenario seed content are backed up via version control.

**Responsible Role:** System Administrator

---

#### CP-10 — Information System Recovery and Reconstitution
**Status:** Implemented

**Implementation:** Recovery and reconstitution procedures are documented in the Contingency Plan. The system can be fully reconstituted from container images and database backups within the 4-hour RTO. Recovery procedures are tested annually.

**Responsible Role:** System Administrator, ISSO

---

### 9.7 Identification and Authentication (IA)

#### IA-1 — Identification and Authentication Policy
**Status:** Implemented

**Implementation:** The CTT Identification and Authentication policy requires unique user identification, authentication prior to access, and password requirements compliant with NIST SP 800-63B guidance.

**Responsible Role:** ISSO

---

#### IA-2 — Identification and Authentication (Organizational Users)
**Status:** Implemented

**Implementation:** All CTT users are uniquely identified through either a locally-created account with a unique email address or an OIDC assertion containing a unique subject identifier. Authentication is required for all access beyond the login page. OIDC authentication leverages the enterprise identity provider, which must meet AAL2 requirements.

**Responsible Role:** Application Developer, System Administrator

---

#### IA-2(1) — Multi-Factor Authentication to Privileged Accounts
**Status:** Implemented

**Implementation:** Local TOTP MFA is enforced for `SUPER_ADMIN`, `ORG_ADMIN`, and `FACILITATOR` accounts. Privileged users without MFA are forced into MFA setup before accessing protected application features. MFA-enabled users receive a short-lived MFA challenge after password validation and must complete a TOTP or recovery-code challenge before access and refresh tokens are issued. Operators using OIDC/SSO should also enforce MFA at the identity provider.

**Responsible Role:** System Administrator, ISSO

---

#### IA-3 — Device Identification and Authentication
**Status:** Not Applicable

**Implementation:** CTT does not implement device-level identification and authentication. Device management is handled by the organization's endpoint management program.

**Responsible Role:** N/A

---

#### IA-4 — Identifier Management
**Status:** Implemented

**Implementation:** User identifiers (account IDs) are system-generated UUIDs assigned at account creation. Email addresses serve as human-readable unique identifiers. Email verification is not implemented in the local-account flow; operators should use invite-gated registration, administrator review, or OIDC/SSO when stronger account proofing is required. Identifiers are not reused.

**Responsible Role:** Application Developer, System Administrator

---

#### IA-5 — Authenticator Management
**Status:** Implemented

**Implementation:** Passwords for local accounts must be at least 12 characters and include uppercase, lowercase, numeric, and special characters. Passwords are stored exclusively as bcrypt hashes with work factor 12. TOTP MFA secrets are encrypted at rest with `MFA_ENCRYPTION_KEY` using AES-256-GCM. MFA recovery codes are shown once and stored only as bcrypt hashes. JWT signing secrets and refresh-token secrets are externalized through deployment configuration.

**Responsible Role:** Application Developer, System Administrator

---

#### IA-6 — Authentication Feedback
**Status:** Implemented

**Implementation:** Login failure messages display "Invalid username or password" without specifying which credential was incorrect, preventing user enumeration. Password fields mask input. API error responses do not expose internal system details.

**Responsible Role:** Application Developer

---

#### IA-7 — Cryptographic Module Authentication
**Status:** Implemented

**Implementation:** CTT uses the Node.js crypto module and bcrypt library for cryptographic operations with industry-standard algorithms. TLS operations are handled by OpenSSL through Nginx and Node.js's built-in TLS support. Cloud deployments on AWS and Azure leverage FIPS-validated cryptographic services.

**Responsible Role:** Application Developer, System Administrator

---

#### IA-8 — Identification and Authentication (Non-Organizational Users)
**Status:** Implemented

**Implementation:** Non-organizational users invited from external organizations authenticate through the same mechanisms as organizational users: local accounts or OIDC. Non-organizational users typically receive the `PLAYER` role and are limited to active sessions they join.

**Responsible Role:** System Administrator, Application Developer

---

### 9.8 Incident Response (IR)

#### IR-1 — Incident Response Policy
**Status:** Implemented
**Implementation:** The CTT Incident Response Plan (incident-response-plan.md) documents the complete policy and procedures for incident detection, reporting, containment, eradication, and recovery.
**Responsible Role:** ISSO

#### IR-2 — Incident Response Training
**Status:** Implemented
**Implementation:** Personnel with CTT incident response roles (ISSO, System Administrator, System Owner) receive annual incident response training covering detection, reporting, containment, and escalation.
**Responsible Role:** ISSO

#### IR-3 — Incident Response Testing
**Status:** Planned
**Implementation:** An incident response exercise for CTT is planned for Q4 2026 and will be conducted annually thereafter. Tracked in the POA&M.
**Responsible Role:** ISSO

#### IR-4 — Incident Handling
**Status:** Implemented
**Implementation:** The Incident Response Plan defines procedures for the complete incident handling lifecycle: preparation, detection and analysis, containment, eradication and recovery, and post-incident activities. Severity levels and escalation procedures are documented.
**Responsible Role:** ISSO, IR Lead

#### IR-5 — Incident Monitoring
**Status:** Implemented
**Implementation:** CTT security events are monitored through audit log review and automated alerting. Alerts are generated for failed login thresholds, unauthorized access attempts, system errors, and infrastructure anomalies. Incidents are tracked in the organization's incident tracking system.
**Responsible Role:** ISSO, System Administrator

#### IR-6 — Incident Reporting
**Status:** Implemented
**Implementation:** Incidents are reported to US-CERT/CISA within required timeframes: major incidents within 1 hour, all others within 24 hours. Internal reporting to the ISSM and AO occurs within 4 hours of confirmation. Incident reports include description, timeline, affected components, potentially exposed data, and remediation actions.
**Responsible Role:** ISSO, System Owner

#### IR-7 — Incident Response Assistance
**Status:** Implemented
**Implementation:** The ISSO coordinates with the organization's CSIRT for incident response assistance. Contact information for US-CERT, the organization CSIRT, and relevant service provider security teams is documented in the Incident Response Plan.
**Responsible Role:** ISSO

#### IR-8 — Incident Response Plan
**Status:** Implemented
**Implementation:** A complete Incident Response Plan is documented in incident-response-plan.md. The plan is reviewed annually, updated as needed, and distributed to all personnel with incident response responsibilities.
**Responsible Role:** ISSO

---

### 9.9 Maintenance (MA)

#### MA-1 — Policy and Procedures
**Status:** Implemented
**Implementation:** System maintenance procedures are documented in the Configuration Management Plan. Maintenance activities are tracked in the change management system.
**Responsible Role:** ISSO, System Administrator

#### MA-2 — Controlled Maintenance
**Status:** Implemented
**Implementation:** Maintenance activities (patching, updates, configuration changes) follow the change control process. Maintenance windows are scheduled, and system availability impacts are communicated to users in advance. All maintenance activities are logged.
**Responsible Role:** System Administrator

#### MA-4 — Nonlocal Maintenance
**Status:** Implemented
**Implementation:** Remote maintenance (SSH, cloud console access) requires MFA and is restricted to authorized IP ranges. All remote maintenance sessions are logged. Remote maintenance is performed only by authorized administrators.
**Responsible Role:** System Administrator

#### MA-5 — Maintenance Personnel
**Status:** Implemented
**Implementation:** Only personnel with authorized access may perform CTT maintenance. Third-party personnel are supervised by an authorized administrator. Contractor access is granted on a time-limited basis and revoked upon completion.
**Responsible Role:** System Owner, System Administrator

---

### 9.10 Media Protection (MP)

#### MP-1 — Policy and Procedures
**Status:** Implemented
**Implementation:** Media protection procedures cover digital media containing CTT data, including backup media and cloud storage.
**Responsible Role:** ISSO

#### MP-2 — Media Access
**Status:** Implemented
**Implementation:** Access to media containing CTT data is restricted to authorized personnel. Media is stored in locked storage when not in use.
**Responsible Role:** System Administrator

#### MP-6 — Media Sanitization
**Status:** Implemented
**Implementation:** Digital media containing CTT data is sanitized before disposal or reuse following NIST SP 800-88 guidelines. Cloud storage is deleted using provider-provided secure delete mechanisms. Sanitization activities are documented.
**Responsible Role:** System Administrator

#### MP-7 — Media Use
**Status:** Implemented
**Implementation:** Use of removable media on CTT production systems is prohibited. Backups are stored on encrypted media or in encrypted cloud storage. This control is enforced through system configuration and access controls.
**Responsible Role:** System Administrator

---

### 9.11 Physical and Environmental Protection (PE)

#### PE-1 — Policy and Procedures
**Status:** Implemented (Inherited)
**Implementation:** Physical and environmental protection for on-premises deployments is provided by the organization's facilities management program. Cloud deployments inherit physical security controls from the cloud provider's FedRAMP-authorized infrastructure.
**Responsible Role:** Facilities Management / Cloud Provider

#### PE-2 — Physical Access Authorizations
**Status:** Implemented (Inherited)
**Implementation:** Physical access to data center facilities hosting CTT on-premises infrastructure is managed by the organization's physical security program. Cloud deployments inherit this control from the cloud provider.
**Responsible Role:** Facilities Management / Cloud Provider

---

### 9.12 Planning (PL)

#### PL-1 — Policy and Procedures
**Status:** Implemented
**Implementation:** Security planning is documented in this SSP and updated annually or upon significant system changes.
**Responsible Role:** ISSO, System Owner

#### PL-2 — System Security and Privacy Plans
**Status:** Implemented
**Implementation:** This SSP serves as the system security plan. The PIA (PIA.md) serves as the privacy plan. Both documents are reviewed annually.
**Responsible Role:** ISSO, System Owner

#### PL-4 — Rules of Behavior
**Status:** Implemented
**Implementation:** Rules of behavior are primarily an operator responsibility and should be incorporated into the organization's acceptable use policy, identity-provider workflow, or reverse-proxy banner. CyberTabletop does not currently force a separate in-app rules-of-behavior acknowledgement before login.
**Responsible Role:** ISSO, System Owner

#### PL-8 — Security and Privacy Architectures
**Status:** Implemented
**Implementation:** The CTT security architecture is documented in this SSP, the boundary diagram (boundary-diagram.md), and the data flow diagram (data-flow-diagram.md). The architecture implements defense-in-depth, least privilege, and separation of duties principles.
**Responsible Role:** ISSO, Application Developer

---

### 9.13 Program Management (PM)

#### PM-1 — Information Security Program Plan
**Status:** Implemented (Organizational)
**Implementation:** The organization maintains an information security program plan that governs CTT. CTT's security activities are conducted within the framework of this organizational program.
**Responsible Role:** ISSM

#### PM-9 — Risk Management Strategy
**Status:** Implemented
**Implementation:** The organization's risk management strategy guides CTT risk assessment and treatment decisions. Risks identified in the Risk Assessment (risk-assessment.md) are managed in accordance with this strategy.
**Responsible Role:** ISSM, ISSO

---

### 9.14 Personnel Security (PS)

#### PS-1 — Policy and Procedures
**Status:** Implemented
**Implementation:** The organization's personnel security policy governs background investigations and security clearances for CTT personnel.
**Responsible Role:** Human Resources, ISSO

#### PS-3 — Personnel Screening
**Status:** Implemented
**Implementation:** All CTT administrators and staff with privileged access are subject to background investigations appropriate to their access level. Background investigation results are reviewed before access is granted.
**Responsible Role:** Human Resources

#### PS-4 — Personnel Termination
**Status:** Implemented
**Implementation:** Upon personnel termination or transfer, CTT accounts are disabled within 24 hours of HR notification. Privileged accounts are disabled immediately upon notification. Account disabling procedures are documented and tested.
**Responsible Role:** System Administrator, Human Resources

#### PS-5 — Personnel Transfer
**Status:** Implemented
**Implementation:** When personnel transfer to different roles, their CTT access is reviewed and adjusted to reflect new responsibilities within 5 business days.
**Responsible Role:** System Administrator, System Owner

#### PS-6 — Access Agreements
**Status:** Implemented
**Implementation:** All CTT users with privileged access are required to sign the organization's system access agreement and acceptable use policy before access is granted. Agreements are retained for the duration of employment plus three years.
**Responsible Role:** ISSO, Human Resources

---

### 9.15 Risk Assessment (RA)

#### RA-1 — Risk Assessment Policy
**Status:** Implemented
**Implementation:** The Risk Assessment policy is documented in this SSP and the Risk Assessment document (risk-assessment.md). Assessments are conducted annually and upon significant system changes.
**Responsible Role:** ISSO

#### RA-2 — Security Categorization
**Status:** Implemented
**Implementation:** CTT has been categorized as MODERATE impact in accordance with FIPS 199 and NIST SP 800-60. The complete categorization rationale is documented in fips199-categorization.md.
**Responsible Role:** ISSO, System Owner, AO

#### RA-3 — Risk Assessment
**Status:** Implemented
**Implementation:** A comprehensive risk assessment is documented in risk-assessment.md. The assessment identifies threat sources, vulnerabilities, likelihood, impact, and risk levels, with a risk register including mitigating controls for each identified risk.
**Responsible Role:** ISSO

#### RA-5 — Vulnerability Monitoring and Scanning
**Status:** Implemented
**Implementation:** Automated vulnerability scanning is performed monthly on CTT container images using Trivy or Grype. Dependency scanning is performed using `npm audit` on every CI/CD pipeline execution. Critical and High findings are remediated within 30 days; Medium findings within 90 days. Scan results are reviewed by the ISSO and tracked in the POA&M.
**Responsible Role:** System Administrator, ISSO

#### RA-7 — Risk Response
**Status:** Implemented
**Implementation:** Identified risks are addressed through one of four responses: accept, mitigate, transfer, or avoid. Risk response decisions are documented in the risk register and POA&M. The AO approves acceptance of residual risks.
**Responsible Role:** ISSO, AO, System Owner

---

### 9.16 System and Services Acquisition (SA)

#### SA-1 — Policy and Procedures
**Status:** Implemented
**Implementation:** The organization's acquisition policy governs procurement of software and services used by CTT. All third-party components are reviewed for security prior to integration.
**Responsible Role:** ISSO, Contracting Officer

#### SA-4 — Acquisition Process
**Status:** Implemented
**Implementation:** Security requirements are incorporated into acquisition documentation for third-party components or services. Vendors are required to provide security documentation (SOC 2 reports, vulnerability management policies) as part of procurement.
**Responsible Role:** ISSO, Contracting Officer

#### SA-8 — Security and Privacy Engineering Principles
**Status:** Implemented
**Implementation:** CTT was designed following security engineering principles: defense-in-depth, least privilege, fail-secure defaults, complete mediation, and open design. Security is built into the application architecture rather than added as an afterthought.
**Responsible Role:** Application Developer, ISSO

#### SA-9 — External System Services
**Status:** Implemented
**Implementation:** External services used by CTT are documented in the interconnections table. Service provider security documentation (FedRAMP authorizations, SOC 2 reports) is reviewed before use and annually thereafter.
**Responsible Role:** ISSO, System Owner

#### SA-11 — Developer Testing and Evaluation
**Status:** Implemented
**Implementation:** The CTT development process includes security testing: static analysis via automated linting, dependency vulnerability scanning via `npm audit`, and manual code review for security-sensitive functions. Security test results are documented and tracked.
**Responsible Role:** Application Developer, ISSO

---

### 9.17 System and Communications Protection (SC)

#### SC-1 — Policy and Procedures
**Status:** Implemented
**Implementation:** System and communications protection requirements are documented in this SSP. Configuration settings implementing these requirements are in the Configuration Management Plan.
**Responsible Role:** ISSO

#### SC-5 — Denial-of-Service Protection
**Status:** Implemented
**Implementation:** CTT implements rate limiting at the Nginx layer: maximum 100 requests per minute per IP for the API, and 10 requests per minute for authentication endpoints. Socket.io connections are limited to 5 concurrent connections per user. Cloud deployments benefit from the cloud provider's DDoS protection (AWS Shield Standard, Azure DDoS Protection Basic).
**Responsible Role:** System Administrator, Application Developer

#### SC-7 — Boundary Protection
**Status:** Implemented
**Implementation:** Nginx is the single ingress point for all external traffic. Internal services (PostgreSQL, Redis, backend API) are not exposed externally. Firewall rules restrict inbound traffic to ports 80 and 443. Outbound connections from application containers are limited to necessary external services.
**Responsible Role:** System Administrator

#### SC-8 — Transmission Confidentiality and Integrity
**Status:** Implemented
**Implementation:** All data in transit between users and CTT is encrypted using TLS 1.2 or higher. Nginx is configured with strong cipher suites (ECDHE-based key exchange, AES-GCM encryption). HTTP Strict Transport Security (HSTS) is enabled with max-age of one year and includeSubDomains. WebSocket connections use WSS. TLS certificates are obtained from a trusted CA and renewed automatically.
**Responsible Role:** System Administrator

#### SC-12 — Cryptographic Key Establishment and Management
**Status:** Implemented
**Implementation:** TLS private keys are stored in restricted-access directories. JWT signing secrets, refresh-token secrets, session secrets, database passwords, Redis passwords, and MFA_ENCRYPTION_KEY are externalized through environment configuration, Docker secrets, or cloud-native secrets management depending on deployment maturity. Database, volume, and backup encryption keys are managed by the operator's selected hosting platform.
**Responsible Role:** System Administrator, ISSO

#### SC-13 — Cryptographic Protection
**Status:** Implemented
**Implementation:** CTT uses industry-standard cryptographic algorithms: AES-256-GCM for TOTP secret encryption; TLS 1.2/1.3 (AES-GCM with ECDHE) for data in transit; bcrypt with work factor 12 for password and recovery-code hashing; HMAC-SHA256 for JWT signing; and deployment-managed encryption for database, volume, and backup data at rest.
**Responsible Role:** Application Developer, System Administrator

#### SC-15 — Collaborative Computing Devices and Applications
**Status:** Not Applicable
**Implementation:** CTT does not use collaborative computing devices (cameras, microphones).
**Responsible Role:** N/A

#### SC-17 — Public Key Infrastructure Certificates
**Status:** Implemented
**Implementation:** TLS certificates are obtained from a trusted public CA (Let's Encrypt, AWS Certificate Manager, or organizational PKI). Certificate expiration is monitored with alerts at 30 days prior to expiration.
**Responsible Role:** System Administrator

#### SC-18 — Mobile Code
**Status:** Implemented
**Implementation:** The CTT frontend uses only JavaScript served from the CTT application server. No third-party scripts from untrusted CDNs are loaded. Content Security Policy (CSP) headers prevent loading unauthorized scripts.
**Responsible Role:** Application Developer

#### SC-20 — Secure Name/Address Resolution Service (Authoritative Source)
**Status:** Implemented (Inherited)
**Implementation:** DNS for CTT is managed by the organization's DNS infrastructure or cloud provider. DNSSEC is implemented where supported.
**Responsible Role:** System Administrator / Cloud Provider

#### SC-28 — Protection of Information at Rest
**Status:** Partially Implemented / Deployment Dependent
**Implementation:** CTT encrypts TOTP MFA secrets at the application layer. Protection for PostgreSQL volumes, Redis persistence, host disks, and backup files is deployment dependent and must be configured by the operator using platform encryption, cloud database encryption, encrypted volumes, or a backup storage control appropriate to the environment.
**Responsible Role:** System Administrator

---

### 9.18 System and Information Integrity (SI)

#### SI-1 — Policy and Procedures
**Status:** Implemented
**Implementation:** System and information integrity requirements are documented in this SSP and implemented through the controls below.
**Responsible Role:** ISSO

#### SI-2 — Flaw Remediation
**Status:** Implemented
**Implementation:** Security flaws are tracked in the POA&M. Remediation timelines: Critical (CVSS 9.0+) within 7 days; High (CVSS 7.0-8.9) within 30 days; Medium (CVSS 4.0-6.9) within 90 days; Low addressed in the next planned maintenance window. Flaw remediation is tracked and reported to the ISSO.
**Responsible Role:** System Administrator, Application Developer, ISSO

#### SI-3 — Malicious Code Protection
**Status:** Implemented
**Implementation:** CTT container images are scanned for malware and known malicious code during CI/CD and monthly in production. Base images are sourced exclusively from official Docker Hub repositories or the organization's approved container registry. Host systems run endpoint protection software.
**Responsible Role:** System Administrator

#### SI-4 — System Monitoring
**Status:** Implemented
**Implementation:** CTT is monitored through application-level audit logging, infrastructure monitoring (CPU, memory, disk, network), and automated alerting for security-relevant thresholds. System health dashboards are reviewed daily by the System Administrator.
**Responsible Role:** System Administrator, ISSO

#### SI-5 — Security Alerts, Advisories, and Directives
**Status:** Implemented
**Implementation:** The ISSO subscribes to security advisories for CTT's key technologies and the CISA KEV catalog. Advisories are reviewed within 48 hours of receipt. Applicable patches are applied following the SI-2 flaw remediation timelines.
**Responsible Role:** ISSO, System Administrator

#### SI-7 — Software, Firmware, and Information Integrity
**Status:** Implemented
**Implementation:** CTT uses package lock files to support reproducible npm dependency installation and integrity verification. The GitHub workflow runs npm audit and Docker Compose build/config checks. Operators who need stronger supply-chain assurance should pin image digests, sign release images, and verify signatures in their deployment pipeline.
**Responsible Role:** Application Developer, System Administrator

#### SI-10 — Information Input Validation
**Status:** Implemented
**Implementation:** The CTT API validates user-provided data using Zod schemas and route-level guards, enforcing data types, maximum lengths, allowed character sets, and business rules where implemented. SQL injection is mitigated through Prisma ORM parameterized queries. XSS risk is reduced through React's default output encoding, CSP, httpOnly cookies, and server-side validation.
**Responsible Role:** Application Developer

#### SI-12 — Information Management and Retention
**Status:** Implemented
**Implementation:** User data, exercise records, and audit logs are retained according to schedules defined in the PIA and AU controls. Data exceeding its retention period is disposed of securely following documented procedures.
**Responsible Role:** System Administrator, ISSO

---

### 9.19 Supply Chain Risk Management (SR)

#### SR-1 — Policy and Procedures
**Status:** Implemented
**Implementation:** The organization's supply chain risk management policy governs the acquisition and use of software components. CTT's dependency management practices are documented in the Configuration Management Plan.
**Responsible Role:** ISSO, Contracting Officer

#### SR-3 — Supply Chain Controls and Processes
**Status:** Implemented
**Implementation:** CTT mitigates supply chain risks through: sourcing container base images exclusively from official repositories; pinning dependency versions in package-lock.json; conducting `npm audit` on every build; reviewing the Software Bill of Materials (SBOM) generated by the CI/CD pipeline; and monitoring the npm advisory database for vulnerabilities.
**Responsible Role:** Application Developer, System Administrator

#### SR-4 — Provenance
**Status:** Implemented
**Implementation:** The provenance of all CTT software components is maintained through: the version-controlled repository with signed commits; pinned dependency versions and integrity hashes in package-lock.json; Docker image build provenance in the CI/CD pipeline; and documentation of all third-party components in the component inventory.
**Responsible Role:** Application Developer, ISSO

#### SR-11 — Component Authenticity
**Status:** Implemented
**Implementation:** CTT uses package integrity checking via npm's built-in integrity hash verification (SRI hashes in package-lock.json). Docker images used in production are verified against known-good digests. The CI/CD pipeline rejects builds that fail integrity checks.
**Responsible Role:** Application Developer, System Administrator

---

## 10. Signature Page

By signing below, the identified officials acknowledge their roles and responsibilities with respect to the CyberTabletop System Security Plan.

---

**System Owner**

Name: ___________________________________

Title: ___________________________________

Signature: ___________________________________

Date: ___________________________________

---

**Information System Security Officer (ISSO)**

Name: ___________________________________

Title: ___________________________________

Signature: ___________________________________

Date: ___________________________________

---

**Authorizing Official (AO)**

Name: ___________________________________

Title: ___________________________________

Signature: ___________________________________

Date: ___________________________________

---

*This document is designated Controlled Unclassified Information (CUI) // For Official Use Only.*
*Document Version 1.0 | Date: March 15, 2026*
*Next Review Date: March 15, 2027*
