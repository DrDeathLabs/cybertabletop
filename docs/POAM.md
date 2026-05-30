# Plan of Action and Milestones (POA&M)
## CyberTabletop Platform

---

| Field | Value |
|---|---|
| **Document Title** | Plan of Action and Milestones — CyberTabletop |
| **Document ID** | POAM-CTT-001 |
| **System Identifier** | CTT-001 |
| **Version** | 1.3 |
| **Date** | May 2026 |
| **Prepared By** | [ISSO NAME] |
| **System Owner** | [SYSTEM OWNER NAME] |
| **Organization** | [ORGANIZATION] |
| **Authorizing Official** | [AUTHORIZING OFFICIAL] |
| **Review Frequency** | Monthly |
| **Next Review** | June 2026 |

---

## 1. Purpose and Overview

This Plan of Action and Milestones (POA&M) documents security weaknesses identified for the CyberTabletop information system through security assessments, vulnerability scanning, audit log review, and self-identified gaps. The POA&M is required by NIST SP 800-37 Rev. 2 (RMF Step 5 — Authorize) and the CA-5 security control.

Each entry documents:
- The weakness and its source
- The associated NIST SP 800-53 control(s)
- Planned remediation milestones with target dates
- Resources required for remediation
- Current status

The POA&M is reviewed monthly by the ISSO and System Owner, and quarterly by the Authorizing Official. Completed items are marked as Closed but retained in the POA&M for historical reference.

---

## 2. POA&M Status Summary

| Status | Count |
|---|---|
| Open — Active Remediation | 3 |
| Open — Planning | 5 |
| Closed — Completed | 2 |
| **Total Items** | **10** |

| Priority | Count |
|---|---|
| Priority 1 (Critical/High) | 2 |
| Priority 2 (Moderate) | 4 |
| Priority 3 (Low) | 4 |

---

## 3. POA&M Items

---

### POAM-001: Privileged MFA Enforcement Completed

| Field | Value |
|---|---|
| **Item ID** | POAM-001 |
| **Priority** | Priority 1 — High |
| **Finding Source** | Self-Identified / SAR FINDING-001 |
| **Weakness Description** | Historical finding: local TOTP MFA was not enforced for all privileged roles. The current implementation requires TOTP MFA for `SUPER_ADMIN`, `ORG_ADMIN`, and `FACILITATOR` accounts before protected application access. Players may enable MFA from Profile, but it is not mandatory. |
| **Associated Control(s)** | IA-2(1) — MFA to Privileged Accounts; IA-2(2) — MFA to Non-Privileged Accounts |
| **Severity** | Moderate |
| **Date Identified** | January 2026 |
| **Scheduled Completion** | April 21, 2026 |
| **Responsible Individual** | [SYSADMIN NAME] / Development Team Lead |
| **Current Status** | Closed — Completed for privileged accounts. Optional/player MFA mandate remains an operator policy decision. |

**Milestones:**

| Milestone | Target Date | Status |
|---|---|---|
| 1. Identify privileged roles requiring MFA enforcement | April 21, 2026 | Complete |
| 2. Implement TOTP setup and login challenge flow | April 21, 2026 | Complete |
| 3. Encrypt TOTP secrets with `MFA_ENCRYPTION_KEY` | April 21, 2026 | Complete |
| 4. Store recovery codes as bcrypt hashes and show plaintext codes once | April 21, 2026 | Complete |
| 5. Force privileged users without MFA into setup before protected access | April 21, 2026 | Complete |
| 6. Add admin MFA reset for verified lockout cases | April 21, 2026 | Complete |
| 7. Add E2E coverage for privileged MFA enrollment | April 21, 2026 | Complete |

**Closure Evidence:**
- Backend MFA service and auth routes implement TOTP setup, verification, recovery code consumption, and privileged-role enforcement.
- Prisma migration adds MFA verification and recovery-code fields.
- Frontend MFA setup and challenge pages are implemented.
- Admin Users tab supports MFA reset for another user.
- Playwright E2E includes privileged MFA enrollment coverage.

