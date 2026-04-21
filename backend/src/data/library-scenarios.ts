import { Difficulty, ScenarioMode, ScenarioType } from '@prisma/client';

export type StoredFacilitatorScript = {
  opening: string;
  roundIntros: Record<string, string>;
  rounds: Record<string, string>;
  closing: string;
};

export type LibraryScenarioMetadata = {
  version: string;
  orgContext: {
    orgName: string;
    industry: string;
    crownJewels: string[];
    rolesPresent: string[];
  };
  facilitatorScript: StoredFacilitatorScript;
};

export type LibraryScenarioSeed = {
  id: string;
  title: string;
  description: string;
  type: ScenarioType;
  difficulty: Difficulty;
  objectives: string[];
  mode: ScenarioMode;
  onboardingSchema: LibraryScenarioMetadata;
  isPublic: boolean;
  isBuiltIn: boolean;
  createdById: string;
  injects: Array<{
    phase: string;
    phaseOrder: number;
    injectOrder: number;
    title: string;
    narrative: string;
    backgroundBrief: string;
    roleVisibility: string[];
    mitreAttackId: string | null;
    mitreAttackName: string | null;
    nistCsfFunction: string | null;
    options: Array<{
      text: string;
      scoreWeight: number;
      isOptimal: boolean;
      scriptedFeedback: string;
      feedbackTags: string[];
      consequences: string | null;
    }>;
  }>;
};

type ScenarioBlueprint = {
  id: string;
  title: string;
  orgName: string;
  industry: string;
  type: ScenarioType;
  difficulty: Difficulty;
  crownJewels: string[];
  businessProcess: string;
  threatActor: string;
  initialVector: string;
  operationalImpact: string;
  stakeholderPressure: string;
  regulatoryFocus: string;
  externalDependency: string;
  responseRoles: string[];
};

const VERSION = '2026-03-30-library-refresh';

export const LEGACY_LIBRARY_SCENARIO_IDS = [
  'seed-scenario-ransomware',
  'seed-scenario-databreach',
  'seed-scenario-insider',
] as const;

const BASE_PHASE_SETS: Record<number, string[]> = {
  5: ['Discovery', 'Investigation', 'Containment', 'Eradication', 'Recovery'],
  6: ['Discovery', 'Investigation', 'Containment', 'Escalation', 'Eradication', 'Recovery'],
  7: ['Discovery', 'Investigation', 'Containment', 'Escalation', 'Remediation', 'Eradication', 'Recovery'],
  8: ['Discovery', 'Investigation', 'Containment', 'Escalation', 'Business Continuity', 'Remediation', 'Eradication', 'Recovery'],
};

