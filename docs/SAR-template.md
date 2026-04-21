# Security Assessment Report (SAR) — Template
## CyberTabletop — Gamified Cybersecurity Incident Response Tabletop Exercise Platform

---

| Field | Value |
|---|---|
| **Document Title** | Security Assessment Report |
| **System Name** | CyberTabletop |
| **System Abbreviation** | CTT |
| **Version** | [X.X] |
| **Date** | [Assessment Completion Date] |
| **Assessment Period** | [Start Date] through [End Date] |
| **Assessment Type** | [Initial / Annual / Significant Change] |
| **Assessment Lead** | [Lead Assessor Name], [Organization] |
| **ISSO** | [ISSO Name], [Organization] |
| **Distribution** | System Owner, ISSO, Authorizing Official |

---

**INSTRUCTIONS TO ASSESSORS:** This template provides the structure for completing the Security Assessment Report for CyberTabletop. Replace all bracketed placeholder text with actual content. Do not delete section headers. Retain all tables and add rows as needed. The completed SAR must be reviewed by the ISSO for factual accuracy before finalization.

---

## Table of Contents

1. Executive Summary
2. System Overview
3. Assessment Overview
4. Risk Rating Methodology
5. Summary of Findings
6. Detailed Findings
7. Remediation Tracking
8. Assessor Certification
9. ISSO Response and Certification
10. Appendices

---

## 1. Executive Summary

### 1.1 Assessment Purpose

[Describe the purpose of this assessment, e.g., "This Security Assessment Report documents the results of the initial security control assessment conducted for CyberTabletop (CTT) in support of the system's Authorization to Operate (ATO) determination. The assessment was conducted in accordance with the Security Assessment Plan (SAP) dated [date] and NIST SP 800-53A Revision 5."]

### 1.2 Overall Security Posture