**Remaining Operator Considerations:**
- Player MFA is optional. Organizations that require MFA for every account should enforce that through OIDC/SSO policy or local operating policy.
- Lost-authenticator reset must be handled through identity verification before an admin uses Reset MFA.

**Supporting Controls:**
- Account lockout after 5 failed attempts (AC-7) — reduces brute force risk
- Rate limiting on login endpoint (SC-5) — reduces credential stuffing risk
- Failed login alerting (IR-4) — enables detection of attacks
- TLS protection of all sessions (SC-8) — prevents credential interception

---

### POAM-002: Penetration Testing Not Completed

| Field | Value |
|---|---|
| **Item ID** | POAM-002 |
| **Priority** | Priority 1 — High |
| **Finding Source** | Self-Identified / SAP-CTT-001 Requirement / SAR FINDING-002 |
| **Weakness Description** | CyberTabletop has not undergone a formal web application penetration test. [ORGANIZATION] policy requires penetration testing for MODERATE categorization systems prior to or within 90 days of ATO issuance. Automated scanning and manual control testing have been conducted during the security assessment but adversarial penetration testing has not been performed. Without penetration testing, residual vulnerabilities in authentication, authorization, session management, and application logic may remain undetected. |
| **Associated Control(s)** | CA-8 — Penetration Testing |
| **Severity** | Moderate |
| **Date Identified** | February 2026 |
| **Scheduled Completion** | June 30, 2026 (Initial); annually thereafter |
| **Responsible Individual** | [ISSO NAME] |
| **Current Status** | Open — Active Remediation |

**Milestones:**

| Milestone | Target Date | Status |
|---|---|---|
| 1. Issue Request for Quote (RFQ) to approved penetration testing vendors | April 1, 2026 | In Progress |
| 2. Select penetration testing vendor and execute contract | April 30, 2026 | Not Started |
| 3. Conduct pre-test kickoff meeting; provide access per SAP-CTT-001 rules of engagement | May 15, 2026 | Not Started |
| 4. Penetration test execution (5 business days) | May 15–21, 2026 | Not Started |
| 5. Receive draft penetration test report | May 31, 2026 | Not Started |
| 6. Remediate Critical and High findings from penetration test | June 15, 2026 | Not Started |
| 7. Receive final penetration test report | June 30, 2026 | Not Started |
| 8. Add any new findings to POA&M | July 7, 2026 | Not Started |
| 9. Schedule next annual penetration test (March 2027) | June 30, 2026 | Not Started |

**Resources Required:**
- External penetration testing contract: Estimated $[COST ESTIMATE]
- ISSO / Sys Admin time for pre-test coordination and remediation support: ~40 hours
- Remediation effort: TBD pending findings

---

### POAM-003: Dependency Vulnerability Management — Automated Updates

| Field | Value |
|---|---|
| **Item ID** | POAM-003 |
| **Priority** | Priority 2 — Moderate |
| **Finding Source** | Self-Identified / RA-CTT-001 Risk RA-002 |
| **Weakness Description** | Historical finding: the repository previously lacked automated dependency update pull requests. CyberTabletop now uses Dependabot for backend, frontend, and GitHub Actions dependencies, with grouped patch/minor updates and an established PR review path for security remediation. |
| **Associated Control(s)** | SI-2 — Flaw Remediation; RA-5 — Vulnerability Monitoring and Scanning |
| **Severity** | Low |
| **Date Identified** | February 2026 |
| **Scheduled Completion** | April 30, 2026 |
| **Responsible Individual** | Development Team Lead |
| **Current Status** | Closed — Completed |

**Milestones:**

| Milestone | Target Date | Status |
|---|---|---|
| 1. Enable Dependabot for the CyberTabletop repository | April 7, 2026 | Complete |
| 2. Configure Dependabot update schedule (daily for security updates, weekly for others) | April 7, 2026 | Complete |
| 3. Establish PR review process for Dependabot-generated updates | April 15, 2026 | Complete |
| 4. Define auto-merge criteria for patch-level security updates with passing tests | April 15, 2026 | Complete |
| 5. Confirm first automated security PR merged successfully | May 30, 2026 | Complete |