const BLUEPRINTS: ScenarioBlueprint[] = [
  {
    id: 'library-federal-benefits-ransomware',
    title: 'Benefits Freeze',
    orgName: 'National Benefits Operations Center',
    industry: 'Federal / Civilian',
    type: ScenarioType.RANSOMWARE,
    difficulty: Difficulty.INTERMEDIATE,
    crownJewels: ['Citizen Service Portals / Case Management', 'Personally Identifiable Information (PII)'],
    businessProcess: 'federal benefits intake and citizen case processing',
    threatActor: 'a double-extortion ransomware affiliate',
    initialVector: 'a compromised contractor VPN account tied to weekend maintenance',
    operationalImpact: 'citizens lose access to status updates and adjudication staff cannot work new cases',
    stakeholderPressure: 'program leadership needs the public-facing portal restored before morning traffic spikes',
    regulatoryFocus: 'federal breach handling, records retention, and continuity of operations requirements',
    externalDependency: 'a managed hosting provider that supports the portal edge stack',
    responseRoles: ['IR Lead', 'Threat Analyst', 'IT/Sysadmin', 'Legal/Compliance', 'Executive/CISO'],
  },
  {
    id: 'library-state-local-pii-breach',
    title: 'Civic Ledger Exposure',
    orgName: 'Metro County Administrative Services',
    industry: 'Government / State & Local',
    type: ScenarioType.DATA_BREACH,
    difficulty: Difficulty.INTERMEDIATE,
    crownJewels: ['Personnel Records / HR Data', 'Personally Identifiable Information (PII)'],
    businessProcess: 'county payroll, tax, and employee records administration',
    threatActor: 'an opportunistic intrusion crew selling stolen data',
    initialVector: 'an exposed remote management service left reachable after an infrastructure change',
    operationalImpact: 'county leaders face pressure around payroll integrity and public trust',
    stakeholderPressure: 'the county executive wants a facts-based update before the next council briefing',
    regulatoryFocus: 'state breach notification timelines and public records obligations',
    externalDependency: 'a county payroll software integrator',
    responseRoles: ['IR Lead', 'Threat Analyst', 'HR', 'Legal/Compliance', 'Communications/PR'],
  },
  {
    id: 'library-dod-contractor-cui-hunt',
    title: 'Silent Forge',
    orgName: 'Aegis Flight Systems',
    industry: 'Defense / DoD Contractor',
    type: ScenarioType.APT,
    difficulty: Difficulty.ADVANCED,
    crownJewels: ['Controlled Unclassified Information (CUI)', 'Encryption Keys / PKI'],
    businessProcess: 'defense subsystem engineering and secure partner delivery',
    threatActor: 'a patient state-aligned collection team',
    initialVector: 'a hijacked supplier certificate used to sideload a signed updater',
    operationalImpact: 'engineering and program offices risk losing contract data and trust with government customers',
    stakeholderPressure: 'program leadership needs to know whether contract deliverables and secure exchange channels are still trustworthy',
    regulatoryFocus: 'CMMC, DFARS reporting, and partner handling of sensitive program data',
    externalDependency: 'a software supplier with privileged access to build tooling',
    responseRoles: ['IR Lead', 'Threat Analyst', 'Engineering Lead', 'Legal/Compliance', 'Executive/CISO'],
  },
  {
    id: 'library-banking-bec-wirefraud',
    title: 'Wire Room Mirage',
    orgName: 'Harbor National Bank',
    industry: 'Financial Services / Banking',
    type: ScenarioType.BEC,
    difficulty: Difficulty.INTERMEDIATE,
    crownJewels: ['Financial Data / Payment Systems', 'Email Systems / Collaboration Tools'],
    businessProcess: 'treasury operations and high-value wire approvals',
    threatActor: 'a finance-focused business email compromise crew',
    initialVector: 'a convincing OAuth consent phish targeting an executive assistant',
    operationalImpact: 'wire approvals, customer notifications, and fraud containment all compete for attention',
    stakeholderPressure: 'the CFO wants to know if a pending eight-figure transfer can still be stopped',
    regulatoryFocus: 'financial fraud escalation, customer impact review, and suspicious activity reporting',
    externalDependency: 'a correspondent banking partner and fraud hotline process',
    responseRoles: ['Fraud Lead', 'IT/Sysadmin', 'Legal/Compliance', 'Executive/CISO', 'Communications/PR'],
  },
  {
    id: 'library-insurance-claims-breach',
    title: 'Claims Cascade',
    orgName: 'NorthStar Mutual',
    industry: 'Financial Services / Insurance',
    type: ScenarioType.DATA_BREACH,
    difficulty: Difficulty.INTERMEDIATE,
    crownJewels: ['Customer Data / CRM', 'Personally Identifiable Information (PII)'],
    businessProcess: 'claims intake, adjuster coordination, and policyholder communications',
    threatActor: 'a credential-theft group monetizing exposed customer records',
    initialVector: 'stolen contact center credentials reused against a legacy customer support portal',
    operationalImpact: 'policyholders cannot trust outreach, adjusters lose visibility, and fraud claims begin to rise',
    stakeholderPressure: 'claims leadership needs a stable customer message before media and agents start calling',
    regulatoryFocus: 'state insurance breach reporting and consumer protection obligations',
    externalDependency: 'a third-party call center supporting overflow claims volume',
    responseRoles: ['IR Lead', 'Claims Lead', 'Legal/Compliance', 'Communications/PR', 'Executive/CISO'],
  },
  {
    id: 'library-hospital-backup-ransomware',
    title: 'Wardlock',
    orgName: 'St. Mark Regional Hospital',
    industry: 'Healthcare / Hospital',
    type: ScenarioType.RANSOMWARE,
    difficulty: Difficulty.ADVANCED,
    crownJewels: ['Backup Systems / Disaster Recovery', 'Active Directory / Domain Controllers'],
    businessProcess: 'acute care operations, pharmacy coordination, and inpatient scheduling',
    threatActor: 'a ransomware actor timing detonation for maximum clinical disruption',
    initialVector: 'malware introduced through a third-party imaging workstation and then escalated through AD',
    operationalImpact: 'clinical teams move to downtime procedures and leadership fears patient safety consequences',
    stakeholderPressure: 'the chief medical officer needs confidence on backup viability before elective care decisions are made',
    regulatoryFocus: 'clinical continuity, reporting, and preservation of evidence around potential patient harm',
    externalDependency: 'a medical imaging vendor with persistent remote access tooling',
    responseRoles: ['IR Lead', 'Clinical Operations', 'IT/Sysadmin', 'Legal/Compliance', 'Executive/CISO'],
  },
  {
    id: 'library-health-plan-enrollment-bec',
    title: 'Member Mailbox',
    orgName: 'Summit Health Plan',
    industry: 'Healthcare / Health Plan',
    type: ScenarioType.BEC,
    difficulty: Difficulty.INTERMEDIATE,
    crownJewels: ['Customer Data / CRM', 'Email Systems / Collaboration Tools'],
    businessProcess: 'member enrollment, broker coordination, and premium reconciliation',
    threatActor: 'a social-engineering team abusing trusted mailbox access',
    initialVector: 'a spoofed broker invoice thread that led to mailbox takeover',
    operationalImpact: 'premium changes, broker trust, and member data handling all become suspect at once',
    stakeholderPressure: 'sales and enrollment leaders want to know if open enrollment messaging can continue safely',
    regulatoryFocus: 'consumer notifications and handling of sensitive member account data',
    externalDependency: 'an external broker channel and shared enrollment mailbox',
    responseRoles: ['IR Lead', 'Enrollment Lead', 'Legal/Compliance', 'Communications/PR', 'Executive/CISO'],
  },
  {
    id: 'library-retail-supply-chain-pos',
    title: 'Checkout Chain Reaction',
    orgName: 'Northline Commerce Group',
    industry: 'Retail / E-Commerce',
    type: ScenarioType.SUPPLY_CHAIN,
    difficulty: Difficulty.INTERMEDIATE,
    crownJewels: ['Financial Data / Payment Systems', 'Customer Data / CRM'],
    businessProcess: 'online checkout, loyalty operations, and fulfillment handoff',
    threatActor: 'an intrusion crew abusing a compromised analytics vendor dependency',
    initialVector: 'malicious JavaScript introduced through a trusted third-party storefront component',
    operationalImpact: 'checkout conversion drops while fraud teams suspect payment card harvesting',
    stakeholderPressure: 'digital commerce leaders need the storefront stable before a major promotional weekend',
    regulatoryFocus: 'merchant response obligations, card brand coordination, and customer trust restoration',
    externalDependency: 'an e-commerce analytics vendor embedded on the checkout path',
    responseRoles: ['IR Lead', 'E-Commerce Lead', 'Threat Analyst', 'Legal/Compliance', 'Communications/PR'],
  },
  {
    id: 'library-utilities-scada-hunt',
    title: 'Frequency Drift',
    orgName: 'RiverGrid Utilities',
    industry: 'Energy / Utilities',
    type: ScenarioType.APT,
    difficulty: Difficulty.EXPERT,
    crownJewels: ['Critical Infrastructure / SCADA / ICS', 'Mission Systems / Operational Data'],
    businessProcess: 'grid balancing, substation telemetry, and outage coordination',
    threatActor: 'a long-dwell intrusion set mapping operational technology pathways',
    initialVector: 'a spearphished engineering account used to bridge from IT into a monitoring enclave',
    operationalImpact: 'operators fear manipulation of telemetry while public reliability metrics start drifting',
    stakeholderPressure: 'operations leadership wants assurance that protective relays and manual fallback remain trustworthy',
    regulatoryFocus: 'critical infrastructure reporting, operational continuity, and coordination with sector partners',
    externalDependency: 'a regional transmission partner and OT monitoring integrator',
    responseRoles: ['IR Lead', 'OT Engineer', 'Threat Analyst', 'Legal/Compliance', 'Executive/CISO'],
  },
  {
    id: 'library-oil-gas-erp-ransomware',
    title: 'Pipeline Ledger',
    orgName: 'Prairie Meridian Energy',
    industry: 'Energy / Oil & Gas',
    type: ScenarioType.RANSOMWARE,
    difficulty: Difficulty.ADVANCED,
    crownJewels: ['Financial Systems / ERP', 'Mission Systems / Operational Data'],
    businessProcess: 'pipeline nominations, billing, and field maintenance dispatch',
    threatActor: 'a disruptive ransomware actor with operational extortion demands',
    initialVector: 'malicious macros delivered through a field contractor invoice workflow',
    operationalImpact: 'dispatch and billing data diverge, creating pressure on physical operations and revenue flow',
    stakeholderPressure: 'operations leadership needs to know whether dispatch can continue without corrupt data',
    regulatoryFocus: 'critical infrastructure continuity and evidence preservation for law enforcement',
    externalDependency: 'a field services contractor and hosted ERP support partner',
    responseRoles: ['IR Lead', 'Operations Lead', 'IT/Sysadmin', 'Legal/Compliance', 'Executive/CISO'],
  },
  {
    id: 'library-manufacturing-erp-ransomware',
    title: 'Assembly Halt',
    orgName: 'Summit Precision Manufacturing',
    industry: 'Manufacturing',
    type: ScenarioType.RANSOMWARE,
    difficulty: Difficulty.INTERMEDIATE,
    crownJewels: ['Financial Systems / ERP', 'Supply Chain / Vendor Data'],
    businessProcess: 'shop floor scheduling, supplier delivery planning, and inventory release',
    threatActor: 'a ransomware crew targeting production schedules and vendor leverage',
    initialVector: 'remote desktop exposure on a warehouse support server',
    operationalImpact: 'production sequencing stalls and suppliers begin shipping against stale plans',
    stakeholderPressure: 'plant leadership needs a realistic timeline before lines are shut down across multiple sites',
    regulatoryFocus: 'contract delivery commitments, evidence handling, and continuity planning',
    externalDependency: 'a logistics provider and supplier portal integration',
    responseRoles: ['IR Lead', 'Operations Lead', 'Supply Chain Lead', 'Threat Analyst', 'Executive/CISO'],
  },
  {
    id: 'library-saas-sourcecode-breach',
    title: 'Tenant Token Theft',
    orgName: 'LatticeStack',
    industry: 'Technology / SaaS',
    type: ScenarioType.DATA_BREACH,
    difficulty: Difficulty.ADVANCED,
    crownJewels: ['Intellectual Property / Source Code', 'Cloud Infrastructure / AWS / Azure / GCP'],
    businessProcess: 'multi-tenant application delivery, CI/CD, and customer support engineering',
    threatActor: 'a cloud-savvy intrusion team seeking source access and customer secrets',
    initialVector: 'a leaked CI token chained into over-privileged cloud roles',
    operationalImpact: 'engineering velocity, customer trust, and production integrity all come under strain',
    stakeholderPressure: 'product leadership needs to decide whether to freeze deployments and revoke customer integrations',
    regulatoryFocus: 'cloud evidence preservation, customer contractual notice, and secret rotation',
    externalDependency: 'a shared CI platform and several downstream tenant integrations',
    responseRoles: ['IR Lead', 'Engineering Lead', 'Cloud Platform Lead', 'Legal/Compliance', 'Executive/CISO'],
  },
  {
    id: 'library-cloud-idp-apt',
    title: 'Control Plane Shadow',
    orgName: 'NorthAxis Cloud',
    industry: 'Technology / Cloud Provider',
    type: ScenarioType.APT,
    difficulty: Difficulty.EXPERT,
    crownJewels: ['Authentication Systems / Identity Provider', 'Cloud Infrastructure / AWS / Azure / GCP'],
    businessProcess: 'identity brokerage, privileged admin operations, and tenant provisioning',
    threatActor: 'a highly capable adversary seeking persistent cloud control-plane access',
    initialVector: 'token replay against a stale federation trust used for administrative SSO',
    operationalImpact: 'tenant trust, privileged admin confidence, and platform availability are all at risk',
    stakeholderPressure: 'platform leadership needs to know whether privileged credentials and federation paths can still be trusted',
    regulatoryFocus: 'customer transparency, privileged identity assurance, and incident reporting to major accounts',
    externalDependency: 'an external identity federation partner and managed support team',
    responseRoles: ['IR Lead', 'Cloud Platform Lead', 'Identity Engineer', 'Legal/Compliance', 'Executive/CISO'],
  },
  {
    id: 'library-telecom-ddos-core',
    title: 'Carrier Core Flood',
    orgName: 'BlueSpan Communications',
    industry: 'Telecommunications',
    type: ScenarioType.DDoS,
    difficulty: Difficulty.INTERMEDIATE,
    crownJewels: ['Network Infrastructure / Firewalls / Routers', 'Mission Systems / Operational Data'],
    businessProcess: 'subscriber traffic routing, peering health, and network operations center response',
    threatActor: 'a criminal botnet-for-hire operator amplifying nuisance into service disruption',
    initialVector: 'massive volumetric traffic aimed at public edge services and recursive DNS infrastructure',
    operationalImpact: 'customer support queues surge while core traffic engineering teams race to preserve priority services',
    stakeholderPressure: 'network leadership needs a mitigation plan before enterprise customers escalate outages publicly',
    regulatoryFocus: 'major outage coordination, evidence collection, and service restoration communications',
    externalDependency: 'upstream transit providers and scrubbing center contracts',
    responseRoles: ['NOC Lead', 'Network Engineer', 'Communications/PR', 'Executive/CISO', 'Legal/Compliance'],
  },
  {
    id: 'library-higher-ed-insider-research',
    title: 'Quiet Lab Leak',
    orgName: 'Redwood State University',
    industry: 'Education / Higher Ed',
    type: ScenarioType.INSIDER_THREAT,
    difficulty: Difficulty.INTERMEDIATE,
    crownJewels: ['Intellectual Property / Source Code', 'Personally Identifiable Information (PII)'],
    businessProcess: 'grant-funded research collaboration, student staffing, and lab data management',
    threatActor: 'a departing researcher quietly collecting restricted datasets and code before leaving',
    initialVector: 'large after-hours downloads through a personal sync client on a lab workstation',
    operationalImpact: 'research continuity, grant obligations, and faculty trust begin to unravel',
    stakeholderPressure: 'academic leadership wants to protect the grant and keep the matter from spiraling into rumor',
    regulatoryFocus: 'grant handling rules, HR coordination, and protection of restricted research outputs',
    externalDependency: 'a partner lab and shared storage workspace',
    responseRoles: ['IR Lead', 'Research Lead', 'HR', 'Legal/Compliance', 'Executive/CISO'],
  },
  {
    id: 'library-logistics-bec-dispatch',
    title: 'Dispatch Diversion',
    orgName: 'Atlas Freight Network',
    industry: 'Transportation / Logistics',
    type: ScenarioType.BEC,
    difficulty: Difficulty.INTERMEDIATE,
    crownJewels: ['Mission Systems / Operational Data', 'Supply Chain / Vendor Data'],
    businessProcess: 'carrier dispatch, fuel settlement, and shipper communications',
    threatActor: 'a social engineering group spoofing trusted brokers and carriers',
    initialVector: 'compromised mailbox rules inside a shared dispatch inbox',
    operationalImpact: 'load instructions begin changing, vendor payments are questioned, and shipments risk misrouting',
    stakeholderPressure: 'operations leadership needs to keep freight moving while validating which dispatch instructions are clean',
    regulatoryFocus: 'chain-of-custody, partner notification, and preservation of dispatch evidence',
    externalDependency: 'broker partners and a hosted transportation management system',
    responseRoles: ['IR Lead', 'Dispatch Lead', 'Legal/Compliance', 'Communications/PR', 'Executive/CISO'],
  },
];

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function pickRoundCount(seed: string): number {
  return 5 + (stableHash(seed) % 4);
}