[Provide a 2-3 paragraph narrative assessment of the overall security posture of CyberTabletop. Address: the system's general security health, the most significant strengths observed, the most significant weaknesses identified, and the overall risk level. Example:]

> The CyberTabletop system demonstrates [strong / adequate / insufficient] security controls implementation overall. [X] of [Y] assessed controls were found to be fully implemented and operating as intended. The system's [strength areas, e.g., "TLS configuration and input validation controls were found to be robust"]. The most significant concerns identified are [brief summary of major findings].
>
> [Describe the residual risk posture.] The aggregate residual risk to the organization from identified weaknesses is assessed as [Critical / High / Moderate / Low].

### 1.3 Findings Summary

| Severity | Count | Controls Affected |
|---|---|---|
| Critical | [#] | [List control IDs] |
| High | [#] | [List control IDs] |
| Medium | [#] | [List control IDs] |
| Low | [#] | [List control IDs] |
| Informational | [#] | [List control IDs] |
| **Total** | **[#]** | |

**Controls Fully Satisfied:** [#] of [#] assessed controls

**Controls with Weaknesses:** [#] of [#] assessed controls

**Controls Not Assessed (Inherited/NA):** [#] of [#] total controls

### 1.4 Authorization Recommendation

**Assessment Team Recommendation:** [ ] ATO Recommended   [ ] ATO Recommended with Conditions   [ ] ATO Not Recommended

**Basis for Recommendation:**

[Provide 1-2 paragraph justification for the recommendation. For "ATO with Conditions," specify the conditions that must be met within what timeframe. For "ATO Not Recommended," describe the specific findings that create unacceptable risk.]

**Recommended Conditions (if applicable):**

1. [Condition 1, e.g., "Restore testing must be completed and documented before production operation."]
2. [Condition 2]
3. [Condition 3]

---

## 2. System Overview

### 2.1 System Description

[Brief 1-2 paragraph description of CyberTabletop. May be drawn from SSP Section 3.]

### 2.2 System Categorization

| Security Objective | Impact Level |
|---|---|
| Confidentiality | MODERATE |
| Integrity | MODERATE |
| Availability | LOW |
| **Overall** | **MODERATE** |

### 2.3 Authorization Boundary

[Brief description of what is within and outside the authorization boundary. Reference boundary-diagram.md.]

### 2.4 Key Technologies

| Component | Technology | Version |
|---|---|---|
| Frontend | React.js | 18.x |
| Backend | Node.js / Express | 20.x LTS |
| Database | PostgreSQL | 16.x |
| Real-Time | Socket.io | 4.x |
| Proxy | Nginx | 1.24.x |
| Containers | Docker | 24.x |

---

## 3. Assessment Overview

### 3.1 Assessment Scope

[Describe what was assessed, including components, controls, and any limitations on scope.]

### 3.2 Assessment Methods Used

| Method | Controls Assessed |
|---|---|
| Examine (Documentation Review) | [List or summarize] |
| Interview | [List or summarize] |
| Test | [List or summarize] |

### 3.3 Assessment Limitations

[Document any limitations on the assessment, such as: access restrictions, time constraints, unavailable documentation, environments not tested, etc.]

> Example: "The assessment team did not have access to the cloud deployment environment (AWS configuration). Assessment of cloud-specific controls (SC-28 encryption at rest, PE-inherited controls) was conducted through documentation review and interview only. Independent technical verification of cloud configuration was not performed."

### 3.4 Assessment Team

| Role | Name | Organization |
|---|---|---|
| Assessment Lead | [Name] | [Organization] |
| Application Security Assessor | [Name] | [Organization] |
| Infrastructure Assessor | [Name] | [Organization] |
| Documentation Reviewer | [Name] | [Organization] |

---

## 4. Risk Rating Methodology

### 4.1 Finding Severity Ratings

Findings are rated using the following severity scale:

| Severity | CVSS Score Range (if applicable) | Definition | Remediation Timeframe |
|---|---|---|---|
| **Critical** | 9.0 – 10.0 | Immediate, severe threat to CIA; exploitation likely; significant adverse impact | 7 days |
| **High** | 7.0 – 8.9 | Significant control weakness; exploitation feasible; serious adverse impact | 30 days |
| **Medium** | 4.0 – 6.9 | Meaningful risk; not immediately threatening core security objectives | 90 days |
| **Low** | 0.1 – 3.9 | Minor gap or best-practice improvement; limited risk | Next maintenance window |
| **Informational** | N/A | Observation without direct security impact | As appropriate |

### 4.2 Risk Determination Matrix

The likelihood and impact of each finding are evaluated independently before determining overall severity:

| | **Low Impact** | **Moderate Impact** | **High Impact** |
|---|---|---|---|
| **High Likelihood** | Medium | High | Critical |
| **Medium Likelihood** | Low | Medium | High |
| **Low Likelihood** | Informational | Low | Medium |

**Likelihood Factors:**
- Threat source capability and motivation
- Ease of exploitation (tool availability, skill required)
- Existing threat intelligence
- Current controls reducing likelihood

**Impact Factors:**
- Data sensitivity (FIPS 199 categorization)
- Number of users/records affected
- Mission impact
- Recovery effort

### 4.3 Residual Risk

Residual risk reflects the risk remaining after accounting for compensating or mitigating controls already in place. All severity ratings in this report reflect residual risk after considering existing mitigating factors.

---

## 5. Summary of Findings

### 5.1 Findings Table

Complete the following table with all findings identified during the assessment. Add rows as needed.

| Finding ID | Control(s) | Severity | Finding Title | Status |
|---|---|---|---|---|
| CTT-FIND-001 | [e.g., IA-2(1)] | [Critical/High/Medium/Low/Info] | [Brief title] | [Open/Closed/Risk Accepted] |
| CTT-FIND-002 | [Control ID] | [Severity] | [Brief title] | [Status] |
| CTT-FIND-003 | [Control ID] | [Severity] | [Brief title] | [Status] |
| CTT-FIND-004 | [Control ID] | [Severity] | [Brief title] | [Status] |
| CTT-FIND-005 | [Control ID] | [Severity] | [Brief title] | [Status] |
| CTT-FIND-006 | [Control ID] | [Severity] | [Brief title] | [Status] |
| CTT-FIND-007 | [Control ID] | [Severity] | [Brief title] | [Status] |
| CTT-FIND-008 | [Control ID] | [Severity] | [Brief title] | [Status] |
| [Add rows as needed] | | | | |

### 5.2 Controls with Findings Summary

| Control ID | Control Name | Finding(s) | Disposition |
|---|---|---|---|
| [AC-X] | [Control Name] | [Finding ID(s)] | [Partially Satisfied / Not Satisfied] |
| [IA-X] | [Control Name] | [Finding ID(s)] | [Partially Satisfied / Not Satisfied] |
| [SI-X] | [Control Name] | [Finding ID(s)] | [Partially Satisfied / Not Satisfied] |
| [Add rows as needed] | | | |

### 5.3 Controls with No Findings

| Control ID | Control Name | Disposition |
|---|---|---|
| [AC-X] | [Control Name] | Satisfied |
| [AU-X] | [Control Name] | Satisfied |
| [IA-X] | [Control Name] | Satisfied |
| [Add rows as needed] | | |

---

## 6. Detailed Findings

Instructions: Complete one section per finding. Copy the template block below for each additional finding.

---

### Finding CTT-FIND-001

**Finding Title:** [Descriptive title, e.g., "Backup Restore Testing Not Completed"]

**Control Reference:** [e.g., CP-9 — System Backup]

**Severity:** [Critical / High / Medium / Low / Informational]

**Assessment Method:** [Examine / Interview / Test — specify which was primary]

**Description:**

[Provide a detailed description of the finding. Include: what the control requires, what was observed during the assessment, how the observation differs from the requirement, and why this constitutes a security risk. Be specific about what was tested, reviewed, or observed. Example:]

> During technical testing (CTT-TT-010), the assessment team confirmed that backup creation scripts are present and can create a PostgreSQL dump, but no completed restore drill evidence was provided for the target deployment environment.
>
> NIST SP 800-53 Rev 5 control CP-9 requires system backup capability, and CP-10 requires recovery capability. Backups are not a complete control until a restore has been tested in a clean environment.

**Evidence:**

[Describe the specific evidence observed. Do not include actual credentials or sensitive configuration data. Include sanitized screenshots or log excerpts as appendices. Example:]

> - Script review: `scripts/backup.sh`, `scripts/backup.ps1`, `scripts/restore.sh`, and `scripts/restore.ps1`
> - Test evidence: backup creation completed
> - Missing evidence: restore into clean stack not yet documented

**Risk:**

[Describe the specific risk posed by this finding.]

> If backups cannot be restored reliably, a database loss or failed upgrade could result in extended outage or loss of exercise, scenario, user, and audit data.

**Recommendation:**

[Provide specific, actionable remediation guidance.]

> 1. Restore a recent CyberTabletop backup into a clean Docker stack.
> 2. Confirm the backend starts, Prisma migrations report no pending failures, and core login/session workflows operate against the restored database.
> 3. Record restore duration, operator steps, issues, and corrective actions.
> 4. Repeat restore testing on a recurring schedule.

**ISSO Response:**

[ISSO completes this section during factual accuracy review.]

> [Concur / Non-Concur / Partial Concur]
>
> [ISSO narrative response: Accept the finding as described, provide factual corrections if any, describe planned remediation, and provide target completion date.]

**Planned Remediation Date:** [Date]

**POA&M Reference:** [POAM-001 or "New — Add to POA&M"]

**Status:** [ ] Open   [ ] Closed   [ ] Risk Accepted

---

### Finding CTT-FIND-002

**Finding Title:** [Title]

**Control Reference:** [Control ID and name]

**Severity:** [Severity]

**Assessment Method:** [Method]

**Description:**

[Description]

**Evidence:**

[Evidence]

**Risk:**

[Risk description]

**Recommendation:**

[Recommendation]

**ISSO Response:**

[ISSO response]

**Planned Remediation Date:** [Date]

**POA&M Reference:** [Reference or "New"]

**Status:** [ ] Open   [ ] Closed   [ ] Risk Accepted

---

### Finding CTT-FIND-003

**Finding Title:** [Title]

**Control Reference:** [Control ID and name]

**Severity:** [Severity]

**Assessment Method:** [Method]

**Description:**

[Description]

**Evidence:**

[Evidence]

**Risk:**

[Risk description]

**Recommendation:**

[Recommendation]

**ISSO Response:**

[ISSO response]

**Planned Remediation Date:** [Date]

**POA&M Reference:** [Reference or "New"]

**Status:** [ ] Open   [ ] Closed   [ ] Risk Accepted

---

*[Add additional finding sections as required. Each finding should follow the format above.]*

---

## 7. Remediation Tracking

### 7.1 Open Findings Requiring POA&M Entry

The following findings were identified during this assessment and require entries in the CyberTabletop Plan of Action and Milestones (POA&M):

| Finding ID | Severity | POA&M ID | Target Completion | Owner |
|---|---|---|---|---|
| CTT-FIND-001 | [Severity] | [POAM-XXX] | [Date] | [Role] |
| CTT-FIND-002 | [Severity] | [POAM-XXX] | [Date] | [Role] |
| [Add rows as needed] | | | | |

### 7.2 Findings Closed During Assessment

The following findings were identified and remediated during the assessment period and do not require POA&M entries:

| Finding ID | Original Severity | Remediation Applied | Verification Date | Assessor |
|---|---|---|---|---|
| [CTT-FIND-XXX] | [Severity] | [Description of fix] | [Date] | [Assessor name] |
| [Add rows as needed] | | | | |

### 7.3 Risk Accepted Findings

The following findings are documented as risk accepted by the Authorizing Official:

| Finding ID | Severity | Risk Acceptance Rationale | AO Signature/Date |
|---|---|---|---|
| [CTT-FIND-XXX] | [Severity] | [Rationale] | [AO signature and date] |
| [Add rows as needed] | | | |

---

## 8. Assessor Certification

The undersigned Assessment Team Lead certifies that this Security Assessment Report accurately reflects the findings of the security control assessment conducted for CyberTabletop during the assessment period [start date] through [end date]. The assessment was conducted in accordance with the Security Assessment Plan and NIST SP 800-53A Revision 5.

**Assessment Team Lead**

Name: ___________________________________

Organization: ___________________________________

Signature: ___________________________________

Date: ___________________________________

---

## 9. ISSO Response and Certification

The undersigned ISSO certifies that this Security Assessment Report has been reviewed for factual accuracy. All factual corrections have been provided to the assessment team. ISSO concurrences, non-concurrences, and planned remediation dates are documented in the individual finding responses (Section 6).

**ISSO**

Name: ___________________________________

Organization: ___________________________________

Signature: ___________________________________

Date: ___________________________________

**System Owner Acknowledgment**

The System Owner acknowledges receipt of this Security Assessment Report and agrees to pursue remediation of identified findings in accordance with the POA&M.

Name: ___________________________________

Title: ___________________________________

Signature: ___________________________________

Date: ___________________________________

---

## 10. Appendices

### Appendix A — Evidence Screenshots

[Assessors attach sanitized screenshots, configuration excerpts, and other evidence supporting findings here. Each piece of evidence should be labeled with the finding ID it supports.]

### Appendix B — Tool Output

[Attach sanitized output from automated scanning tools (Trivy, npm audit, SSL Labs, etc.) used during the assessment.]

### Appendix C — Interview Notes

[Attach interview notes (summarized, not verbatim) for each interview conducted per the SAP interview procedures.]

### Appendix D — Configuration Review Worksheets

[Attach completed configuration review worksheets comparing observed configurations against security baselines.]

### Appendix E — Test Execution Records

[Attach records of technical tests performed, including test IDs from the SAP, dates performed, tools used, and outcomes.]

---

*This document is designated Controlled Unclassified Information (CUI) // For Official Use Only.*
*Document Version [X.X] | Date: [Assessment Completion Date]*
*Assessment Period: [Start Date] — [End Date]*