**Closure Evidence:**
- `.github/dependabot.yml` configures grouped backend, frontend, and GitHub Actions updates.
- The GitHub vulnerability remediation branch supersedes stale dependency-update branches with a validated consolidated fix set.
- Backend and frontend `npm audit` are clean after the dependency remediation pass documented in `docs/RELEASE_SECURITY_REVIEW.md`.

**Resources Required:**
- Development effort: ~4 hours configuration; ~2 hours per sprint ongoing review
- GitHub/GitLab Dependabot: No additional cost (included in repository platform)

---

### POAM-004: Container Image Security Scanning — Build Pipeline Integration

| Field | Value |
|---|---|
| **Item ID** | POAM-004 |
| **Priority** | Priority 2 — Moderate |
| **Finding Source** | Self-Identified / RA-CTT-001 Risk RA-002 |
| **Weakness Description** | Container image vulnerability scanning is currently performed manually on a monthly basis as a separate step from the build pipeline. This creates a potential gap where a newly built image may be deployed before scanning is complete. Integrating container image scanning (e.g., Trivy, Grype, or Docker Scout) directly into the CI/CD pipeline as a build-time gate would ensure that images are scanned before deployment and that builds with critical/high vulnerabilities cannot be deployed without explicit override. |
| **Associated Control(s)** | SI-3 — Malicious Code Protection; CM-2 — Baseline Configuration; RA-5 — Vulnerability Monitoring |
| **Severity** | Low |
| **Date Identified** | February 2026 |
| **Scheduled Completion** | May 31, 2026 |
| **Responsible Individual** | Development Team Lead |
| **Current Status** | Open — Planning |

**Milestones:**

| Milestone | Target Date | Status |
|---|---|---|
| 1. Evaluate and select container scanning tool (Trivy recommended) | April 15, 2026 | Not Started |
| 2. Integrate scanning tool into CI/CD pipeline as post-build step | May 1, 2026 | Not Started |
| 3. Configure failure thresholds: Critical/High severity findings block deployment | May 1, 2026 | Not Started |
| 4. Test pipeline with known-vulnerable image to verify blocking behavior | May 15, 2026 | Not Started |
| 5. Document scanning gate in CM Plan | May 31, 2026 | Not Started |

**Resources Required:**
- Development effort: ~8 hours CI/CD integration
- Tool: Trivy (open source, no cost) or equivalent

---

### POAM-005: Previous Logon Notification (AC-9) Not Implemented

| Field | Value |
|---|---|
| **Item ID** | POAM-005 |
| **Priority** | Priority 3 — Low |
| **Finding Source** | Self-Identified / SAR FINDING-004 |
| **Weakness Description** | The CyberTabletop platform does not display the date, time, and source of the user's most recent successful login upon authentication. NIST SP 800-53 control AC-9 requires that the system notify users of the date and time of the last successful login and the number of unsuccessful login attempts since the last successful login. Without this information, users cannot easily detect if their account has been accessed without authorization. |
| **Associated Control(s)** | AC-9 — Previous Logon Notification |
| **Severity** | Low |
| **Date Identified** | January 2026 |
| **Scheduled Completion** | May 31, 2026 |
| **Responsible Individual** | Development Team Lead |
| **Current Status** | Open — Active Remediation |

**Milestones:**

| Milestone | Target Date | Status |
|---|---|---|
| 1. Design previous logon notification UI component | May 1, 2026 | Not Started |
| 2. Implement backend API to return last login metadata (timestamp, IP, failed attempts since last login) | May 15, 2026 | Not Started |
| 3. Implement frontend notification display on post-login dashboard | May 15, 2026 | Not Started |
| 4. Test and deploy to production | May 31, 2026 | Not Started |
| 5. Update SSP AC-9 status to Implemented | June 7, 2026 | Not Started |

**Resources Required:**
- Development effort: ~1 sprint (~1 week developer time)
- No additional infrastructure required; uses existing login timestamp data

---

### POAM-006: Application-Layer-Only DoS Protection

