# Privacy Impact Assessment (PIA)
## CyberTabletop — Gamified Cybersecurity Incident Response Tabletop Exercise Platform

---

| Field | Value |
|---|---|
| **Document Title** | Privacy Impact Assessment |
| **System Name** | CyberTabletop |
| **System Abbreviation** | CTT |
| **Version** | 1.0 |
| **Date** | March 15, 2026 |
| **PIA Author** | [ISSO Name] |
| **Senior Agency Official for Privacy (SAOP) Review** | [SAOP Name] |
| **Status** | Initial Assessment |

---

## Table of Contents

1. System Identification and Overview
2. Legal Authority and Purpose
3. Characterization of the Information
4. Uses of the Information
5. Internal Sharing and Disclosure
6. External Sharing and Disclosure
7. Notice and Consent
8. Access, Redress, and Correction
9. Technical Access and Security
10. Data Retention and Disposal
11. Privacy Risk Assessment
12. Privacy Act Applicability
13. Certification

---

## 1. System Identification and Overview

### 1.1 System Identification

| Attribute | Value |
|---|---|
| **System Name** | CyberTabletop |
| **System Unique Identifier** | CTT-2026-001 |
| **System Owner** | [System Owner Name], [Organization] |
| **ISSO** | [ISSO Name], [Organization] |
| **System Type** | Major Application |
| **Operational Status** | Operational |
| **Assessment Date** | March 15, 2026 |
| **Next Review Date** | March 15, 2028 |

### 1.2 System Overview

CyberTabletop (CTT) is a web-based platform for conducting gamified cybersecurity incident response tabletop exercises. The system enables organizations to run simulated incident response scenarios in a digital environment, providing scoring, real-time collaboration, and after-action reporting capabilities.

CTT is specifically designed to collect only the minimum personal information necessary to provide its training services. The system does not collect Social Security Numbers, financial information, health information, government-issued identification numbers, or any other sensitive categories of personally identifiable information (PII). The only personal data collected is:

- **Email address:** used as a unique account identifier and for system notifications
- **Display name:** a user-selected name that may or may not be the user's real name, used to identify participants in exercise sessions

This minimal data collection posture reflects a deliberate privacy-by-design approach. The system's core function — facilitating training exercises — does not require extensive personal data, and therefore none is collected.

---

## 2. Legal Authority and Purpose

### 2.1 Legal Authority

The authority to collect and maintain the information described in this PIA is provided by:

- **E-Government Act of 2002 (Pub. L. 107-347):** Requires agencies to conduct PIAs for electronic information systems that collect information about individuals.
- **Federal Information Security Modernization Act (FISMA), 44 U.S.C. § 3551 et seq.:** Requires security and privacy protections for federal information systems.
- **OMB Circular A-130, Managing Information as a Strategic Resource:** Establishes policies for managing federal information resources including privacy requirements.
- **[Organizational Authorizing Statute or Regulation]:** [Insert organization-specific legal authority for operating training and workforce development systems.]

### 2.2 Purpose of the System

The purpose of CyberTabletop is to improve organizational cybersecurity readiness through gamified tabletop exercise training. The system serves the following specific purposes:

1. **Training Facilitation:** Providing a platform for security awareness and incident response training exercises.
2. **Performance Assessment:** Tracking participant decisions during exercises to generate after-action reports for improvement planning.
3. **Account Management:** Maintaining user accounts necessary to authenticate users and associate exercise data with individual participants.
4. **Audit and Accountability:** Maintaining logs of system activities to support security monitoring and incident investigation.

### 2.3 Necessity of Personal Data

The personal data collected by CTT is the minimum necessary to achieve the stated purposes:

- **Email address** is necessary to: (a) provide a unique, verifiable account identifier; (b) send account verification and password reset communications; and (c) notify users of scheduled exercise sessions.
- **Display name** is necessary to: (a) identify participants in multi-user exercise sessions for facilitator and participant awareness; and (b) attribute exercise decisions and scores to specific participants in after-action reports.

No additional personal information is required to achieve these purposes, and none is collected.

---

## 3. Characterization of the Information

### 3.1 Data Elements Collected

