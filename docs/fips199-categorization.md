# FIPS 199 Security Categorization
## CyberTabletop Platform

---

| Field | Value |
|---|---|
| **Document Title** | FIPS 199 Security Categorization — CyberTabletop |
| **System Name** | CyberTabletop |
| **System Identifier** | CTT-001 |
| **Version** | 1.0 |
| **Date** | March 2026 |
| **Prepared By** | [SYSTEM OWNER NAME], Information System Owner |
| **Organization** | [ORGANIZATION] |
| **Authorizing Official** | [AUTHORIZING OFFICIAL] |
| **Document Status** | Final |

---

## 1. Purpose

This document establishes the FIPS 199 security categorization for the CyberTabletop information system, in accordance with the Federal Information Processing Standard Publication 199, "Standards for Security Categorization of Federal Information and Information Systems" (FIPS 199), and NIST SP 800-60, "Guide for Mapping Types of Information and Information Systems to Security Categories."

The security categorization provides the foundation for selecting a baseline set of security controls as required by NIST SP 800-53 Rev 5 and is a prerequisite for the system's Authority to Operate (ATO).

---

## 2. System Overview

**System Name:** CyberTabletop

**System Description:** CyberTabletop is a web-based gamified cybersecurity incident response (IR) tabletop exercise platform. The system enables Chief Information Security Officers (CISOs), incident response teams, and security professionals to conduct structured, scenario-driven tabletop exercises in an interactive, game-like environment. The platform provides scenario libraries, team role assignments, decision-tree based exercise flows, scoring, and after-action review capabilities.

**System Type:** Major Application

**Operational Status:** Operational

**System Environment:** Docker containerized deployment on locally hosted infrastructure or cloud infrastructure (AWS/Azure). Components include a React-based frontend, Node.js/Express backend API, PostgreSQL relational database, Redis in-memory data store, and Nginx reverse proxy.

**Users:** Security professionals including CISOs, incident response team members, security analysts, and security training administrators. The system supports up to 100+ concurrent users.

**Data Sensitivity:** The system does NOT process, store, or transmit financial data, healthcare data, classified national security information, or actual incident data from real security events. The system contains scenario content describing hypothetical security incidents for training purposes only.

---

## 3. Applicable Standards and References

- FIPS Publication 199, *Standards for Security Categorization of Federal Information and Information Systems*, February 2004
- FIPS Publication 200, *Minimum Security Requirements for Federal Information and Information Systems*, March 2006
- NIST SP 800-60 Vol. 1 Rev. 1, *Guide for Mapping Types of Information and Information Systems to Security Categories*, August 2008
- NIST SP 800-60 Vol. 2 Rev. 1, *Appendices to Guide for Mapping Types of Information and Information Systems to Security Categories*, August 2008
- NIST SP 800-53 Rev. 5, *Security and Privacy Controls for Information Systems and Organizations*, September 2020

---

## 4. Information Types Processed, Stored, or Transmitted

The following information types have been identified for CyberTabletop based on analysis of system functions and data flows.

### 4.1 Information Type 1: User Account and Identity Information

**Description:** User account data including email addresses, display names, hashed passwords, role assignments, and account metadata (creation date, last login, account status). This information is necessary for authentication, authorization, and system access management.

**NIST SP 800-60 Mapping:** C.2.8.12 — General Information (Personal Identity and Authentication Information)

**PII Present:** Yes (email address, display name, login timestamps)

| Security Objective | Default Impact | Adjusted Impact | Rationale for Adjustment |
|---|---|---|---|
| Confidentiality | MODERATE | MODERATE | Unauthorized disclosure of user email addresses and account information could enable targeted phishing, credential stuffing, or social engineering attacks against security professionals. While not financial or health data, the professional context elevates concern. |
| Integrity | MODERATE | MODERATE | Unauthorized modification of user accounts, roles, or credentials could compromise access controls and enable unauthorized access to the system or elevation of privilege. |
| Availability | LOW | LOW | Temporary unavailability of account data would prevent login but does not constitute a significant safety or operational impact given the training-only nature of the system. |

**Information Type Impact:** SC = {(Confidentiality, MODERATE), (Integrity, MODERATE), (Availability, LOW)}

---

### 4.2 Information Type 2: Session and Game Exercise Data