| Field | Value |
|---|---|
| **Item ID** | POAM-006 |
| **Priority** | Priority 3 — Low |
| **Finding Source** | RA-CTT-001 Risk RA-007 / SAR FINDING-008 |
| **Weakness Description** | CyberTabletop's denial of service protection relies solely on application-layer rate limiting (express-rate-limit) and Nginx connection limits. No upstream DDoS protection service (cloud provider DDoS protection, CDN, or WAF) is in place. While availability is rated LOW (training system), a sustained volumetric DDoS attack could make the system inaccessible. Application-layer rate limiting is insufficient against high-volume UDP or ICMP floods. |
| **Associated Control(s)** | SC-5 — Denial of Service Protection |
| **Severity** | Low |
| **Date Identified** | February 2026 |
| **Scheduled Completion** | September 30, 2026 |
| **Responsible Individual** | [SYSTEM OWNER NAME] / Network Operations |
| **Current Status** | Open — Planning |

**Milestones:**

| Milestone | Target Date | Status |
|---|---|---|
| 1. Evaluate upstream DDoS protection options: cloud provider native (AWS Shield/Azure DDoS), CDN (Cloudflare, Akamai), or WAF | May 31, 2026 | Not Started |
| 2. Present cost-benefit analysis to System Owner for selection decision | June 30, 2026 | Not Started |
| 3. Procure and configure selected DDoS protection solution | August 31, 2026 | Not Started |
| 4. Test DDoS protection effectiveness | September 15, 2026 | Not Started |
| 5. Update IRP with DDoS response procedures; update SSP SC-5 | September 30, 2026 | Not Started |

**Resources Required:**
- Infrastructure cost: Estimated $[COST] per month for DDoS protection service
- Sys Admin time: ~16 hours for configuration and testing
- ISSO review: ~4 hours

---

### POAM-007: Alternate Processing Site Not Established

| Field | Value |
|---|---|
| **Item ID** | POAM-007 |
| **Priority** | Priority 3 — Low |
| **Finding Source** | Self-Identified / SAR FINDING-005 |
| **Weakness Description** | The CyberTabletop Contingency Plan references alternate processing capability but a formal alternate processing site has not been established, documented, or tested. The containerized Docker architecture supports rapid redeployment to alternate infrastructure, but the specific target infrastructure, procedures, and activation timeline have not been validated. This partially satisfies CP-7 requirements. Note: The LOW availability impact rating for CyberTabletop reduces the urgency of this item. |
| **Associated Control(s)** | CP-7 — Alternate Processing Site; CP-13 — Alternative Security Mechanisms |
| **Severity** | Low |
| **Date Identified** | January 2026 |
| **Scheduled Completion** | December 31, 2026 |
| **Responsible Individual** | [SYSTEM OWNER NAME] / [SYSADMIN NAME] |
| **Current Status** | Open — Planning |

**Milestones:**

| Milestone | Target Date | Status |
|---|---|---|
| 1. Identify candidate alternate processing environments (secondary cloud region, secondary data center, alternate cloud provider) | June 30, 2026 | Not Started |
| 2. Document alternate site activation procedures in CP-CTT-001 | August 31, 2026 | Not Started |
| 3. Conduct test redeployment to alternate environment | October 31, 2026 | Not Started |
| 4. Document test results and update contingency plan | November 30, 2026 | Not Started |
| 5. Update SSP CP-7 status to Implemented | December 31, 2026 | Not Started |

**Resources Required:**
- Sys Admin time: ~24 hours for documentation and testing
- Potential infrastructure cost for alternate site: $[COST ESTIMATE]

---

### POAM-008: Formal Supply Chain Risk Assessment Not Documented