| Data Element | Required/Optional | Source | Purpose | Sensitivity |
|---|---|---|---|---|
| Email address | Required | User self-provided | Account identifier, notifications | Low |
| Display name | Required | User self-provided | Session identification, reporting | Low |
| Hashed password | Required (local auth only) | System-generated hash of user input | Authentication | Technical credential |
| OIDC Subject Identifier (sub) | System-generated (SSO users) | Enterprise IdP | OIDC account linkage | Low |
| Account creation timestamp | System-generated | System | Account management | Low |
| Last login timestamp | System-generated | System | Account management, security monitoring | Low |
| Source IP address (in audit logs) | System-generated | System | Security audit logging | Low |
| Exercise participation records | System-generated | System | Training records, reporting | Low |
| Exercise decision/score records | System-generated from user input | System | Training assessment, after-action reports | Low |
| Session access tokens (JWT) | System-generated | System | Authentication/session management | Technical credential |

### 3.2 Data NOT Collected

CTT explicitly does not collect the following categories of information:

- Social Security Numbers or other government-issued identification numbers
- Financial information (bank accounts, credit card numbers, tax IDs)
- Health or medical information
- Biometric data
- Precise geolocation data
- Age, date of birth, or other demographic data beyond the above
- Race, ethnicity, religion, or other protected class data
- Personal telephone numbers
- Home or personal addresses
- Information about minor children
- Information from third-party social media platforms

### 3.3 Nature of Information

The information collected by CTT is considered **non-sensitive PII** of minimal risk. Email addresses, while constituting PII, are professional contact information and are not inherently sensitive. Display names may or may not be real names; users are not required to use their legal names. Exercise participation records document training activity, not real operational decisions.

The low sensitivity of the collected information is consistent with the system's FIPS 199 Confidentiality rating of MODERATE, which is driven primarily by the aggregation potential of user account data and audit logs rather than the sensitivity of any individual data element.

### 3.4 Information Sources

All personal information in CTT is provided directly by the user at account creation (self-reported email and display name) or generated by the system as a result of user activity (timestamps, exercise records, audit logs). CTT does not obtain personal information from third-party data brokers, other agency systems, or commercial data sources.

For users authenticating via OIDC/SSO, the identity provider supplies only the minimum necessary identity claims: a unique subject identifier (sub), email address, and display name. CTT does not request or receive additional claims from the identity provider.

### 3.5 Information Accuracy

CTT does not independently verify the accuracy of user-provided display names. Email addresses are verified through an account confirmation email at registration to ensure the user has access to the provided address. Users may update their display name and email address at any time through their account settings, subject to re-verification of a new email address.

---

## 4. Uses of the Information

### 4.1 Primary Uses

The information collected by CTT is used exclusively for the following primary purposes directly related to the system's function:

**Authentication and Account Management:** Email addresses and hashed passwords (or OIDC subject identifiers) are used to authenticate users and manage account access. This use is essential to the operation of any multi-user application and represents the primary use of personal data in CTT.

**Exercise Participation Identification:** Display names are used within active exercise sessions to identify participants to facilitators and other participants. This use is inherent to the collaborative nature of multi-participant tabletop exercises.

**After-Action Reporting:** Display names and exercise decision records are used to generate after-action reports that attribute specific decisions and scores to individual participants. These reports are used by facilitators and organizational management for training assessment and planning purposes.

**System Notifications:** Email addresses are used to send transactional system notifications including: account creation confirmation, password reset links, exercise session invitations, and (optionally) after-action report delivery.

**Security Audit Logging:** User identifiers (account IDs, not directly displayed email addresses), source IP addresses, and action descriptions are recorded in audit logs to support security monitoring, incident investigation, and compliance requirements.

### 4.2 Secondary Uses

No secondary uses of personal information are made beyond those described in Section 4.1. CTT does not use personal information for:

- Marketing or commercial purposes
- Profiling or behavioral analysis beyond exercise performance
- Research unrelated to the training function
- Sharing with data analytics services
- Cross-system linking with other applications

### 4.3 Internal Use Restrictions

Access to personal information within CTT is restricted by role:

- **Administrators** can view all user account data (email, display name, role, status) and full audit logs. Access is limited to personnel with a demonstrated need for this access and is logged.
- **Facilitators** can view the display names and exercise performance data of participants in their assigned sessions. Facilitators cannot view the email addresses or account management data of participants.
- **Participants** can view only their own account data and their own exercise performance records.
- **Players** can view exercise content for sessions they join. CyberTabletop does not currently implement a separate Observer role.