**Description:** Active and historical tabletop exercise session data including scenario selections, team assignments, decision records, scoring data, exercise timelines, and after-action report content. This data represents the operational output of the platform.

**NIST SP 800-60 Mapping:** C.3.5.1 — Training and Education (Training and Education)

| Security Objective | Default Impact | Adjusted Impact | Rationale for Adjustment |
|---|---|---|---|
| Confidentiality | LOW | MODERATE | Exercise data may contain organizational context (team names, exercise objectives, scenario customizations) that, if disclosed, could reveal information about an organization's incident response posture, gaps, or internal security team structure. This warrants elevation to MODERATE. |
| Integrity | LOW | MODERATE | Exercise data integrity is important for the validity of training outcomes and after-action reviews. Tampering with session records or scoring could undermine the purpose of the training exercises and potentially mislead IR teams about their readiness. |
| Availability | LOW | LOW | Loss of in-progress exercise data would be disruptive but not operationally critical. Exercises can be restarted. No safety or mission-critical functions depend on this data. |

**Information Type Impact:** SC = {(Confidentiality, MODERATE), (Integrity, MODERATE), (Availability, LOW)}

---

### 4.3 Information Type 3: Audit and Event Log Data

**Description:** System-generated audit logs capturing user actions, authentication events, authorization decisions, system errors, and administrative activities. Logs are application-managed in PostgreSQL with structured metadata; the application does not expose audit update/delete workflows.

**NIST SP 800-60 Mapping:** C.3.5.8 — Audit Information

| Security Objective | Default Impact | Adjusted Impact | Rationale for Adjustment |
|---|---|---|---|
| Confidentiality | MODERATE | MODERATE | Audit logs contain user activity patterns, access times, and system events. Unauthorized disclosure could enable attackers to understand system usage patterns, identify administrative accounts, or time attacks to avoid detection. |
| Integrity | MODERATE | MODERATE | Integrity of audit logs is critical for forensic capability, accountability, and compliance. Unauthorized modification would undermine the non-repudiation function of audit records. Application-layer append-only behavior mitigates ordinary misuse; operators should use SIEM or write-once external storage for stronger tamper resistance. |
| Availability | LOW | LOW | Temporary unavailability of historical audit logs does not create immediate safety or operational impact. New audit entries should continue to be written, but historical review can be deferred. |

**Information Type Impact:** SC = {(Confidentiality, MODERATE), (Integrity, MODERATE), (Availability, LOW)}

---

### 4.4 Information Type 4: Scenario and Training Content

**Description:** Cybersecurity incident response scenario content, including scenario descriptions, decision trees, inject scripts, scoring rubrics, and reference materials. This is primarily operational/functional content for the platform's training purpose.

**NIST SP 800-60 Mapping:** C.3.5.1 — Training and Education

**Note:** Scenario content describes *hypothetical* security incidents. It does NOT contain actual incident data, real threat intelligence, or real vulnerability data from production systems.

| Security Objective | Default Impact | Adjusted Impact | Rationale for Adjustment |
|---|---|---|---|
| Confidentiality | LOW | LOW | Scenario content is training material. While some scenarios may be organization-specific, the content does not constitute sensitive operational information. |
| Integrity | LOW | MODERATE | Integrity of scenario content is important for training validity. Unauthorized modification of scenarios could introduce misleading training content, potentially causing IR teams to adopt incorrect response procedures. |
| Availability | LOW | LOW | Scenario content is static or semi-static reference data. Temporary unavailability is disruptive to exercises but not operationally critical. |

**Information Type Impact:** SC = {(Confidentiality, LOW), (Integrity, MODERATE), (Availability, LOW)}

---

### 4.5 Information Type 5: System Configuration and Administrative Data

**Description:** System configuration files, environment variables (excluding secrets), administrative settings, role and permission configurations, and operational parameters. Secrets are externalized and not stored in this category.

**NIST SP 800-60 Mapping:** C.2.8.1 — Information Systems and Technology Management

| Security Objective | Default Impact | Adjusted Impact | Rationale for Adjustment |
|---|---|---|---|
| Confidentiality | MODERATE | MODERATE | Exposure of system configuration could reveal security control parameters, infrastructure details, or service dependencies that would aid an attacker in targeting the system. |
| Integrity | MODERATE | MODERATE | Unauthorized modification of system configuration could disable security controls, alter access policies, or introduce vulnerabilities. |
| Availability | LOW | LOW | Configuration data is restored from version-controlled sources. Temporary unavailability does not affect running system operation. |