function phaseLabelForType(type: ScenarioType, phase: string): string {
  if (phase === 'Escalation') {
    if (type === ScenarioType.BEC) return 'Executive Coordination';
    if (type === ScenarioType.DATA_BREACH) return 'Legal Review';
    if (type === ScenarioType.INSIDER_THREAT) return 'HR and Legal Coordination';
    if (type === ScenarioType.SUPPLY_CHAIN) return 'Vendor Coordination';
  }

  if (phase === 'Business Continuity') {
    if (type === ScenarioType.DATA_BREACH) return 'Notification Planning';
    if (type === ScenarioType.DDoS) return 'Communications';
    if (type === ScenarioType.APT) return 'Threat Hunt';
    if (type === ScenarioType.INSIDER_THREAT) return 'Executive Review';
  }

  return phase;
}

function nistForPhase(phase: string): string {
  switch (phase) {
    case 'Discovery':
      return 'DETECT';
    case 'Investigation':
      return 'IDENTIFY';
    case 'Containment':
    case 'Escalation':
    case 'Business Continuity':
      return 'RESPOND';
    case 'Remediation':
    case 'Eradication':
    case 'Recovery':
      return 'RECOVER';
    default:
      return 'RESPOND';
  }
}

function mitreFor(type: ScenarioType, phase: string): { id: string | null; name: string | null } {
  if (type === ScenarioType.RANSOMWARE) {
    if (phase === 'Discovery') return { id: 'T1486', name: 'Data Encrypted for Impact' };
    if (phase === 'Investigation') return { id: 'T1078', name: 'Valid Accounts' };
    if (phase === 'Containment') return { id: 'T1021.001', name: 'Remote Services: RDP' };
    if (phase === 'Eradication') return { id: 'T1490', name: 'Inhibit System Recovery' };
  }

  if (type === ScenarioType.DATA_BREACH) {
    if (phase === 'Discovery') return { id: 'T1041', name: 'Exfiltration Over C2 Channel' };
    if (phase === 'Investigation') return { id: 'T1078', name: 'Valid Accounts' };
    if (phase === 'Containment') return { id: 'T1562.001', name: 'Impair Defenses' };
  }

  if (type === ScenarioType.BEC) {
    if (phase === 'Discovery') return { id: 'T1566.001', name: 'Phishing: Spearphishing Attachment' };
    if (phase === 'Investigation') return { id: 'T1114', name: 'Email Collection' };
    if (phase === 'Containment') return { id: 'T1098', name: 'Account Manipulation' };
  }

  if (type === ScenarioType.SUPPLY_CHAIN) {
    if (phase === 'Discovery') return { id: 'T1195', name: 'Supply Chain Compromise' };
    if (phase === 'Investigation') return { id: 'T1059', name: 'Command and Scripting Interpreter' };
    if (phase === 'Containment') return { id: 'T1199', name: 'Trusted Relationship' };
  }

  if (type === ScenarioType.APT) {
    if (phase === 'Discovery') return { id: 'T1078', name: 'Valid Accounts' };
    if (phase === 'Investigation') return { id: 'T1055', name: 'Process Injection' };
    if (phase === 'Containment') return { id: 'T1021', name: 'Remote Services' };
    if (phase === 'Business Continuity') return { id: 'T1087', name: 'Account Discovery' };
  }

  if (type === ScenarioType.INSIDER_THREAT) {
    if (phase === 'Discovery') return { id: 'T1005', name: 'Data from Local System' };
    if (phase === 'Investigation') return { id: 'T1020', name: 'Automated Exfiltration' };
    if (phase === 'Containment') return { id: 'T1078', name: 'Valid Accounts' };
  }

  if (type === ScenarioType.DDoS) {
    if (phase === 'Discovery') return { id: 'T1498', name: 'Network Denial of Service' };
    if (phase === 'Investigation') return { id: 'T1499', name: 'Endpoint Denial of Service' };
    if (phase === 'Containment') return { id: 'T1584.006', name: 'Compromise Infrastructure: Botnet' };
  }

  return { id: null, name: null };
}