---

## 5. Internal Sharing and Disclosure

### 5.1 Internal Sharing

Personal information in CTT may be shared internally within the deploying organization as follows:

- **Exercise after-action reports** may be shared within the organization's management structure for training assessment, workforce development, and compliance reporting purposes.
- **Audit logs** may be shared with the organization's security operations center (SOC), CSIRT, or inspector general as required for security incident investigation or compliance audit.
- **User account data** is accessible to system administrators for account management purposes and to the ISSO for privacy compliance oversight.

### 5.2 Approved Internal Recipients

| Recipient | Data Shared | Purpose | Frequency |
|---|---|---|---|
| System Administrator | Account data, audit logs | Account management, security monitoring | As needed |
| ISSO | Account data, audit logs | Privacy and security oversight | Quarterly review |
| Facilitator | Participant display names, exercise records | Exercise facilitation and after-action reporting | During exercise sessions |
| SOC/CSIRT | Audit logs (security events only) | Incident investigation | As needed |
| Inspector General (if applicable) | Audit logs, account data | Compliance audit | As required |
| Organizational Management | After-action reports (may contain display names) | Training assessment | Post-exercise |

---

## 6. External Sharing and Disclosure

### 6.1 External Sharing

CTT is designed to minimize external disclosure of personal information. The following limited external disclosures occur or may occur:

**Cloud Provider Infrastructure (AWS/Azure):** When deployed on AWS or Azure, CTT data (including user account data) is stored on cloud provider infrastructure. Cloud provider access to this data is governed by the applicable cloud provider's FedRAMP authorization and the organization's cloud services agreement. Data is encrypted at rest and in transit. The cloud provider processes the data as a data processor under the organization's direction and does not use it for independent purposes.

**Enterprise Identity Provider (OIDC/SSO):** When users authenticate via the organization's OIDC identity provider, the identity provider receives authentication requests and provides identity assertions. The identity provider does not receive CTT application data. The identity provider's handling of identity data is governed by the organization's IDP system and its own ATO.

**Anthropic Claude API (Optional):** When the AI-assisted scenario generation feature is used, facilitators' scenario prompts are sent to the Anthropic Claude API. These prompts are reviewed before transmission to ensure they do not contain personal information. The Claude API does not receive user account data, participant information, or exercise results.

### 6.2 Routine Uses

No routine uses of CTT data are established that would require disclosure to external entities beyond those described in Section 6.1.

### 6.3 Non-Routine Disclosures

Personal information from CTT may be disclosed outside the organization in the following non-routine circumstances:

- **Law enforcement request:** Pursuant to a valid legal process (subpoena, court order) as required by law.
- **National security:** To authorized national security officials for intelligence or counterterrorism purposes as required by law.
- **Inspector General or oversight body:** For authorized audits, investigations, or oversight activities.
- **Congress:** As required pursuant to a congressional inquiry.

All non-routine disclosures are reviewed and approved by the organization's General Counsel prior to disclosure. Disclosures are documented and reported to the SAOP.

---

## 7. Notice and Consent

### 7.1 Notice Mechanisms

CTT provides notice to users about the collection and use of their personal information through the following mechanisms:

**System Registration Notice:** The registration flow collects display name, email address, password, and invite code. Organizations should provide their privacy notice alongside the deployment, identity-provider flow, or reverse-proxy landing page, including data elements collected, purposes for collection, retention periods, and how users can request correction or deletion.

**System Use Notification Banner:** CyberTabletop does not currently include a configurable pre-login use banner. Organizations requiring explicit monitoring/no-expectation-of-privacy notice should add that notice at the identity provider, public reverse proxy, or surrounding access portal.

**Privacy Policy:** A deployment-specific privacy policy should be provided by the operating organization. CyberTabletop's bundled documentation describes the application data flows and can be used as source material for that policy.

### 7.2 Consent

CTT collects personal information with the informed consent of users, expressed through:

- Completion of account registration in an environment where the operating organization has provided the required privacy and acceptable-use notice.
- Acceptance of the system's terms of use and privacy policy.

For users enrolled in exercises by a facilitator or administrator (without self-registration), the organization is responsible for ensuring those users have been informed of data collection practices through organizational notices, training acknowledgments, or similar mechanisms.