| Field | Value |
|---|---|
| **Item ID** | POAM-008 |
| **Priority** | Priority 2 — Moderate |
| **Finding Source** | Self-Identified / SAR FINDING-006 / RA-CTT-001 Risk RA-009 |
| **Weakness Description** | CyberTabletop performs automated dependency scanning (npm audit, Dependabot) and reviews container images for vulnerabilities, but lacks a formal Software Supply Chain Risk Management (SCRM) assessment document. Formal SCRM documentation would include: assessment of critical third-party components, evaluation of component provenance, review of vendor security practices, and documented risk acceptance for accepted components. The npm ecosystem is a known target for supply chain attacks, and a formal SCRM program would systematically address this risk. |
| **Associated Control(s)** | RA-3(1) — Supply Chain Risk Assessment; SA-9 — External System Services; SA-12 (Supply Chain Protection, if applicable) |
| **Severity** | Moderate |
| **Date Identified** | February 2026 |
| **Scheduled Completion** | August 31, 2026 |
| **Responsible Individual** | [ISSO NAME] / Development Team Lead |
| **Current Status** | Open — Planning |

**Milestones:**

| Milestone | Target Date | Status |
|---|---|---|
| 1. Inventory all third-party components (npm packages, Docker base images, external services) | May 31, 2026 | Not Started |
| 2. Identify critical components (those with privileged access to data, auth flows, or infrastructure) | June 15, 2026 | Not Started |
| 3. Research provenance and security practices for critical components | June 30, 2026 | Not Started |
| 4. Draft formal SCRM assessment document | July 31, 2026 | Not Started |
| 5. Review SCRM document with ISSO and System Owner | August 15, 2026 | Not Started |
| 6. Finalize SCRM document and integrate findings into risk register | August 31, 2026 | Not Started |
| 7. Establish private npm registry for vetted critical packages (future milestone) | December 31, 2026 | Not Started |

**Resources Required:**
- ISSO time: ~20 hours
- Developer time: ~16 hours (component inventory and research)
- Legal review if procurement/licensing issues identified: ~4 hours

---

### POAM-009: Threat Hunting Capability Not Operational

| Field | Value |
|---|---|
| **Item ID** | POAM-009 |
| **Priority** | Priority 3 — Low |
| **Finding Source** | Self-Identified / SAR FINDING-007 |
| **Weakness Description** | No formal threat hunting capability exists for CyberTabletop. Reactive monitoring (alerts, log review) is implemented, but proactive threat hunting — systematic search for indicators of compromise that evade automated detection — is not performed. For a system used by security professionals, advanced threat actors may target the platform specifically to compromise IR teams. Threat hunting would proactively identify such threats. |
| **Associated Control(s)** | RA-10 — Threat Hunting |
| **Severity** | Low |
| **Date Identified** | February 2026 |
| **Scheduled Completion** | December 31, 2026 |
| **Responsible Individual** | [ORGANIZATION] SOC Lead / [ISSO NAME] |
| **Current Status** | Open — Planning |

**Milestones:**

| Milestone | Target Date | Status |
|---|---|---|
| 1. Define threat hunting scope and hypothesis list for CyberTabletop (e.g., lateral movement, data staging, credential abuse) | July 31, 2026 | Not Started |
| 2. Establish quarterly threat hunting schedule | August 31, 2026 | Not Started |
| 3. Conduct first threat hunting exercise for CyberTabletop | October 31, 2026 | Not Started |
| 4. Document findings and integrate with continuous monitoring program | November 30, 2026 | Not Started |
| 5. Update SSP RA-10 status | December 31, 2026 | Not Started |

**Resources Required:**
- [ORGANIZATION] SOC analyst time: ~16 hours per quarterly hunt
- Threat hunting tooling (if not already available): $[COST]

---

### POAM-010: No Centralized Log Aggregation / SIEM Integration

| Field | Value |
|---|---|
| **Item ID** | POAM-010 |
| **Priority** | Priority 2 — Moderate |
| **Finding Source** | Self-Identified / SAR FINDING-003 |
| **Weakness Description** | CyberTabletop audit logs are stored in PostgreSQL with appropriate access controls. However, logs are not forwarded to a centralized SIEM or log aggregation platform. This limits: (1) real-time threat detection and correlation; (2) automated alerting beyond application-level alerts; (3) protection against log tampering (SIEM would provide a tamper-evident secondary copy); and (4) integration with [ORGANIZATION]'s enterprise security monitoring. The ISSO currently performs manual weekly log review, which cannot match the detection capability of automated correlation. |
| **Associated Control(s)** | AU-6 — Audit Record Review; CA-7 — Continuous Monitoring; SI-4 — System Monitoring |
| **Severity** | Moderate |
| **Date Identified** | February 2026 |
| **Scheduled Completion** | September 30, 2026 |
| **Responsible Individual** | [ISSO NAME] / [SYSADMIN NAME] |
| **Current Status** | Open — Active Remediation |