function responseLens(blueprint: ScenarioBlueprint): string {
  return blueprint.responseRoles.slice(0, 4).join(', ');
}

function joinList(values: string[]): string {
  if (values.length === 0) return '';
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

function scenarioTypeLabel(type: ScenarioType): string {
  switch (type) {
    case ScenarioType.RANSOMWARE:
      return 'ransomware';
    case ScenarioType.DATA_BREACH:
      return 'data breach';
    case ScenarioType.INSIDER_THREAT:
      return 'insider threat';
    case ScenarioType.BEC:
      return 'business email compromise';
    case ScenarioType.SUPPLY_CHAIN:
      return 'supply chain compromise';
    case ScenarioType.DDoS:
    case ScenarioType.DDOS:
      return 'distributed denial of service incident';
    case ScenarioType.APT:
      return 'advanced persistent threat campaign';
    default:
      return 'cyber incident';
  }
}

function roleVisibilityForPhase(phase: string): string[] {
  switch (phase) {
    case 'Discovery':
      return ['IR Lead', 'Threat Analyst', 'IT/Sysadmin'];
    case 'Investigation':
      return ['IR Lead', 'Threat Analyst', 'IT/Sysadmin'];
    case 'Containment':
      return ['IR Lead', 'Threat Analyst', 'IT/Sysadmin', 'Operations Lead'];
    case 'Escalation':
    case 'Business Continuity':
      return ['Executive/CISO', 'Legal/Compliance', 'Communications/PR', 'Incident Commander'];
    case 'Remediation':
    case 'Eradication':
      return ['IR Lead', 'Threat Analyst', 'IT/Sysadmin'];
    default:
      return [];
  }
}

function optimalAction(blueprint: ScenarioBlueprint, phase: string, phaseLabel: string): string {
  const assets = joinList(blueprint.crownJewels);

  switch (phase) {
    case 'Discovery':
      return `Stand up the incident command structure immediately, preserve evidence, and validate whether ${assets} and the systems supporting ${blueprint.businessProcess} are already impacted before leadership starts making assumptions.`;
    case 'Investigation':
      return `Use authoritative telemetry to build a scope map across ${blueprint.businessProcess}, confirm the attacker path from ${blueprint.initialVector}, and document what happened to ${assets} so every later decision rests on evidence.`;
    case 'Containment':
      return `Contain the affected accounts, endpoints, and network paths in a way that protects ${assets} without destroying forensic evidence, and coordinate each step with the teams running ${blueprint.businessProcess}.`;
    case 'Escalation':
      return `Give leadership a concise update grounded in confirmed facts, explain the likely impact on ${blueprint.businessProcess}, and align legal, communications, and operations around a single response plan for ${phaseLabel.toLowerCase()}.`;
    case 'Business Continuity':
      return `Activate continuity procedures that keep the most critical parts of ${blueprint.businessProcess} running while isolating risk, and document the risk tradeoffs so executives can defend the path forward.`;
    case 'Remediation':
      return `Remove the access path used by ${blueprint.threatActor}, rotate the credentials and trust relationships tied to ${assets}, and stage fixes in a sequence that lets the team validate control before reopening dependencies.`;
    case 'Eradication':
      return `Finish eradication with full credential hygiene, persistence hunting, and clean-system validation so ${blueprint.threatActor} cannot re-enter through the same foothold once services return.`;
    case 'Recovery':
      return `Restore service in a controlled order, verify that ${assets} and the systems behind ${blueprint.businessProcess} are trustworthy, and communicate what is known, unknown, and next with discipline.`;
    default:
      return `Coordinate the team around a documented response plan that protects ${assets} and keeps ${blueprint.businessProcess} moving where safely possible.`;
  }
}

function acceptableAction(blueprint: ScenarioBlueprint, phase: string): string {
  switch (phase) {
    case 'Discovery':
      return 'Have the security team start triage quietly first and wait for one more confirming signal before activating the broader response so the room does not overreact.';
    case 'Investigation':
      return `Focus the investigation on the first impacted systems and only expand the hunt if those results clearly show that ${blueprint.businessProcess} is broader than expected.`;
    case 'Containment':
      return `Isolate only the obviously affected systems first, then decide later whether to suspend shared services or partner access tied to ${blueprint.externalDependency}.`;
    case 'Escalation':
      return `Brief executives and legal separately, but keep the message intentionally high level until the team can answer deeper questions about ${blueprint.regulatoryFocus}.`;
    case 'Business Continuity':
      return 'Keep the highest-value workflows running manually while the team delays decisions on lower-priority operations until the next leadership checkpoint.';
    case 'Remediation':
      return 'Patch the most exposed systems first and defer deeper trust or credential cleanup until after core services are stable again.';
    case 'Eradication':
      return 'Reset the most sensitive accounts now and schedule broader cleanup after the team gets through immediate service restoration pressure.';
    case 'Recovery':
      return 'Bring services back quickly for the loudest stakeholders and plan to validate edge cases and partner dependencies after the first wave of recovery.';
    default:
      return 'Take a narrower response step that addresses the most visible issue first and revisit the broader environment later.';
  }
}

function suboptimalAction(blueprint: ScenarioBlueprint, phase: string): string {
  switch (phase) {
    case 'Discovery':
      return `Treat the activity as a likely false positive for now and wait for business users to confirm that ${blueprint.businessProcess} is actually broken before opening an incident.`;
    case 'Investigation':
      return 'Rely mainly on anecdotal reports from business teams and skip deeper telemetry review until the next day because the evidence can be reconstructed later.';
    case 'Containment':
      return `Make containment decisions one system at a time without a coordinated plan so the teams running ${blueprint.businessProcess} can keep as much access as possible.`;
    case 'Escalation':
      return 'Tell leadership that the team still needs more time and avoid discussing possible business or regulatory outcomes until every technical detail is known.';
    case 'Business Continuity':
      return 'Pause most operations while waiting for perfect technical clarity instead of using fallback procedures that could keep essential work moving.';
    case 'Remediation':
      return `Reopen services after the first fixes appear to work, even if some legacy credentials, vendor trusts, or admin paths tied to ${blueprint.externalDependency} are still unresolved.`;
    case 'Eradication':
      return 'Delete the most obvious malicious artifacts and assume the environment is clean once the immediate alerts stop firing.';
    case 'Recovery':
      return 'Push systems back online quickly and let frontline teams discover any remaining issues in production rather than validating readiness first.';
    default:
      return 'Take the smallest possible technical action and hope the broader issue resolves without deeper coordination.';
  }
}

function harmfulAction(blueprint: ScenarioBlueprint, phase: string): string {
  if (blueprint.type === ScenarioType.RANSOMWARE) {
    if (phase === 'Discovery' || phase === 'Containment') {
      return 'Keep affected systems online so business users can keep working for a bit longer and begin ransom payment discussions before scope and persistence are understood.';
    }
  }

  if (blueprint.type === ScenarioType.DATA_BREACH) {
    return 'Minimize the issue, avoid preserving difficult evidence, and delay any external planning until someone forces the organization to acknowledge the breach.';
  }

  if (blueprint.type === ScenarioType.BEC) {
    return 'Approve the questionable transfer or account change to avoid delaying the business process, then clean up the mailbox later if needed.';
  }

  if (blueprint.type === ScenarioType.SUPPLY_CHAIN) {
    return `Assume ${blueprint.externalDependency} will handle the situation on their own and leave the compromised integration or script path in place while the vendor investigates.`;
  }

  if (blueprint.type === ScenarioType.INSIDER_THREAT) {
    return 'Confront the suspected insider immediately without preserving evidence or coordinating access control, then hope they cooperate and stop on their own.';
  }

  if (blueprint.type === ScenarioType.APT) {
    return 'Clean a single host, declare the threat gone, and avoid broader identity or trust review so operations are not disrupted.';
  }

  if (blueprint.type === ScenarioType.DDoS || blueprint.type === ScenarioType.DDOS) {
    return 'Wait out the traffic with no upstream escalation, public messaging, or prioritization strategy and assume the service will normalize on its own.';
  }

  return `Delay meaningful action and avoid cross-functional coordination even though ${blueprint.operationalImpact}.`;
}

function feedbackForAction(blueprint: ScenarioBlueprint, phase: string, quality: 'optimal' | 'acceptable' | 'suboptimal' | 'harmful'): string {
  if (quality === 'optimal') {
    return `This is the strongest response because it follows NIST CSF ${nistForPhase(phase)} priorities, preserves decision quality under pressure, and keeps ${blueprint.businessProcess} aligned with the actual evidence instead of assumptions. It also protects ${joinList(blueprint.crownJewels)} while giving leadership and partners a defensible operating picture.`;
  }

  if (quality === 'acceptable') {
    return `This buys some time, but it leaves risk on the table because the team is moving narrower and slower than the incident demands. The missing piece is broader coordination around ${blueprint.businessProcess} and the dependencies tied to ${blueprint.externalDependency}.`;
  }

  if (quality === 'suboptimal') {
    return 'This response delays the organization at the point where disciplined coordination matters most. Real incidents like this punish teams that rely on anecdotes or optimism instead of telemetry, containment discipline, and documented decision-making.';
  }

  return `This would materially worsen the incident. It ignores established incident response practice, creates avoidable legal and operational exposure, and gives ${blueprint.threatActor} more room to affect ${joinList(blueprint.crownJewels)} and the workflows behind ${blueprint.businessProcess}.`;
}

function consequenceForAction(blueprint: ScenarioBlueprint, quality: 'optimal' | 'acceptable' | 'suboptimal' | 'harmful'): string {
  if (quality === 'optimal') {
    return `The team gains control of the incident narrative and can make disciplined decisions about ${blueprint.businessProcess}.`;
  }
  if (quality === 'acceptable') {
    return 'Some risk is reduced, but hidden scope and downstream decision debt remain.';
  }
  if (quality === 'suboptimal') {
    return 'The team loses time and the incident expands faster than stakeholder confidence.';
  }
  return 'Business impact deepens, evidence quality drops, and leadership is forced into worse decisions later.';
}

function buildNarrative(
  blueprint: ScenarioBlueprint,
  phase: string,
  phaseLabel: string,
  roundNumber: number,
  totalRounds: number,
): { title: string; narrative: string; backgroundBrief: string } {
  const assets = joinList(blueprint.crownJewels);
  const roundLabel = `Round ${roundNumber} of ${totalRounds}`;

  switch (phase) {
    case 'Discovery':
      return {
        title: `${phaseLabel}: First Signs in ${blueprint.businessProcess}`,
        narrative: `${roundLabel}. ${blueprint.orgName}, a ${blueprint.industry} organization, starts the day with signs of a possible ${scenarioTypeLabel(blueprint.type)}. Security monitoring shows activity tied to ${blueprint.initialVector}, and the first suspicious indicators line up with systems that support ${blueprint.businessProcess}. The assets most likely in play are ${assets}.\n\nFrontline teams report that ${blueprint.operationalImpact}. ${blueprint.stakeholderPressure}. The facilitator team has enough evidence to know this is not routine noise, but not enough yet to understand whether the impact is localized or already spreading.`,
        backgroundBrief: `Early indicators suggest ${blueprint.threatActor} may have gained a workable foothold through ${blueprint.initialVector}. Preserve logs, identities, and timing before they roll over.`,
      };
    case 'Investigation':
      return {
        title: `${phaseLabel}: Scope the Blast Radius`,
        narrative: `${roundLabel}. Initial triage confirms the incident is real. Telemetry now shows additional artifacts around ${blueprint.businessProcess}, and analysts are trying to determine whether ${assets} were merely touched or actively accessed. Teams tied to ${blueprint.externalDependency} may also have seen the same activity path.\n\nLeadership wants a scope update, but the facts are still forming. The central question is no longer whether something happened. It is how far ${blueprint.threatActor} moved, what evidence is trustworthy, and whether the team understands the most important systems well enough to brief leadership without overstatement.`,
        backgroundBrief: 'The investigation has to connect identity, endpoint, network, and business process evidence. Stakeholders are already asking whether the issue could be wider than the first systems identified.',
      };
    case 'Containment':
      return {
        title: `${phaseLabel}: Protect the Core Assets`,
        narrative: `${roundLabel}. The team now has enough evidence to start containment, but the environment supporting ${blueprint.businessProcess} cannot simply be turned off without consequence. Shared accounts, remote access paths, and dependencies tied to ${blueprint.externalDependency} all have to be considered before changes are made. ${joinList(blueprint.crownJewels)} remain the highest-value assets in scope.\n\nOperations leaders are pushing to preserve uptime while security wants to move decisively. This is the point where a poorly sequenced containment move could either strand the business or leave the attacker free to continue. The facilitator has to balance speed, evidence, and operational reality.`,
        backgroundBrief: 'Containment decisions will shape everything that comes next. The team must preserve evidence and protect business-critical workflows at the same time.',
      };
    case 'Escalation':
      return {
        title: `${phaseLabel}: Leadership Pressure Builds`,
        narrative: `${roundLabel}. Technical containment is underway, but the incident now reaches beyond the IR team. Executives want a plain-language update, legal wants to understand the implications of ${blueprint.regulatoryFocus}, and communications wants to know whether any holding statements should be prepared. ${blueprint.stakeholderPressure}.\n\nAt this stage, the biggest risk is fragmented decision-making. If each team moves on its own, the organization may create conflicting messages, preserve the wrong evidence, or overpromise on recovery. The facilitator must align decision-makers around a single operating picture before the next external question lands.`,
        backgroundBrief: 'Cross-functional alignment matters here as much as technical accuracy. The team needs a defensible story tied to confirmed facts and realistic next steps.',
      };
    case 'Business Continuity':
      return {
        title: `${phaseLabel}: Keep the Mission Moving`,
        narrative: `${roundLabel}. The incident response is no longer just about technical cleanup. The organization has to keep the most critical parts of ${blueprint.businessProcess} running while the threat is still being managed. Teams supporting ${blueprint.externalDependency} are asking whether they can continue normal workflows, and ${blueprint.operationalImpact}.\n\nThis round forces the facilitator to make continuity tradeoffs in the open. The safest technical choice may not be the best business choice, and the fastest business choice may increase risk to ${assets}. The room has to decide what can stay live, what must move to fallback procedures, and how to explain that choice to leadership and partners.`,
        backgroundBrief: 'This phase is about continuity under pressure, not perfect certainty. A workable fallback plan is often better than waiting for every technical unknown to disappear.',
      };
    case 'Remediation':
      return {
        title: `${phaseLabel}: Close the Access Path`,
        narrative: `${roundLabel}. The team is shifting from immediate control to durable cleanup. Investigators understand more about how ${blueprint.threatActor} entered, moved, or persisted, and the organization now needs to remove that path without creating blind spots or reopening the incident later. The systems behind ${blueprint.businessProcess} cannot return to normal until the team is confident trust has been rebuilt around ${assets}.\n\nPressure is rising to restore normal operations quickly. The facilitator has to choose whether remediation focuses only on the obvious break point or on the deeper identity, dependency, and configuration issues that made the incident possible in the first place.`,
        backgroundBrief: 'This is where short-term fixes often fail. Durable remediation usually includes trust cleanup, not just patching or host rebuilds.',
      };
    case 'Eradication':
      return {
        title: `${phaseLabel}: Verify the Threat Is Gone`,
        narrative: `${roundLabel}. The environment looks calmer, but the team still has to prove that calm is real. Credentials, persistence paths, scheduled tasks, and federated trust relationships all need review before leaders can say the threat is truly removed. The wrong assumption here could let ${blueprint.threatActor} walk back into ${blueprint.businessProcess} after the organization believes the incident is over.\n\nStakeholders are pushing for a clean bill of health. The facilitator now has to insist on enough validation to support recovery without dragging the room into endless analysis. This is the disciplined endgame of the response.`,
        backgroundBrief: 'Eradication requires more than a drop in alerts. The team must validate that attacker access, persistence, and trust abuse have actually been removed.',
      };
    case 'Recovery':
      return {
        title: `${phaseLabel}: Restore Trust and Service`,
        narrative: `${roundLabel}. The organization is ready to bring services fully back, but recovery now depends on more than system uptime. Leaders need confidence that ${assets} are trustworthy, that the workflows behind ${blueprint.businessProcess} can stand up to real business load, and that partner communications are aligned with what the team actually knows. ${blueprint.stakeholderPressure}.\n\nThe final challenge is to recover in a way that strengthens trust instead of merely ending the outage. The facilitator has to decide what comes back first, what validation gates must be met, and how to communicate the transition from crisis handling to disciplined follow-through.`,
        backgroundBrief: 'Recovery is about validated trust, not just restored availability. The organization should leave this phase with clear communications and near-term follow-up actions.',
      };
    default:
      return {
        title: `${phaseLabel}: Decision Point`,
        narrative: `${roundLabel}. The team faces another decision point in the response to a ${scenarioTypeLabel(blueprint.type)} affecting ${blueprint.businessProcess}.`,
        backgroundBrief: 'Continue aligning the response around evidence, continuity, and leadership priorities.',
      };
  }
}

function buildInject(
  blueprint: ScenarioBlueprint,
  phase: string,
  phaseLabel: string,
  roundNumber: number,
  totalRounds: number,
): LibraryScenarioSeed['injects'][number] {
  const story = buildNarrative(blueprint, phase, phaseLabel, roundNumber, totalRounds);
  const mitre = mitreFor(blueprint.type, phase);

  return {
    phase: phaseLabel,
    phaseOrder: roundNumber,
    injectOrder: 1,
    title: story.title,
    narrative: story.narrative,
    backgroundBrief: story.backgroundBrief,
    roleVisibility: roleVisibilityForPhase(phase),
    mitreAttackId: mitre.id,
    mitreAttackName: mitre.name,
    nistCsfFunction: nistForPhase(phase),
    options: [
      {
        text: optimalAction(blueprint, phase, phaseLabel),
        scoreWeight: 95,
        isOptimal: true,
        scriptedFeedback: feedbackForAction(blueprint, phase, 'optimal'),
        feedbackTags: ['optimal', 'best-practice', phase.toLowerCase()],
        consequences: consequenceForAction(blueprint, 'optimal'),
      },
      {
        text: acceptableAction(blueprint, phase),
        scoreWeight: 68,
        isOptimal: false,
        scriptedFeedback: feedbackForAction(blueprint, phase, 'acceptable'),
        feedbackTags: ['partial-credit', phase.toLowerCase()],
        consequences: consequenceForAction(blueprint, 'acceptable'),
      },
      {
        text: suboptimalAction(blueprint, phase),
        scoreWeight: 32,
        isOptimal: false,
        scriptedFeedback: feedbackForAction(blueprint, phase, 'suboptimal'),
        feedbackTags: ['delayed-response', phase.toLowerCase()],
        consequences: consequenceForAction(blueprint, 'suboptimal'),
      },
      {
        text: harmfulAction(blueprint, phase),
        scoreWeight: 8,
        isOptimal: false,
        scriptedFeedback: feedbackForAction(blueprint, phase, 'harmful'),
        feedbackTags: ['poor-practice', 'risk-escalation', phase.toLowerCase()],
        consequences: consequenceForAction(blueprint, 'harmful'),
      },
    ],
  };
}

function buildObjectives(blueprint: ScenarioBlueprint): string[] {
  return [
    `Practice disciplined decision-making for a ${scenarioTypeLabel(blueprint.type)} affecting ${blueprint.businessProcess}.`,
    `Protect ${joinList(blueprint.crownJewels)} while balancing operational pressure in a ${blueprint.industry} environment.`,
    `Exercise cross-functional coordination across ${responseLens(blueprint)} under realistic executive, legal, and partner pressure.`,
    `Reinforce evidence-driven containment, remediation, and recovery aligned to ${blueprint.regulatoryFocus}.`,
  ];
}

function buildDescription(blueprint: ScenarioBlueprint, totalRounds: number): string {
  return `${blueprint.orgName}, a ${blueprint.industry} organization, is forced to respond to a ${scenarioTypeLabel(blueprint.type)} that threatens ${joinList(blueprint.crownJewels)} and the workflows behind ${blueprint.businessProcess}. Over ${totalRounds} rounds, facilitators will balance technical containment, business continuity, leadership alignment, and durable recovery while ${blueprint.threatActor} pressures the organization through ${blueprint.initialVector}.`;
}

function buildOpeningScript(blueprint: ScenarioBlueprint, scenarioTitle: string, objectives: string[], phases: string[]): string {
  return `Good morning, everyone. Today we are stepping into "${scenarioTitle}," a ${scenarioTypeLabel(blueprint.type)} exercise built around ${blueprint.orgName}, a ${blueprint.industry} organization. Your job is to respond the way a real incident leadership team would respond when ${joinList(blueprint.crownJewels)} and the business processes behind ${blueprint.businessProcess} are suddenly under pressure.\n\nThis exercise unfolds across ${phases.length} rounds. Each round advances the story, introduces new facts, and forces a decision that will shape how the rest of the incident feels. I want you to stay grounded in your assigned role, explain your reasoning out loud, and make the call you would actually make if you owned the risk in front of you. We are not here to guess what sounds best in hindsight. We are here to practice disciplined judgment under pressure.\n\nKeep these learning goals in mind as we work through the scenario: ${objectives.join(' ')} The most important thing is that we stay evidence-driven, honest about tradeoffs, and aware that technical choices ripple into operations, leadership messaging, and recovery. The teams we would expect in a real response include ${responseLens(blueprint)}, and each of those lenses matters today.\n\nAs the first round opens, assume the day has already begun to tilt in the wrong direction. Something is happening inside ${blueprint.businessProcess}, and the early indicators suggest this could move quickly if the team waits too long. Let us begin with the first inject and decide what your team does when the warning signs are still fresh.`;
}

function buildRoundIntroScript(
  blueprint: ScenarioBlueprint,
  inject: LibraryScenarioSeed['injects'][number],
  roundNumber: number,
  totalRounds: number,
): string {
  return `This is round ${roundNumber} of ${totalRounds}, and the incident is now entering the ${inject.phase.toLowerCase()} stage. Here is what your team is dealing with: ${inject.narrative.split('\n\n')[0]} Think about this through your own role before you think about the options. If you are closest to operations, ask what part of ${blueprint.businessProcess} is most fragile right now. If you are looking through a security lens, ask what evidence you still need to trust before taking the next action. If you are carrying leadership, legal, or communications responsibility, ask what commitments would become hard to walk back once they are spoken out loud.\n\nBefore you decide, talk through one question together: what is the most important thing the team must protect in this moment, and what are you willing to disrupt in order to protect it? Review the options on your screen, pick the response you can defend, and be ready to explain why.`;
}

function buildRoundAfterActionScript(
  blueprint: ScenarioBlueprint,
  inject: LibraryScenarioSeed['injects'][number],
  roundNumber: number,
  totalRounds: number,
): string {
  const optimal = inject.options.find((option) => option.isOptimal) ?? inject.options[0];
  const transition = roundNumber === totalRounds
    ? 'This was the final operational round, so let this discussion set up the broader debrief.'
    : 'Hold onto that lesson because the next round will test whether the team can carry it forward under even more pressure.';

  return `Round ${roundNumber} closes with the organization still trying to protect ${joinList(blueprint.crownJewels)} while ${blueprint.operationalImpact}. Some teams will have prioritized speed, some will have prioritized certainty, and some will have tried to preserve operations above all else. That split is normal. This is where real tabletop value shows up.\n\nThe strongest move in this round was to ${optimal.text} ${optimal.scriptedFeedback} Notice that the best response was not just technical. It aligned business, legal, and operational decision-making around the same evidence. Ask yourselves what additional information would have made this decision easier, which role in the room had the most leverage at this moment, and where your own organization might struggle to coordinate as cleanly under the same pressure.\n\n${transition}`;
}

function buildClosingScript(blueprint: ScenarioBlueprint, phases: string[]): string {
  return `That concludes "${blueprint.title}," and by this point your team has walked the full arc from first discovery through ${phases[phases.length - 1].toLowerCase()}. The scenario was designed to show how quickly a ${scenarioTypeLabel(blueprint.type)} stops being a security-only problem once it begins affecting ${blueprint.businessProcess}. The pressure on ${joinList(blueprint.crownJewels)} was real, but so was the pressure on leadership messaging, partner coordination, and the ability to keep mission-critical work moving.\n\nThe main lesson is that strong teams do not wait for perfect clarity before they coordinate. They make evidence-driven decisions, protect the most critical assets first, and keep revisiting whether their technical choices still line up with business reality. In a scenario like this, organizations usually improve fastest when they tighten incident command roles, rehearse continuity playbooks for the workflows that matter most, and remove the trust assumptions that let a foothold expand.\n\nIf this were your real environment, the next thirty days should focus on closing the access path used in the exercise, validating backup and identity controls, and tightening decision playbooks for the teams represented in the room. Over the next sixty to ninety days, the organization should revisit partner dependencies such as ${blueprint.externalDependency}, pressure-test communications and legal escalation, and run another exercise that starts deeper into the scenario so the team can practice the harder recovery tradeoffs. Preparedness does not come from reading about incidents. It comes from making hard calls together before the real one arrives.`;
}

function buildStoredScript(blueprint: ScenarioBlueprint, injects: LibraryScenarioSeed['injects'], objectives: string[]): StoredFacilitatorScript {
  const phases = injects.map((inject) => inject.phase);
  const opening = buildOpeningScript(blueprint, blueprint.title, objectives, phases);
  const roundIntros: Record<string, string> = {};
  const rounds: Record<string, string> = {};

  injects.forEach((inject, index) => {
    const key = String(index + 1);
    roundIntros[key] = buildRoundIntroScript(blueprint, inject, index + 1, injects.length);
    rounds[key] = buildRoundAfterActionScript(blueprint, inject, index + 1, injects.length);
  });

  return {
    opening,
    roundIntros,
    rounds,
    closing: buildClosingScript(blueprint, phases),
  };
}

function buildScenario(blueprint: ScenarioBlueprint, createdById: string): LibraryScenarioSeed {
  const totalRounds = pickRoundCount(blueprint.id);
  const phases = BASE_PHASE_SETS[totalRounds];
  const injects = phases.map((phase, index) => {
    const phaseLabel = phaseLabelForType(blueprint.type, phase);
    return buildInject(blueprint, phase, phaseLabel, index + 1, totalRounds);
  });
  const objectives = buildObjectives(blueprint);
  const facilitatorScript = buildStoredScript(blueprint, injects, objectives);

  return {
    id: blueprint.id,
    title: blueprint.title,
    description: buildDescription(blueprint, totalRounds),
    type: blueprint.type,
    difficulty: blueprint.difficulty,
    objectives,
    mode: ScenarioMode.SCRIPTED,
    onboardingSchema: {
      version: VERSION,
      orgContext: {
        orgName: blueprint.orgName,
        industry: blueprint.industry,
        crownJewels: blueprint.crownJewels,
        rolesPresent: blueprint.responseRoles,
      },
      facilitatorScript,
    },
    isPublic: true,
    isBuiltIn: true,
    createdById,
    injects,
  };
}

export function buildLibraryScenarioSeeds(createdById: string): LibraryScenarioSeed[] {
  return BLUEPRINTS.map((blueprint) => buildScenario(blueprint, createdById));
}

export function extractStoredFacilitatorScript(raw: unknown): StoredFacilitatorScript | null {
  if (!raw || typeof raw !== 'object') return null;

  const maybeMetadata = raw as Partial<LibraryScenarioMetadata>;
  if (!maybeMetadata.facilitatorScript || typeof maybeMetadata.facilitatorScript !== 'object') {
    return null;
  }

  const facilitatorScript = maybeMetadata.facilitatorScript as Partial<StoredFacilitatorScript>;
  if (typeof facilitatorScript.opening !== 'string' || typeof facilitatorScript.closing !== 'string') {
    return null;
  }

  return {
    opening: facilitatorScript.opening,
    roundIntros: (facilitatorScript.roundIntros ?? {}) as Record<string, string>,
    rounds: (facilitatorScript.rounds ?? {}) as Record<string, string>,
    closing: facilitatorScript.closing,
  };
}

export function extractStoredOrgContext(raw: unknown): LibraryScenarioMetadata['orgContext'] | null {
  if (!raw || typeof raw !== 'object') return null;

  const maybeMetadata = raw as Partial<LibraryScenarioMetadata>;
  if (!maybeMetadata.orgContext || typeof maybeMetadata.orgContext !== 'object') {
    return null;
  }

  const orgContext = maybeMetadata.orgContext as Partial<LibraryScenarioMetadata['orgContext']>;
  if (typeof orgContext.orgName !== 'string' || typeof orgContext.industry !== 'string') {
    return null;
  }

  return {
    orgName: orgContext.orgName,
    industry: orgContext.industry,
    crownJewels: Array.isArray(orgContext.crownJewels) ? orgContext.crownJewels.filter((value): value is string => typeof value === 'string') : [],
    rolesPresent: Array.isArray(orgContext.rolesPresent) ? orgContext.rolesPresent.filter((value): value is string => typeof value === 'string') : [],
  };
}