### 7.3 Opportunity to Decline

Users may decline to provide personal information to CTT by not creating an account or by requesting that their account be deleted. However, participation in CTT's training exercises requires an account, and therefore users who decline data collection cannot participate in CTT-hosted exercises.

---

## 8. Access, Redress, and Correction

### 8.1 User Access to Own Data

CTT users can access their own personal information through the account settings page, which displays: email address, display name, account creation date, and last login timestamp. Users can export their exercise participation history and after-action reports from the account dashboard.

### 8.2 Correction

Users may correct their display name and email address at any time through the account settings page. Email address changes require re-verification. Display name changes take effect immediately in future exercise sessions; historical records retain the display name that was in use at the time of the exercise.

### 8.3 Deletion

Users may request deletion of their CTT account by contacting the system administrator. Upon account deletion, the following actions are taken:
- The account record is deleted or permanently anonymized.
- Display name in historical exercise records is replaced with a pseudonym (e.g., "Deleted User").
- Email address is permanently removed from all tables.
- Audit log entries referencing the user's account ID are retained for the required retention period but the user's email and display name are not retained in log records (account IDs are used instead).

Account deletion requests are processed within 30 business days. If the deletion request would impair an active legal hold, security investigation, or regulatory compliance requirement, the deletion may be deferred until the hold is released, and the user is notified of the deferral.

### 8.4 Privacy Act Requests

For users who are U.S. citizens or lawful permanent residents and whose records are covered by a Privacy Act System of Records Notice (SORN), Privacy Act requests for access, correction, and amendment are handled by the organization's Privacy Act coordinator per established organizational procedures.

---

## 9. Technical Access and Security

### 9.1 Technical Access Controls

Access to personal information in CTT is protected by the technical controls documented in the SSP, including:

- Role-based access control ensuring users can access only their own data and that Administrators, Facilitators, and other roles have access only to the minimum data necessary for their functions.
- Authentication requirements (password or SSO) for all access to CTT application functionality, with TOTP MFA enforced for privileged local roles.
- TLS 1.2+ encryption for all data in transit.
- Deployment-managed encryption for database and volume data at rest; TOTP MFA secrets are encrypted by the application with `MFA_ENCRYPTION_KEY`.
- Session management controls including short-lived access tokens, server-side hashed refresh tokens, and refresh-token rotation.
- Audit logging of all access to personal information by administrators and privileged users.

### 9.2 Data Minimization in Technical Implementation

The CTT application is implemented with the following data minimization design features:

- **No unnecessary PII in URLs:** User identifiers in URLs use opaque UUIDs, not email addresses or names.
- **No PII in log messages:** Audit log messages use account IDs, not email addresses. IP addresses in logs are treated as potentially sensitive and are retained only as long as required.
- **No PII in error messages:** Application error messages do not expose user data.
- **No PII in AI API calls:** The scenario generation feature is implemented to prevent user PII from being included in prompts sent to the Claude API.
- **JWT contents limited:** Access tokens contain only authentication/session claims needed by the application, such as account ID, email, display name, role, org ID, and MFA state. Tokens are stored in httpOnly cookies.

### 9.3 Privacy Incidents

Privacy incidents (actual or suspected unauthorized disclosure of personal information) are handled under the CTT Incident Response Plan. Privacy incidents are reported to the SAOP and, where required, to affected individuals and oversight bodies within required timeframes.

---

## 10. Data Retention and Disposal

### 10.1 Retention Schedule

| Data Category | Retention Period | Basis | Disposal Method |
|---|---|---|---|
| Active user account records | Duration of employment/enrollment + 3 years | Operational need, NARA GRS | Secure deletion from database |
| Exercise session records | 3 years from exercise date | NARA GRS 5.2 (Training Records) | Secure deletion or anonymization |
| After-action reports | 3 years from report generation | NARA GRS 5.2 | Secure deletion |
| Audit logs (security events) | 3 years, then archive for 2 additional years | NARA GRS 3.2 (IT Security Records) | Secure deletion after archive |
| Deleted account records | Immediately anonymized; pseudonymous records retained per above | Privacy protection | PII removed at deletion; record retained in anonymized form |

### 10.2 Disposal Procedures

Personal information that has exceeded its retention period is disposed of through the following procedures:

- **Database records:** Permanently deleted using SQL DELETE statements. Database vacuuming or compaction is performed to ensure data is not retained in database storage files.
- **Backup media:** Backup archives containing expired personal data are overwritten or physically destroyed following NIST SP 800-88 guidelines.
- **Cloud storage:** Deletion via cloud provider secure delete API. Cloud provider data destruction certificates are obtained where available.
- **Log archives:** Archives containing expired personal data are securely deleted from cold storage.

Disposal activities are documented with: date of disposal, type of data disposed, disposal method, and name of the individual who authorized and performed the disposal. Disposal records are retained for 3 years.

### 10.3 Legal Holds

In the event of litigation, investigation, or other legal hold, disposal of relevant data is suspended pending resolution of the hold. Legal hold notices are issued by the organization's General Counsel. The ISSO and System Administrator are notified of holds affecting CTT data.

---

## 11. Privacy Risk Assessment

### 11.1 Privacy Risk Framework

Privacy risks are assessed using the NIST Privacy Framework and OMB Circular A-130 requirements. Risks are rated based on likelihood and impact to individual privacy interests.

**Risk Rating Scale:**
- **High:** Likely to occur; significant adverse impact on individual privacy interests
- **Medium:** May occur; moderate adverse impact
- **Low:** Unlikely to occur; limited adverse impact

### 11.2 Privacy Risk Register

#### PRISK-001 — Unauthorized Access to User Account Data
**Risk:** An attacker or unauthorized insider accesses user account data including email addresses and exercise performance records.
**Likelihood:** Medium (due to general web application threat landscape)
**Impact:** Low (data is limited to email and display name; no financial or highly sensitive PII)
**Residual Risk:** Low
**Mitigations:**
- Role-based access control limiting data access to authorized roles
- Authentication requirements and TOTP MFA for privileged accounts
- TLS encryption for all data in transit
- Deployment-managed database encryption at rest, with application-level encryption for TOTP MFA secrets
- Audit logging of all administrative data access
- Regular vulnerability scanning and patching

---

#### PRISK-002 — Data Breach via SQL Injection or Application Vulnerability
**Risk:** An attacker exploits an application vulnerability to extract user data from the database.
**Likelihood:** Low (parameterized queries and input validation reduce attack surface)
**Impact:** Low (no highly sensitive PII in the database)
**Residual Risk:** Low
**Mitigations:**
- Parameterized queries via Prisma ORM preventing SQL injection
- Input validation on API endpoints via Zod schemas and route-level guards
- Regular vulnerability scanning and penetration testing (planned)
- Edge protection through Nginx rate limiting and Content Security Policy; deploy a dedicated WAF at the public edge if required by policy
- Principle of least privilege for database user permissions

---

#### PRISK-003 — Excessive Data Collection Beyond Stated Purpose
**Risk:** Application changes or feature additions inadvertently begin collecting more personal information than described in this PIA.
**Likelihood:** Low (privacy-by-design practices and change control process)
**Impact:** Medium (could undermine privacy notice accuracy)
**Residual Risk:** Low
**Mitigations:**
- Privacy review required as part of the change control process for any feature additions
- Annual PIA review to identify any changes in data collection
- Code review process includes privacy-sensitive function review
- Data minimization principle enforced in architecture decisions

---