**Information Type Impact:** SC = {(Confidentiality, MODERATE), (Integrity, MODERATE), (Availability, LOW)}

---

## 5. Overall System Security Categorization

### 5.1 Categorization Determination

Per FIPS 199, the overall information system security category is determined by taking the highest impact value across all information types for each security objective (the "high watermark" principle).

| Security Objective | Information Type 1 | Information Type 2 | Information Type 3 | Information Type 4 | Information Type 5 | **System High Watermark** |
|---|---|---|---|---|---|---|
| **Confidentiality** | MODERATE | MODERATE | MODERATE | LOW | MODERATE | **MODERATE** |
| **Integrity** | MODERATE | MODERATE | MODERATE | MODERATE | MODERATE | **MODERATE** |
| **Availability** | LOW | LOW | LOW | LOW | LOW | **LOW** |

### 5.2 Final Security Categorization

**SC CyberTabletop = {(Confidentiality, MODERATE), (Integrity, MODERATE), (Availability, LOW)}**

**Overall System Impact Level: MODERATE**

This categorization is expressed in accordance with FIPS 199 notation:

```
SC CyberTabletop = {(confidentiality, MODERATE), (integrity, MODERATE), (availability, LOW)}
```

The overall system security categorization is **MODERATE**, determined by the high watermark of the individual security objective impact levels.

---

## 6. Rationale for MODERATE Categorization

### 6.1 Why MODERATE (Not HIGH)

No information type processed by CyberTabletop reaches a HIGH impact level for any security objective. The system does not process:

- Classified national security information
- Financial account data, payment card data, or banking credentials
- Protected Health Information (PHI) or electronic health records
- Law enforcement sensitive information
- Export-controlled technical data
- Critical infrastructure operational data

The system processes security professional identity data and training exercise content. While the professional context elevates some concerns above LOW, the absence of highly sensitive data categories prevents any objective from reaching HIGH.

### 6.2 Why Not LOW

Multiple information types warrant MODERATE ratings:

1. **User Identity Data (Confidentiality: MODERATE):** The system's user population consists of security professionals, CISOs, and IR team members. Exposure of this user community's account information, login patterns, and organizational affiliations could enable targeted attacks against individuals who hold privileged security roles within their organizations. This population-specific risk elevates confidentiality above LOW.

2. **Exercise and Audit Data (Confidentiality: MODERATE):** Exercise session data may reveal organizational IR team structures, identified capability gaps, and internal response procedures. This organizational security posture information warrants MODERATE confidentiality protection.

3. **Integrity (MODERATE across all types):** The system's core purpose is to train IR teams in correct incident response procedures. If system integrity were compromised — whether through manipulation of exercise scenarios, audit logs, scoring, or user data — the training outcomes could be corrupted. IR teams could adopt incorrect procedures or false confidence based on manipulated results. This functional criticality of integrity supports MODERATE ratings across information types.

4. **Availability (LOW):** The system supports training exercises that, while important, are not real-time operational functions. Exercises can be rescheduled. No safety-critical, emergency-response, or time-critical operational functions depend on the system's availability. A brief outage causes inconvenience and schedule disruption, not mission failure.

### 6.3 FIPS 200 Security Control Baseline

Based on the MODERATE overall categorization, CyberTabletop shall implement the **MODERATE baseline** security controls as defined in FIPS 200 and detailed in NIST SP 800-53 Rev. 5. Tailoring of controls from this baseline is documented in the System Security Plan (SSP-CTT-001).

---

## 7. Review and Approval

This security categorization shall be reviewed:
- Annually as part of the continuous monitoring program
- When significant changes are made to the system (new information types, major architectural changes)
- When the threat environment changes materially
- Following any security incident that affects the categorization rationale

| Role | Name | Signature | Date |
|---|---|---|---|
| Prepared By | [SYSTEM OWNER NAME] | _____________ | March 2026 |
| Reviewed By | [ISSO NAME], Information System Security Officer | _____________ | March 2026 |
| Approved By | [AUTHORIZING OFFICIAL], Authorizing Official | _____________ | March 2026 |

---

*Document Version: 1.0 | Classification: UNCLASSIFIED | CUI: None*
*CyberTabletop ATO Package — [ORGANIZATION]*