**Milestones:**

| Milestone | Target Date | Status |
|---|---|---|
| 1. Evaluate SIEM integration options: [ORGANIZATION] existing SIEM, cloud SIEM, open-source (OpenSearch/ELK) | May 31, 2026 | In Progress |
| 2. Design log forwarding architecture (syslog, Kafka, direct SIEM API, file forwarding) | June 30, 2026 | Not Started |
| 3. Configure log forwarding from CyberTabletop backend (Winston transport to SIEM) | July 31, 2026 | Not Started |
| 4. Develop SIEM correlation rules for key attack patterns | August 31, 2026 | Not Started |
| 5. Test log forwarding and correlation rules in staging | August 31, 2026 | Not Started |
| 6. Deploy log forwarding to production | September 15, 2026 | Not Started |
| 7. Validate all event types forwarding correctly; update SSP AU-6 and CA-7 | September 30, 2026 | Not Started |

**Resources Required:**
- ISSO time: ~24 hours
- Sys Admin time: ~20 hours
- Developer time: ~16 hours (Winston SIEM transport implementation)
- SIEM platform cost (if new platform required): $[COST]
- SIEM analyst time for correlation rule development: ~8 hours

---

## 4. Closed Items

| Item ID | Weakness | Date Closed | Closure Method | Verified By |
|---|---|---|---|---|
| POAM-001 | Privileged MFA enforcement gap | April 21, 2026 | Implemented local TOTP MFA enforcement for privileged roles; added tests and admin reset workflow | ISSO / Development Team Lead |
| POAM-003 | Automated dependency update PRs absent | May 30, 2026 | Enabled Dependabot, established PR review flow, and completed a validated dependency remediation branch | Development Team Lead |

---

## 5. POA&M Management Procedures

### 5.1 Monthly Review Process

1. ISSO reviews status of all open POA&M items
2. Responsible individuals provide milestone status updates
3. ISSO updates POA&M document with current status
4. Items past their scheduled completion date are escalated to System Owner
5. New findings from ongoing monitoring are added as new POA&M items

### 5.2 Closure Criteria

A POA&M item is eligible for closure when:
1. All milestones are completed
2. The remediation has been tested and verified as effective
3. The associated SSP section has been updated to reflect the new control status
4. The ISSO has independently verified the remediation
5. System Owner approval has been obtained

### 5.3 Escalation Process

| Condition | Escalation Action |
|---|---|
| Milestone missed by > 30 days | Escalate to System Owner; develop revised milestone plan |
| Milestone missed by > 60 days | Escalate to ISSM; brief AO at next quarterly review |
| Critical or High finding identified | Notify AO within 24 hours; emergency milestone plan required |
| New finding that changes overall risk level | Notify AO; may trigger ATO review |

### 5.4 Risk Acceptance for Delayed Remediation

For items where remediation will extend beyond the scheduled completion date, the System Owner must document formal risk acceptance with:
- Justification for delay
- Compensating controls in place during delay period
- New target completion date
- AO concurrence (for Moderate and above)

---

## 6. Approval and Signature

| Role | Name | Signature | Date |
|---|---|---|---|
| ISSO | [ISSO NAME] | _____________ | March 2026 |
| System Owner | [SYSTEM OWNER NAME] | _____________ | March 2026 |
| Authorizing Official | [AUTHORIZING OFFICIAL] | _____________ | March 2026 |

---

*Document Version: 1.3 | Classification: UNCLASSIFIED // For Official Use Only*
*CyberTabletop ATO Package — [ORGANIZATION]*
*Next Monthly Review: June 2026*