#### PRISK-004 — Improper Sharing of Exercise Records
**Risk:** Exercise performance records (which may reflect individual professional capability) are shared beyond their authorized purposes or with inappropriate parties.
**Likelihood:** Low (access controls restrict access to authorized roles)
**Impact:** Medium (could affect individual's professional reputation if widely disclosed)
**Residual Risk:** Low
**Mitigations:**
- Role-based access controls limiting exercise data access
- Training for facilitators on appropriate use and sharing of after-action reports
- Policy prohibiting sharing of individual performance data without participant consent
- Access logging for after-action report generation and download

---

#### PRISK-005 — PII Leakage to External AI API
**Risk:** The optional AI-assisted scenario generation feature inadvertently transmits user PII to the Anthropic Claude API.
**Likelihood:** Low (technical controls prevent PII in API calls)
**Impact:** Medium (external disclosure of PII to commercial service)
**Residual Risk:** Low
**Mitigations:**
- Technical implementation prevents user data from being included in scenario generation prompts
- Facilitator guidance documents specifying what information may be included in AI prompts
- The Claude API is called only by facilitators for scenario content generation, not during exercise sessions
- No participant data, exercise records, or user account data is sent to the Claude API

---

#### PRISK-006 — Retention of PII Beyond Required Period
**Risk:** User data and exercise records are retained longer than the defined retention periods due to administrative oversight or technical failure.
**Likelihood:** Medium (manual disposal processes without automated enforcement)
**Impact:** Low (data is low-sensitivity; extended retention is not a high-impact privacy risk)
**Residual Risk:** Low
**Mitigations:**
- Documented retention schedule with designated responsible official
- Annual review of data holdings against retention schedule by the ISSO
- Planned implementation of automated data lifecycle management
- System administrator procedures for periodic data purging

---

### 11.3 Overall Privacy Risk Rating

**Overall Privacy Risk: LOW**

The overall privacy risk for CyberTabletop is assessed as Low. This rating reflects: (a) the minimal nature of personal data collected (email and display name only); (b) the absence of sensitive PII categories; (c) the internal-facing, non-public nature of the system; (d) the strong technical controls protecting data; and (e) the alignment between the data collected and the system's stated training purpose.

---

## 12. Privacy Act Applicability

### 12.1 Privacy Act Analysis

The Privacy Act of 1974, 5 U.S.C. § 552a, applies to records about individuals that are "retrieved by the name of the individual or by some identifying number, symbol, or other identifying particular assigned to the individual."

CTT user account records are retrieved by email address (an identifying particular) and are therefore covered by the Privacy Act. The deploying organization must assess whether a System of Records Notice (SORN) is required for CTT.

### 12.2 System of Records Determination

**Does CTT maintain a System of Records?**

CTT maintains records about individuals (user accounts) that are retrieved by an identifier (email address). Therefore, CTT **constitutes a System of Records** for purposes of the Privacy Act.

**Required Actions:**
- The organization must publish or identify a System of Records Notice (SORN) covering CTT user account records.
- If an existing SORN covers workforce training and management records, CTT records may fall within that existing SORN's coverage.
- If no existing SORN covers CTT's records, a new SORN must be published in the Federal Register before the system becomes operational.

### 12.3 Privacy Act Safeguards

CTT implements the following Privacy Act safeguards:

- **Accuracy:** Users may review and correct their own personal information (see Section 8.2).
- **Access:** Users may access records about themselves through the application interface (see Section 8.1).
- **Amendment:** Users may request amendment of records (see Section 8.2).
- **Disclosure Accounting:** Disclosures of records to third parties are documented as required by the Privacy Act.
- **Notice:** System use notice and privacy policy provide notice of data collection and use.
- **Security:** Technical security controls described in the SSP protect records from unauthorized access.

### 12.4 Applicable SORN

| Field | Value |
|---|---|
| **SORN Number** | [To be determined or existing SORN reference] |
| **SORN Title** | [Training and Workforce Development Records] or [New SORN title] |
| **Federal Register Citation** | [To be published or existing citation] |
| **Coverage Determination** | Existing SORN: [Yes/No] | New SORN Required: [Yes/No] |

---

## 13. Certification

I certify that the information contained in this Privacy Impact Assessment is accurate and that the CyberTabletop system has been designed and implemented in accordance with the privacy principles and requirements described herein.

---

**ISSO Certification**

I certify that this PIA accurately reflects the privacy posture of the CyberTabletop system.

Name: ___________________________________

Title: Information System Security Officer

Signature: ___________________________________

Date: ___________________________________

---

**System Owner Certification**

I certify that the CyberTabletop system collects only the minimum personal information necessary for its stated purposes and that appropriate safeguards are in place.

Name: ___________________________________

Title: System Owner

Signature: ___________________________________

Date: ___________________________________

---

**Senior Agency Official for Privacy (SAOP) Review**

Name: ___________________________________

Title: Senior Agency Official for Privacy

Review Outcome: [ ] Approved [ ] Approved with Conditions [ ] Not Approved

Conditions (if applicable): ___________________________________

Signature: ___________________________________

Date: ___________________________________

---

*Document Version 1.0 | Date: March 15, 2026*
*Next Review Date: March 15, 2028*
*Classification: Unclassified // For Official Use Only*
