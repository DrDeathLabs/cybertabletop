import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { VoiceInputButton } from '../components/shared/VoiceInputButton';
import { TextQualityIndicator } from '../components/shared/TextQualityIndicator';
import { useTextQuality, type TextQualityResult } from '../hooks/useTextQuality';
import {
  Trophy,
  Users,
  BarChart2,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Download,
  Calendar,
  Hash,
  Star,
  XCircle,
  Clock,
  Target,
  Shield,
  Tag,
  MessageSquare,
  Zap,
  FileText,
  Building2,
  Activity,
  AlertCircle,
  CheckSquare,
  Lightbulb,
  Save,
  Edit3,
  TrendingUp,
  TrendingDown,
  Crosshair,
  BookOpen,
  PenLine,
  User,
  ClipboardList,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import Layout from '../components/shared/Layout';
import { useApi } from '../hooks/useApi';
import { useAuthStore } from '../stores/auth';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  role: string;
  totalScore: number;
  learningScore: number;
  speedBonusTotal: number;
}

interface Participant {
  userId: string;
  displayName: string;
  assignedRole: string;
  totalScore: number;
  learningScore: number;
  optimalCount: number;
  decisionCount: number;
}

interface MitreTechnique {
  id: string;
  name: string | null;
}

interface NistGap {
  function: string;
  avgScore: number;
  decisionCount: number;
  strength: 'strong' | 'adequate' | 'gap' | 'critical-gap';
}

interface PlayerDecision {
  playerId: string;
  playerName: string;
  playerRole: string;
  optionId: string;
  optionText: string;
  isOptimal: boolean;
  score: number;
  speedBonus: number;
  rationale: string | null;
  feedback: string;
  aiFeedback: string | null;
  feedbackTags: string[];
  consequences: string | null;
  timestamp: string;
}

interface InjectReplayOption {
  id: string;
  text: string;
  scoreWeight: number;
  isOptimal: boolean;
  scriptedFeedback: string;
  feedbackTags: string[];
  consequences: string | null;
}

interface InjectReplay {
  id: string;
  title: string;
  phase: string;
  narrative: string;
  mitreAttackId: string | null;
  mitreAttackName: string | null;
  nistCsfFunction: string | null;
  options: InjectReplayOption[];
  decisions: PlayerDecision[];
}

interface HotWash {
  overallAssessment: string;
  strengthsObserved: string;
  gapsAndImprovementAreas: string;
  rootCauses: string;
  operationalImpact: string;
  priorityActions: string;
  nextTrainingSteps: string;
  leadershipConsiderations: string;
}

interface FacilitatorScript {
  opening: string | null;
  roundIntros: Record<string, string>;
  rounds: Record<string, string>;
  closing: string | null;
}

interface DebriefData {
  sessionId: string;
  scenarioTitle: string;
  scenarioType: string;
  scenarioMode?: string;
  scenarioDescription: string;
  scenarioObjectives: string[];
  scenarioDifficulty: string | null;
  orgName: string | null;
  joinCode: string;
  date: string;
  endedAt: string | null;
  durationMinutes: number | null;
  facilitator: { displayName: string };
  playerCount: number;
  totalDecisions: number;
  optimalRate: number;
  leaderboard: LeaderboardEntry[];
  participants: Participant[];
  mitreTechniques: MitreTechnique[];
  nistGaps: NistGap[];
  injectReplays: InjectReplay[];
  facilitatorScript?: FacilitatorScript | null;
  hotWash: HotWash | null;
  aiDebriefText?: string | null;
}

interface FacilitatorScriptEntry {
  id: string;
  title: string;
  subtitle: string;
  content: string;
}

function emptyHotWash(): HotWash {
  return {
    overallAssessment: '',
    strengthsObserved: '',
    gapsAndImprovementAreas: '',
    rootCauses: '',
    operationalImpact: '',
    priorityActions: '',
    nextTrainingSteps: '',
    leadershipConsiderations: '',
  };
}

function normalizeHotWash(raw: unknown): HotWash | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;

  const overallAssessment = typeof value.overallAssessment === 'string' ? value.overallAssessment : '';
  const strengthsObserved = typeof value.strengthsObserved === 'string'
    ? value.strengthsObserved
    : (typeof value.strengths === 'string' ? value.strengths : '');
  const gapsAndImprovementAreas = typeof value.gapsAndImprovementAreas === 'string'
    ? value.gapsAndImprovementAreas
    : [value.weaknesses, value.gaps].filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).join('\n\n');
  const rootCauses = typeof value.rootCauses === 'string'
    ? value.rootCauses
    : (typeof value.unexpectedIssues === 'string' ? value.unexpectedIssues : '');
  const operationalImpact = typeof value.operationalImpact === 'string' ? value.operationalImpact : '';
  const priorityActions = typeof value.priorityActions === 'string'
    ? value.priorityActions
    : (typeof value.priorities === 'string' ? value.priorities : '');
  const nextTrainingSteps = typeof value.nextTrainingSteps === 'string'
    ? value.nextTrainingSteps
    : (typeof value.recommendations === 'string' ? value.recommendations : '');
  const leadershipConsiderations = typeof value.leadershipConsiderations === 'string' ? value.leadershipConsiderations : '';

  const normalized: HotWash = {
    overallAssessment,
    strengthsObserved,
    gapsAndImprovementAreas,
    rootCauses,
    operationalImpact,
    priorityActions,
    nextTrainingSteps,
    leadershipConsiderations,
  };

  return Object.values(normalized).some((entry) => entry.trim().length > 0) ? normalized : emptyHotWash();
}

// ─── Auto Hot Wash Generation ─────────────────────────────────────────────────

interface InjectAvg { title: string; phase: string; avg: number; count: number }

function injectsWithAvgScore(data: DebriefData): InjectAvg[] {
  const map = new Map<string, { title: string; phase: string; scores: number[] }>();
  for (const inject of data.injectReplays) {
    if (!map.has(inject.id)) map.set(inject.id, { title: inject.title, phase: inject.phase, scores: [] });
    inject.decisions.forEach(d => map.get(inject.id)!.scores.push(d.score));
  }
  return [...map.values()].map(({ title, phase, scores }) => ({
    title, phase,
    avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    count: scores.length,
  }));
}

const NIST_LABEL: Record<string, string> = {
  IDENTIFY:  'Identify (asset & risk awareness)',
  PROTECT:   'Protect (safeguards & controls)',
  DETECT:    'Detect (anomaly detection)',
  RESPOND:   'Respond (incident response)',
  RECOVER:   'Recover (restoration & continuity)',
};

const SCENARIO_TYPE_LABEL: Record<string, string> = {
  RANSOMWARE:     'Ransomware Attack',
  DATA_BREACH:    'Data Breach / PII Exfiltration',
  INSIDER_THREAT: 'Insider Threat',
  BEC:            'Business Email Compromise',
  SUPPLY_CHAIN:   'Supply Chain Compromise',
  DDoS:           'Denial of Service',
  APT:            'Advanced Persistent Threat',
  CUSTOM:         'Custom Scenario',
};

const SCENARIO_MODE_LABEL: Record<string, string> = {
  LIBRARY: 'From Library',
  AI_GENERATED: 'AI-Generated',
  AI_DRIVEN: 'AI-Driven',
};

function buildExerciseOverviewContent(data: DebriefData, phaseCount: number) {
  const scenarioLabel = SCENARIO_TYPE_LABEL[data.scenarioType] ?? data.scenarioType;
  const orgLabel = data.orgName?.trim() || 'the organization';
  const modeLabel = data.scenarioMode ? (SCENARIO_MODE_LABEL[data.scenarioMode] ?? data.scenarioMode.replace(/_/g, ' ')) : 'tabletop';
  const phaseText = `${phaseCount} phase${phaseCount !== 1 ? 's' : ''}`;
  const injectText = `${data.injectReplays.length} inject${data.injectReplays.length !== 1 ? 's' : ''}`;

  const purpose = `This exercise evaluated ${orgLabel}'s readiness to manage a ${scenarioLabel.toLowerCase()} through a ${modeLabel.toLowerCase()} tabletop exercise designed to stress coordinated decision-making, incident escalation, communications, and operational response under pressure.`;

  const contextParts: string[] = [];
  if (data.scenarioDescription?.trim()) {
    contextParts.push(data.scenarioDescription.trim());
  }
  contextParts.push(`The scenario unfolded across ${phaseText} and ${injectText}, creating a paced incident progression that required participants to interpret evolving conditions, align across stakeholder groups, and make defensible response decisions as the exercise advanced.`);
  const context = contextParts.join(' ');

  const takeaway = data.totalDecisions > 0
    ? 'Overall, the exercise provided a structured opportunity to validate current response capabilities and surface targeted improvement opportunities, with the detailed performance evidence documented in the sections that follow.'
    : 'Overall, the exercise established a structured scenario context for discussion and capability review, with the detailed supporting evidence documented in the sections that follow.';

  return { purpose, context, takeaway };
}

function buildFacilitatorScriptEntries(data: DebriefData): FacilitatorScriptEntry[] {
  const script = data.facilitatorScript;
  if (!script) return [];

  const entries: FacilitatorScriptEntry[] = [];

  if (script.opening?.trim()) {
    entries.push({
      id: 'opening',
      title: 'Opening Script',
      subtitle: 'Welcome, ground rules, and scenario framing',
      content: script.opening.trim(),
    });
  }

  data.injectReplays.forEach((inject, index) => {
    const roundNumber = index + 1;
    const roundKey = String(roundNumber);
    const intro = script.roundIntros?.[roundKey]?.trim();
    const debrief = script.rounds?.[roundKey]?.trim();
    const roundLabel = `Round ${roundNumber}: ${inject.title}`;
    const phaseLabel = inject.phase ? `${inject.phase} phase` : 'Scenario progression';

    if (intro) {
      entries.push({
        id: `round-intro-${roundKey}`,
        title: `${roundLabel} Intro`,
        subtitle: phaseLabel,
        content: intro,
      });
    }

    if (debrief) {
      entries.push({
        id: `round-aar-${roundKey}`,
        title: `${roundLabel} After Action`,
        subtitle: phaseLabel,
        content: debrief,
      });
    }
  });

  if (script.closing?.trim()) {
    entries.push({
      id: 'closing',
      title: 'Closing Script',
      subtitle: 'Exercise wrap-up, lessons learned, and next steps',
      content: script.closing.trim(),
    });
  }

  return entries;
}

function hasFacilitatorScriptEvidence(data: DebriefData): boolean {
  return buildFacilitatorScriptEntries(data).length > 0;
}

function autoHotWash(data: DebriefData): HotWash {
  const allInjects = injectsWithAvgScore(data);
  const strongInjects  = allInjects.filter(i => i.avg >= 75);
  const weakInjects    = allInjects.filter(i => i.avg < 50);
  const adequateInjects = allInjects.filter(i => i.avg >= 50 && i.avg < 75);
  const gapFunctions   = data.nistGaps.filter(g => g.strength === 'gap' || g.strength === 'critical-gap');
  const strongFunctions = data.nistGaps.filter(g => g.strength === 'strong');
  const overallRate    = data.optimalRate;
  const criticalGaps = data.nistGaps.filter(f => f.strength === 'critical-gap');
  const topPlayer = data.participants.length > 0
    ? [...data.participants].sort((a, b) => b.totalScore - a.totalScore)[0]
    : null;
  const bestInjectNames = strongInjects.slice(0, 3).map(i => `"${i.title}" (${i.avg}%)`);
  const weakInjectNames = weakInjects.slice(0, 3).map(i => `"${i.title}" (${i.phase}, ${i.avg}%)`);

  let overallAssessment = '';
  if (data.totalDecisions === 0) {
    overallAssessment = 'No decision data was recorded for this session, so overall readiness could not be fully assessed. The exercise still provided useful scenario discussion and facilitation value, but future sessions should ensure player submissions are captured so readiness conclusions can be supported by evidence.';
  } else if (overallRate >= 80) {
    overallAssessment = `The exercise indicates a strong level of response readiness, with ${overallRate}% of decisions aligning to the optimal course of action across ${data.totalDecisions} decisions. Participants demonstrated the ability to interpret evolving incident information, coordinate response actions, and sustain performance through multiple scenario phases with comparatively limited coaching.`;
  } else if (overallRate >= 60) {
    overallAssessment = `The exercise indicates a moderate but credible level of response readiness, with ${overallRate}% of decisions aligning to the optimal course of action across ${data.totalDecisions} decisions. Core incident response capability is present, but the results show enough variation in judgment and execution to justify targeted follow-on training before the team can be considered consistently reliable under pressure.`;
  } else {
    overallAssessment = `The exercise indicates that incident response readiness needs improvement, with only ${overallRate}% of decisions aligning to the optimal course of action across ${data.totalDecisions} decisions. The results suggest that key roles are not yet applying procedures consistently enough to support a confident real-world response without additional coaching, rehearsal, and playbook reinforcement.`;
  }

  const strengthsParts: string[] = [];
  if (strongFunctions.length > 0) {
    strengthsParts.push(`The team demonstrated comparatively strong capability in ${strongFunctions.map((f) => NIST_LABEL[f.function] ?? f.function).join('; ')}, indicating that these functions are better understood and more consistently executed than the rest of the response lifecycle.`);
  }
  if (bestInjectNames.length > 0) {
    strengthsParts.push(`The strongest inject performance was observed in ${bestInjectNames.join(', ')}, where participants showed clearer decision discipline and better alignment to expected response actions.`);
  }
  if (topPlayer) {
    strengthsParts.push(`Top individual performance came from ${topPlayer.displayName}${topPlayer.assignedRole ? ` (${topPlayer.assignedRole})` : ''}, whose results can be used as a positive benchmark when coaching the rest of the team.`);
  }
  if (strengthsParts.length === 0) {
    strengthsParts.push('Participants remained engaged throughout the exercise and completed the scenario flow, providing a usable foundation for follow-on coaching and process improvement.');
  }
  const strengthsObserved = strengthsParts.join(' ');

  const gapsParts: string[] = [];
  if (criticalGaps.length > 0) {
    gapsParts.push(`Critical performance gaps were identified in ${criticalGaps.map((f) => NIST_LABEL[f.function] ?? f.function).join('; ')}, where decision quality fell low enough to indicate material operational risk if the same behaviors occurred during a live incident.`);
  }
  if (gapFunctions.length > criticalGaps.length) {
    const nonCritical = gapFunctions.filter((f) => f.strength === 'gap');
    gapsParts.push(`Additional below-target performance was observed in ${nonCritical.map((f) => NIST_LABEL[f.function] ?? f.function).join('; ')}, showing that several supporting response functions remain underdeveloped even where outright failure was not observed.`);
  }
  if (weakInjectNames.length > 0) {
    gapsParts.push(`The clearest scenario-level difficulties appeared in ${weakInjectNames.join(', ')}, where participants either hesitated, selected riskier options, or missed stronger containment, communication, or recovery choices.`);
  }
  if (adequateInjects.length > 0 && weakInjects.length === 0) {
    gapsParts.push(`No inject collapsed into a severe failure mode, but ${adequateInjects.length} inject${adequateInjects.length !== 1 ? 's' : ''} remained only adequate, which means the team is still relying on baseline familiarity rather than polished execution.`);
  }
  if (gapsParts.length === 0) {
    gapsParts.push('No major improvement area clearly dominated this exercise, but maintaining and extending current performance will still require recurring scenario repetition and periodic procedure review.');
  }
  const gapsAndImprovementAreas = gapsParts.join(' ');

  const rootCauseParts: string[] = [];
  if (gapFunctions.length > 0) {
    rootCauseParts.push('The pattern of scoring suggests that the primary drivers were not isolated mistakes, but uneven procedure internalization across response functions. That usually points to stale playbooks, insufficient repetition, or unclear decision ownership during time-sensitive events.');
  }
  if (weakInjects.length > 0) {
    rootCauseParts.push('Lower-scoring injects also indicate that participants were less confident when the scenario shifted from recognition into coordinated response and consequence management, which is often a sign that cross-functional rehearsals are not happening often enough.');
  }
  if (data.participants.length > 1) {
    rootCauseParts.push('Because performance varied across participants, the exercise also suggests that knowledge and expectations are not yet distributed evenly across the team, increasing the risk that execution quality depends too heavily on a few stronger individuals.');
  }
  if (rootCauseParts.length === 0) {
    rootCauseParts.push('No dominant root cause pattern was isolated from the available data, but the results still support continued repetition, documentation review, and reinforcement of role expectations.');
  }
  const rootCauses = rootCauseParts.join(' ');

  let operationalImpact = '';
  if (data.totalDecisions === 0) {
    operationalImpact = 'Because no decision evidence was recorded, the exercise cannot support a strong operational impact estimate. In a live event, that same lack of documented decision flow would also make it harder to evaluate response quality, justify leadership actions, and improve future performance.';
  } else if (overallRate >= 75 && gapFunctions.length === 0) {
    operationalImpact = 'If this performance translated into a real incident, the organization would likely be able to stabilize the event with manageable disruption, though response speed and consistency could still be improved. The main residual risk would be uneven execution during more complex or longer-duration incidents.';
  } else {
    operationalImpact = `If the same performance pattern carried into a live incident, the organization could face delayed containment, uneven internal coordination, and a higher chance of avoidable business disruption. The combination of ${overallRate}% optimal decisions and the observed low-scoring areas suggests meaningful exposure to slower recovery timelines, leadership friction, and preventable escalation of operational impact.`;
  }

  const priorityItems: string[] = [];
  criticalGaps.forEach((f, i) => {
    priorityItems.push(`${i + 1}. Conduct targeted remediation for ${NIST_LABEL[f.function] ?? f.function} procedures, including role walkthroughs and playbook review. Owner: Incident Response Lead. Priority: Immediate.`);
  });
  weakInjects.slice(0, Math.max(0, 3 - criticalGaps.length)).forEach((inj, i) => {
    priorityItems.push(`${criticalGaps.length + i + 1}. Update the organization's response procedures, escalation criteria, and decision support guidance using lessons from "${inj.title}" so teams have clearer direction during similar incidents. Owner: Incident Response Lead.`);
  });
  if (priorityItems.length === 0) {
    priorityItems.push('1. Preserve current readiness by scheduling the next scenario at a slightly higher level of complexity and reviewing lessons learned with all participants.');
    priorityItems.push('2. Validate that current playbooks, contact trees, and decision authority references remain current and accessible.');
  }
  const priorityActions = priorityItems.join('\n');

  const trainingItems: string[] = [];
  if (gapFunctions.length > 0) {
    trainingItems.push(`Validate corrective actions for ${gapFunctions.map((f) => NIST_LABEL[f.function] ?? f.function).join('; ')} through a targeted readiness review or follow-on exercise once procedures, ownership, and supporting guidance have been updated.`);
  }
  trainingItems.push('Review the exercise findings with operational stakeholders within five business days so corrective actions, ownership, and decision expectations are clearly communicated while the scenario is still fresh.');
  if (overallRate < 70) {
    trainingItems.push('Use shorter validation drills after procedural updates are made so the organization can confirm improvement in the weakest decision areas before moving back into longer or more complex scenarios.');
  }
  if (trainingItems.length === 0) {
    trainingItems.push('Maintain a recurring exercise cadence and incrementally increase complexity to ensure current strengths remain durable.');
  }
  const nextTrainingSteps = trainingItems.join('\n');

  const leadershipItems: string[] = [];
  if (gapFunctions.length > 0) {
    leadershipItems.push('Leadership should treat the low-scoring response areas as capability development items, not just individual coaching issues, because the exercise evidence points to process and governance improvement needs.');
  }
  if (topPlayer && data.participants.length > 1) {
    leadershipItems.push(`The variance between participants suggests an opportunity for leadership to standardize expectations, reinforce role accountability, and reduce over-reliance on stronger performers such as ${topPlayer.displayName}.`);
  }
  leadershipItems.push('Management review should confirm ownership, due dates, and follow-up validation for the priority actions captured in this report so the exercise produces measurable readiness improvement rather than only discussion.');
  const leadershipConsiderations = leadershipItems.join(' ');

  return {
    overallAssessment,
    strengthsObserved,
    gapsAndImprovementAreas,
    rootCauses,
    operationalImpact,
    priorityActions,
    nextTrainingSteps,
    leadershipConsiderations,
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STRENGTH_STYLES: Record<string, { bar: string; text: string; label: string; badge: string }> = {
  strong:        { bar: 'bg-green-500',  text: 'text-green-400',  label: 'Strong',       badge: 'bg-green-500/10 text-green-400 border-green-500/30' },
  adequate:      { bar: 'bg-yellow-500', text: 'text-yellow-400', label: 'Adequate',      badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  gap:           { bar: 'bg-orange-500', text: 'text-orange-400', label: 'Gap',           badge: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  'critical-gap':{ bar: 'bg-red-500',    text: 'text-red-400',    label: 'Critical Gap',  badge: 'bg-red-500/10 text-red-400 border-red-500/30' },
};

// ─── Print CSS ────────────────────────────────────────────────────────────────

const PRINT_CSS = `
  @media print {
    @page { margin: 0.75in; size: letter; }

    html, body {
      background: white !important;
      color: #111827 !important;
      height: auto !important;
      font-family: Georgia, "Times New Roman", serif !important;
      font-size: 10.5pt !important;
      line-height: 1.45 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body > #root,
    body > #root > div,
    body > #root > div > div {
      display: block !important;
      height: auto !important;
      overflow: visible !important;
    }
    main { overflow: visible !important; height: auto !important; }

    aside, header, .no-print { display: none !important; }

    .aar-document {
      max-width: 100% !important;
      padding: 0 !important;
      margin: 0 !important;
      gap: 0 !important;
    }

    /* Cover */
    .aar-cover {
      display: block !important;
      border: none !important;
      border-bottom: 3px solid #1e3a8a !important;
      margin: 0 0 18pt !important;
      padding: 0 0 14pt !important;
      page-break-inside: avoid !important;
    }
    .aar-cover > div,
    .aar-cover > div > div:first-child {
      display: block !important;
    }
    .aar-cover .p-3 {
      display: none !important;
    }
    .aar-cover-title {
      font-size: 22pt !important;
      font-weight: 700 !important;
      line-height: 1.2 !important;
      color: #0f172a !important;
      margin: 0 0 4pt !important;
    }
    .aar-cover-sub {
      font-size: 10.5pt !important;
      text-transform: uppercase !important;
      letter-spacing: 0.06em !important;
      color: #1e3a8a !important;
    }
    .aar-cover-meta {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8pt 18pt !important;
      margin-top: 12pt !important;
      padding-top: 10pt !important;
      border-top: 1px solid #cbd5e1 !important;
      color: #334155 !important;
    }
    .aar-cover-meta span {
      display: block !important;
      font-size: 9pt !important;
      line-height: 1.4 !important;
    }

    /* Management approvals — show only in print */
    .management-approval {
      display: block !important;
      margin-top: 24pt !important;
      page-break-before: always !important;
      page-break-inside: avoid !important;
      border: 1px solid #cbd5e1 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
    }

    /* Textareas become document text */
    .hot-wash-section textarea {
      border: none !important;
      resize: none !important;
      background: transparent !important;
      color: #111827 !important;
      padding: 0 !important;
      font-size: 10pt !important;
      height: auto !important;
      overflow: visible !important;
    }
    .hot-wash-save-bar { display: none !important; }

    /* Section layout */
    .aar-section {
      background: white !important;
      border: 1px solid #cbd5e1 !important;
      border-radius: 0 !important;
      padding: 14pt 16pt !important;
      margin: 0 0 14pt !important;
      break-inside: auto !important;
      page-break-inside: auto !important;
      box-shadow: none !important;
    }
    .aar-section-header {
      display: flex !important;
      gap: 10pt !important;
      align-items: flex-start !important;
      margin: 0 0 10pt !important;
      padding-bottom: 6pt !important;
      border-bottom: 1px solid #cbd5e1 !important;
    }
    .aar-section-number-wrap {
      display: block !important;
    }
    .aar-section-number-badge {
      width: 20pt !important;
      height: 20pt !important;
      border-radius: 9999px !important;
      border: 1px solid #93c5fd !important;
      background: #eff6ff !important;
    }
    .aar-section-number {
      color: #1d4ed8 !important;
      font-size: 9pt !important;
      font-weight: 700 !important;
    }
    .aar-section-icon {
      display: none !important;
    }
    .aar-section-title {
      font-size: 14pt !important;
      line-height: 1.25 !important;
      color: #0f172a !important;
      font-weight: 700 !important;
      margin: 0 !important;
    }
    .aar-section-sub {
      font-size: 8.5pt !important;
      color: #64748b !important;
      margin-top: 2pt !important;
    }

    /* Summary metrics */
    .aar-stat-card {
      background: #f8fafc !important;
      border: 1px solid #cbd5e1 !important;
      border-radius: 0 !important;
      padding: 10pt 8pt !important;
      gap: 2pt !important;
      min-height: 72pt !important;
      page-break-inside: avoid !important;
    }
    .aar-stat-icon { display: none !important; }
    .aar-stat-label {
      font-size: 8pt !important;
      text-transform: uppercase !important;
      letter-spacing: 0.05em !important;
      color: #64748b !important;
    }
    .aar-stat-value {
      font-size: 16pt !important;
      color: #0f172a !important;
    }
    .aar-stat-sub {
      font-size: 8pt !important;
      color: #64748b !important;
    }

    /* Tables */
    .aar-table {
      width: 100% !important;
      border-collapse: collapse !important;
      font-size: 9pt !important;
    }
    .aar-table thead th {
      background: #f8fafc !important;
      color: #334155 !important;
      border-top: 1px solid #94a3b8 !important;
      border-bottom: 1px solid #94a3b8 !important;
      padding: 7pt 8pt !important;
      font-weight: 700 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.04em !important;
    }
    .aar-table tbody td {
      color: #111827 !important;
      border-bottom: 1px solid #e2e8f0 !important;
      padding: 7pt 8pt !important;
      vertical-align: top !important;
    }
    .aar-table tbody tr:nth-child(even) td {
      background: #fcfdff !important;
    }

    /* Content cards */
    .inject-content { display: block !important; }
    .inject-card,
    .aar-training-card,
    .aar-stat-card {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .inject-card,
    .aar-training-card {
      background: white !important;
      border: 1px solid #cbd5e1 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
    }
    .inject-card button {
      background: #f8fafc !important;
      border-bottom: 1px solid #cbd5e1 !important;
    }
    .aar-training-badge {
      background: #eff6ff !important;
      color: #1d4ed8 !important;
      border-color: #bfdbfe !important;
    }
    .aar-training-content {
      background: white !important;
      border-color: #dbeafe !important;
    }

    /* Generic color normalization */
    .text-white { color: #0f172a !important; }
    [class*="text-slate-1"] { color: #111827 !important; }
    [class*="text-slate-2"] { color: #1f2937 !important; }
    [class*="text-slate-3"] { color: #334155 !important; }
    [class*="text-slate-4"] { color: #475569 !important; }
    [class*="text-slate-5"], [class*="text-slate-6"] { color: #64748b !important; }
    [class*="border-slate"] { border-color: #cbd5e1 !important; }
    [class*="divide-slate"] > :not(:first-child) { border-color: #e2e8f0 !important; }
    [class*="bg-slate-8"], [class*="bg-slate-7"], [class*="bg-slate-9"] { background: white !important; }
    [class*="bg-blue-500/"] { background: #eff6ff !important; }
    [class*="bg-green-500/"] { background: #f0fdf4 !important; }
    [class*="bg-red-500/"] { background: #fef2f2 !important; }
    [class*="bg-yellow-500/"] { background: #fefce8 !important; }
    [class*="bg-orange-500/"] { background: #fff7ed !important; }

    * {
      box-shadow: none !important;
      transition: none !important;
      animation: none !important;
    }
  }
`;

// ─── CSV Export ───────────────────────────────────────────────────────────────

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val).replace(/"/g, '""');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
}

function buildCsv(data: DebriefData, hotWash: HotWash): string {
  const rows: string[] = [];
  const row     = (...cols: unknown[]) => rows.push(cols.map(csvEscape).join(','));
  const blank   = () => rows.push('');
  const heading = (h: string) => rows.push(`# ${h}`);
  const facilitatorScriptEntries = buildFacilitatorScriptEntries(data);
  const overview = buildExerciseOverviewContent(data, new Set(data.injectReplays.map((inject) => inject.phase)).size);

  heading('EXERCISE OVERVIEW');
  row('Scenario',         data.scenarioTitle);
  row('Type',             SCENARIO_TYPE_LABEL[data.scenarioType] ?? data.scenarioType);
  row('Exercise Format',  data.scenarioMode ? (SCENARIO_MODE_LABEL[data.scenarioMode] ?? data.scenarioMode.replace(/_/g, ' ')) : '');
  row('Difficulty',       data.scenarioDifficulty ?? '');
  row('Organization',     data.orgName ?? '');
  row('Join Code',        data.joinCode);
  row('Facilitator',      data.facilitator.displayName);
  row('Date',             new Date(data.date).toLocaleString());
  if (data.endedAt) row('Ended', new Date(data.endedAt).toLocaleString());
  if (data.durationMinutes !== null) row('Duration (min)', data.durationMinutes);
  row('Players',          data.playerCount);
  row('Total Decisions',  data.totalDecisions);
  row('Optimal Rate',     `${data.optimalRate}%`);
  row('Purpose',          overview.purpose);
  row('Scenario Context', overview.context);
  row('Executive Takeaway', overview.takeaway);
  blank();

  if (data.aiDebriefText || data.scenarioMode === 'AI_DRIVEN') {
    heading('EXERCISE PERFORMANCE ASSESSMENT');
    row('Assessment', data.aiDebriefText ?? 'Exercise performance assessment not yet generated.');
    blank();
  }

  heading('PERFORMANCE SUMMARY');
  row('Metric', 'Value', 'Notes');
  row('Date', new Date(data.date).toLocaleDateString(), '');
  row('Players', data.playerCount, '');
  row('Total Decisions', data.totalDecisions, '');
  row('Optimal Rate', `${data.optimalRate}%`, 'correct choices');
  row('Top Score', data.leaderboard[0]?.totalScore ?? 0, data.leaderboard[0]?.displayName ?? '');
  blank();

  if (data.nistGaps.length > 0 || data.mitreTechniques.length > 0) {
    heading('NIST CSF PERFORMANCE & MITRE ATT&CK SUMMARY');
  }

  if (data.nistGaps.length > 0) {
    row('NIST Function', 'Avg Score (%)', 'Decision Count', 'Assessment');
    for (const g of data.nistGaps) {
      row(g.function, g.avgScore, g.decisionCount, STRENGTH_STYLES[g.strength]?.label ?? g.strength);
    }
    blank();
  }

  if (data.mitreTechniques.length > 0) {
    row('MITRE Technique ID', 'Technique Name');
    for (const t of data.mitreTechniques) row(t.id, t.name ?? '');
    blank();
  }

  heading('PARTICIPANTS');
  row('Name', 'Assigned Role', 'Decisions Made', 'Optimal Decisions', 'Optimal Rate', 'Total Score', 'Learning Score');
  for (const p of data.participants) {
    const rate = p.decisionCount > 0 ? Math.round((p.optimalCount / p.decisionCount) * 100) : 0;
    row(p.displayName, p.assignedRole, p.decisionCount, p.optimalCount, `${rate}%`, p.totalScore, p.learningScore);
  }
  blank();

  heading('LEADERBOARD');
  row('Rank', 'Name', 'Role', 'Total Score', 'Learning Score', 'Speed Bonus');
  for (const e of data.leaderboard) {
    row(e.rank, e.displayName, e.role, e.totalScore, e.learningScore, e.speedBonusTotal);
  }
  blank();

  heading('SCENARIO WALKTHROUGH');
  row(
    'Inject', 'Phase', 'MITRE ATT&CK', 'NIST Function',
    'Player', 'Role', 'Decision', 'Optimal', 'Base Score', 'Speed Bonus', 'Total',
    'Rationale', 'Feedback', 'Tags', 'Consequences', 'Timestamp',
  );
  for (const inject of data.injectReplays) {
    for (const d of inject.decisions) {
      row(
        inject.title, inject.phase,
        inject.mitreAttackId ?? '', inject.nistCsfFunction ?? '',
        d.playerName, d.playerRole, d.optionText,
        d.isOptimal ? 'Yes' : 'No',
        d.score, d.speedBonus, d.score + d.speedBonus,
        d.rationale ?? '', d.feedback,
        (d.feedbackTags ?? []).join('; '), d.consequences ?? '',
        new Date(d.timestamp).toLocaleString(),
      );
    }
  }
  blank();

  if (facilitatorScriptEntries.length > 0) {
    heading('INSTRUCTOR SCRIPT EVIDENCE');
    row('Section', 'Context', 'Script');
    for (const entry of facilitatorScriptEntries) {
      row(entry.title, entry.subtitle, entry.content);
    }
    blank();
  }

  heading('POST-EXERCISE ANALYSIS');
  row('Section', 'Content');
  row('Overall Readiness Assessment', hotWash.overallAssessment);
  row('Strengths Observed', hotWash.strengthsObserved);
  row('Gaps and Improvement Areas', hotWash.gapsAndImprovementAreas);
  row('Root Causes and Contributing Factors', hotWash.rootCauses);
  row('Likely Operational Impact', hotWash.operationalImpact);
  row('Priority Improvement Actions', hotWash.priorityActions);
  row('Recommended Next Training Steps', hotWash.nextTrainingSteps);
  row('Leadership Considerations', hotWash.leadershipConsiderations);
  blank();

  heading('MANAGEMENT REVIEW AND APPROVALS');
  row('Approver Role', 'Signature', 'Printed Name & Title', 'Date');
  row('Facilitator / Exercise Director', '', '', '');
  row('Chief Information Security Officer (CISO)', '', '', '');
  row('Incident Response Lead', '', '', '');

  return rows.join('\n');
}

function exportCsv(data: DebriefData, hotWash: HotWash) {
  const csv = buildCsv(data, hotWash);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date(data.date).toISOString().slice(0, 10);
  a.href = url;
  a.download = `aar-${data.scenarioTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub }: {
  icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string;
}) {
  return (
    <div className="aar-stat-card bg-slate-800 border border-slate-700/50 rounded-xl p-4 flex flex-col items-center text-center gap-1">
      <div className="aar-stat-icon mb-1 text-blue-400">{icon}</div>
      <p className="aar-stat-label text-xs text-slate-500">{label}</p>
      <p className="aar-stat-value text-xl font-bold text-white leading-none">{value}</p>
      {sub && <p className="aar-stat-sub text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionHeader({ icon, title, number, sub }: {
  icon: React.ReactNode; title: string; number: number; sub?: string;
}) {
  return (
    <div className="aar-section-header flex items-start gap-3 mb-4">
      <div className="aar-section-number-wrap flex flex-col items-center gap-1">
        <div className="aar-section-number-badge w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center flex-shrink-0">
          <span className="aar-section-number text-xs font-bold text-blue-400">{number}</span>
        </div>
      </div>
      <div className="aar-section-heading">
        <div className="flex items-center gap-2">
          <span className="aar-section-icon text-blue-400">{icon}</span>
          <h2 className="aar-section-title text-base font-bold text-white">{title}</h2>
        </div>
        {sub && <p className="aar-section-sub text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function FacilitatorScriptCard({ entry }: { entry: FacilitatorScriptEntry }) {
  return (
    <div className="aar-training-card bg-slate-800 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="aar-training-title text-sm font-semibold text-white">{entry.title}</h3>
          <p className="aar-training-sub text-xs text-slate-500 mt-1">{entry.subtitle}</p>
        </div>
        <div className="aar-training-badge flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-2.5 py-1">
          <BookOpen className="w-3 h-3" />
          Training Evidence
        </div>
      </div>
      <div className="aar-training-content bg-slate-900/60 border border-slate-700/40 rounded-lg px-4 py-3">
        <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{entry.content}</p>
      </div>
    </div>
  );
}

function NistBar({ item }: { item: NistGap }) {
  const style = STRENGTH_STYLES[item.strength] ?? STRENGTH_STYLES.adequate;
  const pct = Math.min(100, Math.max(0, item.avgScore));
  return (
    <div className="flex items-center gap-4">
      <div className="w-40 flex-shrink-0">
        <p className="text-sm text-slate-300 font-medium">{item.function}</p>
        <p className="text-xs text-slate-600">{item.decisionCount} decision{item.decisionCount !== 1 ? 's' : ''}</p>
      </div>
      <div className="flex-1">
        <div className="w-full bg-slate-900 rounded-full h-2.5">
          <div className={`h-2.5 rounded-full transition-all duration-700 ${style.bar}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="w-28 flex-shrink-0 flex items-center justify-between gap-2">
        <span className="text-sm text-slate-400 font-mono">{item.avgScore}%</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${style.badge}`}>{style.label}</span>
      </div>
    </div>
  );
}

function InjectReplayCard({ inject, participants }: { inject: InjectReplay; participants: Participant[] }) {
  const [expanded, setExpanded] = useState(false);
  const participantResponses = participants.map((participant) => ({
    participant,
    decision: inject.decisions.find((entry) => entry.playerId === participant.userId) ?? null,
  }));
  const optimalCount = participantResponses.filter(({ decision }) => decision?.isOptimal).length;
  const recommendedOption = inject.options.find((option) => option.isOptimal) ?? null;
  const missingResponses = participantResponses.filter(({ decision }) => !decision).length;
  const incorrectCounts = new Map<string, number>();
  inject.decisions
    .filter((decision) => !decision.isOptimal)
    .forEach((decision) => incorrectCounts.set(decision.optionId, (incorrectCounts.get(decision.optionId) ?? 0) + 1));
  const mostCommonIncorrectOptionId = [...incorrectCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const mostCommonIncorrectOption = mostCommonIncorrectOptionId
    ? inject.options.find((option) => option.id === mostCommonIncorrectOptionId) ?? null
    : null;

  return (
    <div className="inject-card bg-slate-900/60 border border-slate-700/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-700/20 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 uppercase flex-shrink-0">
            {inject.phase}
          </span>
          <span className="text-sm font-semibold text-slate-200 truncate">{inject.title}</span>
          {inject.mitreAttackId && (
            <span className="hidden sm:inline text-xs font-mono bg-slate-800 text-slate-500 px-2 py-0.5 rounded border border-slate-700 flex-shrink-0">
              {inject.mitreAttackId}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          <span className="text-xs text-slate-500">
            <span className="text-green-400 font-medium">{optimalCount}</span>
            <span className="text-slate-600">/{participantResponses.length}</span>
            <span className="text-slate-500 ml-1">selected recommended</span>
          </span>
          {expanded
            ? <ChevronDown className="no-print w-4 h-4 text-slate-500" />
            : <ChevronRight className="no-print w-4 h-4 text-slate-500" />}
        </div>
      </button>

      <div className={`inject-content border-t border-slate-700/50${expanded ? '' : ' hidden'}`}>
        {inject.narrative && (
          <div className="px-5 py-4 bg-slate-800/40 border-b border-slate-700/30">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Scenario</span>
              {inject.nistCsfFunction && (
                <span className="ml-auto text-xs text-slate-600 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                  {inject.nistCsfFunction}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{inject.narrative}</p>
            {inject.mitreAttackName && (
              <p className="text-xs text-slate-500 mt-2">
                MITRE ATT&CK: <span className="font-mono">{inject.mitreAttackId}</span> — {inject.mitreAttackName}
              </p>
            )}
          </div>
        )}
        <div className="px-5 py-4 space-y-5">
          {inject.options.length > 0 && (
            <div className="rounded-xl border border-slate-700/40 bg-slate-800/50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-semibold text-slate-200">Available Responses</span>
                </div>
                {recommendedOption && (
                  <span className="text-[11px] uppercase tracking-wider text-green-300 bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-1">
                    Recommended response highlighted
                  </span>
                )}
              </div>
              <div className="p-4 space-y-3">
                {inject.options.map((option, index) => {
                  const selectedCount = inject.decisions.filter((decision) => decision.optionId === option.id).length;
                  return (
                    <div
                      key={option.id}
                      className={`rounded-xl border p-4 space-y-2 ${option.isOptimal ? 'bg-green-500/5 border-green-500/20' : 'bg-slate-800/60 border-slate-700/40'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-400">{String.fromCharCode(65 + index)}.</span>
                            <span className="text-sm font-semibold text-slate-100">{option.text}</span>
                            {option.isOptimal && (
                              <span className="text-[11px] uppercase tracking-wider text-green-300 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">
                                Recommended
                              </span>
                            )}
                            {!option.isOptimal && mostCommonIncorrectOption?.id === option.id && (
                              <span className="text-[11px] uppercase tracking-wider text-orange-300 bg-orange-500/10 border border-orange-500/20 rounded-full px-2 py-0.5">
                                Most common miss
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">{option.scriptedFeedback}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-slate-500">Score</p>
                          <p className="text-sm font-bold text-white">{option.scoreWeight}</p>
                          <p className="text-[11px] text-slate-500 mt-1">{selectedCount} selected</p>
                        </div>
                      </div>
                      {option.consequences && (
                        <div className="bg-slate-950/40 rounded-lg px-3 py-2 border border-slate-700/30">
                          <p className="text-xs text-slate-500 font-medium mb-0.5">Expected consequence</p>
                          <p className="text-xs text-slate-400 leading-relaxed">{option.consequences}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-700/40 bg-slate-800/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-slate-200">Participant Responses</span>
              </div>
              <span className="text-xs text-slate-500">{missingResponses} without response</span>
            </div>
            <div className="p-4 space-y-3">
              {participantResponses.map(({ participant, decision }) => (
                <div
                  key={`${inject.id}-${participant.userId}`}
                  className={`rounded-xl border p-4 space-y-2 ${
                    decision
                      ? (decision.isOptimal ? 'bg-green-500/5 border-green-500/25' : 'bg-red-500/5 border-red-500/25')
                      : 'bg-slate-900/30 border-dashed border-slate-700/60'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      {decision
                        ? (decision.isOptimal
                            ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                            : <XCircle className="w-4 h-4 text-slate-600 flex-shrink-0" />)
                        : <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />}
                      <span className="text-sm font-semibold text-slate-100">{participant.displayName}</span>
                    </div>
                    {participant.assignedRole && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 border border-slate-600">
                        {participant.assignedRole}
                      </span>
                    )}
                    {decision && (
                      <span
                        className={`text-[11px] uppercase tracking-wider rounded-full px-2.5 py-1 border ${
                          decision.isOptimal
                            ? 'text-green-300 bg-green-500/10 border-green-500/20'
                            : 'text-red-300 bg-red-500/10 border-red-500/20'
                        }`}
                      >
                        {decision.isOptimal ? 'Correct response' : 'Incorrect response'}
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-2 text-xs">
                      {decision ? (
                        <>
                          {decision.speedBonus > 0 && (
                            <span className="flex items-center gap-1 text-yellow-400">
                              <Zap className="w-3 h-3" />+{decision.speedBonus}
                            </span>
                          )}
                          <span className="text-slate-500">Score earned</span>
                          <span className={`font-bold text-sm ${decision.isOptimal ? 'text-green-300' : 'text-red-300'}`}>
                            +{decision.score + decision.speedBonus}
                          </span>
                        </>
                      ) : (
                        <span className="text-yellow-400 font-medium">No response submitted</span>
                      )}
                    </div>
                  </div>
                  {decision ? (
                    <>
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className={`rounded-lg border px-3 py-2 ${decision.isOptimal ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                          <p className={`text-xs mb-1 ${decision.isOptimal ? 'text-green-300' : 'text-red-300'}`}>Selected response</p>
                          <p className="text-sm text-slate-200 leading-relaxed">{decision.optionText}</p>
                        </div>
                        {recommendedOption && (
                          <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2">
                            <p className="text-xs text-green-300 mb-1">Recommended response</p>
                            <p className="text-sm text-slate-200 leading-relaxed">{recommendedOption.text}</p>
                          </div>
                        )}
                      </div>
                      {decision.rationale && (
                        <div className="flex items-start gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Participant rationale</p>
                            <p className="text-xs text-slate-400 italic leading-relaxed">"{decision.rationale}"</p>
                          </div>
                        </div>
                      )}
                      {decision.feedback && (
                        <div className={`rounded-lg border px-3 py-2 ${decision.isOptimal ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                          <p className={`text-xs mb-1 ${decision.isOptimal ? 'text-green-300' : 'text-red-300'}`}>
                            {decision.isOptimal ? 'Why this was recommended' : 'Why this was not recommended'}
                          </p>
                          <p className="text-xs text-slate-300 leading-relaxed">{decision.feedback}</p>
                        </div>
                      )}
                      {decision.consequences && (
                        <div className="bg-slate-900/60 rounded-lg px-3 py-2 border border-slate-700/40">
                          <p className="text-xs text-slate-500 font-medium mb-0.5">Observed consequence</p>
                          <p className="text-xs text-slate-400 leading-relaxed">{decision.consequences}</p>
                        </div>
                      )}
                      {decision.feedbackTags?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {decision.feedbackTags.map((tag) => (
                            <span key={tag} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <Tag className="w-2.5 h-2.5" />{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-slate-500 leading-relaxed">
                      This participant did not submit a response for this inject, which should be considered when reviewing team-wide performance evidence.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 px-4 py-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Inject Summary</p>
            <p className="text-sm text-slate-300 leading-relaxed">
              {recommendedOption
                ? `${optimalCount} of ${participantResponses.length} participant${participantResponses.length !== 1 ? 's' : ''} selected the recommended response.`
                : `${inject.decisions.length} response${inject.decisions.length !== 1 ? 's were' : ' was'} recorded for this inject.`}
              {mostCommonIncorrectOption ? ` The most common non-recommended choice was "${mostCommonIncorrectOption.text}".` : ''}
              {missingResponses > 0 ? ` ${missingResponses} participant${missingResponses !== 1 ? 's did' : ' did'} not submit a response.` : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hot Wash Editor ──────────────────────────────────────────────────────────

const HOT_WASH_FIELDS: Array<{
  key: keyof HotWash;
  label: string;
  icon: React.ReactNode;
  color: string;
  hint: string;
}> = [
  { key: 'overallAssessment', label: 'Overall Readiness Assessment',         icon: <Activity className="w-4 h-4" />,      color: 'text-blue-400',   hint: 'A concise executive summary of how prepared the team appears overall based on the exercise evidence.' },
  { key: 'strengthsObserved', label: 'Strengths Observed',                   icon: <TrendingUp className="w-4 h-4" />,    color: 'text-green-400',  hint: 'What the team demonstrated well, tied to concrete capabilities, roles, or stronger phases of the exercise.' },
  { key: 'gapsAndImprovementAreas', label: 'Gaps and Improvement Areas',     icon: <TrendingDown className="w-4 h-4" />,  color: 'text-orange-400', hint: 'Where the team fell short and what response capability needs to be strengthened.' },
  { key: 'rootCauses',        label: 'Root Causes and Contributing Factors', icon: <AlertCircle className="w-4 h-4" />,   color: 'text-yellow-400', hint: 'Why the gaps likely occurred, such as unclear ownership, stale playbooks, insufficient rehearsal, or coordination friction.' },
  { key: 'operationalImpact', label: 'Likely Operational Impact',            icon: <Crosshair className="w-4 h-4" />,     color: 'text-red-400',    hint: 'What these observed gaps would likely mean in a real incident for containment, coordination, business disruption, or recovery.' },
  { key: 'priorityActions',   label: 'Priority Improvement Actions',         icon: <CheckSquare className="w-4 h-4" />,   color: 'text-cyan-400',   hint: 'The most important corrective actions, ideally with owner roles and urgency.' },
  { key: 'nextTrainingSteps', label: 'Recommended Next Training Steps',      icon: <Lightbulb className="w-4 h-4" />,     color: 'text-purple-400', hint: 'Follow-on tabletop, workshop, or drill recommendations that would most directly improve the weak areas.' },
  { key: 'leadershipConsiderations', label: 'Leadership Considerations',     icon: <Building2 className="w-4 h-4" />,     color: 'text-amber-400',  hint: 'Executive-level implications such as governance, staffing, tooling, policy, or management follow-through needed after the exercise.' },
];

function HotWashEditor({
  hotWash,
  onChange,
  onSave,
  onRegenerate,
  saving,
  saved,
  dirty,
  regenerating,
  canEdit,
}: {
  hotWash: HotWash;
  onChange: (field: keyof HotWash, value: string) => void;
  onSave: () => void;
  onRegenerate: () => void;
  saving: boolean;
  saved: boolean;
  dirty: boolean;
  regenerating: boolean;
  canEdit: boolean;
}) {
  const { check, isChecking } = useTextQuality();
  const [checkingField, setCheckingField] = useState<keyof HotWash | null>(null);
  const [qualityResults, setQualityResults] = useState<Partial<Record<keyof HotWash, TextQualityResult>>>({});

  const handleCheckField = async (field: keyof HotWash) => {
    const text = hotWash[field];
    if (!text?.trim()) return;
    setCheckingField(field);
    const result = await check({ text, fieldType: 'hot-wash' });
    if (result) setQualityResults(r => ({ ...r, [field]: result }));
    setCheckingField(null);
  };

  const clearFieldResult = (field: keyof HotWash) => {
    setQualityResults(r => { const n = { ...r }; delete n[field]; return n; });
  };

  return (
    <div className="hot-wash-section space-y-4">
      {HOT_WASH_FIELDS.map(({ key, label, icon, color, hint }) => (
        <div key={key} className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className={`flex items-center gap-2 px-4 py-3 border-b border-slate-700/40 bg-slate-800`}>
            <span className={color}>{icon}</span>
            <span className="text-sm font-semibold text-slate-200">{label}</span>
          </div>
          <div className="p-4">
            {canEdit ? (
              <>
                <p className="text-xs text-slate-500 mb-2">{hint}</p>
                <div className="relative">
                  <textarea
                    value={hotWash[key]}
                    onChange={(e) => { onChange(key, e.target.value); clearFieldResult(key); }}
                    rows={key === 'overallAssessment' || key === 'strengthsObserved' ? 4 : 6}
                    disabled={regenerating}
                    className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2.5 pr-10 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/60 resize-y leading-relaxed disabled:opacity-50"
                    placeholder={`Enter ${label.toLowerCase()}…`}
                  />
                  <div className="absolute right-2 bottom-2">
                    <VoiceInputButton
                      size="sm"
                      onTranscript={t => { onChange(key, hotWash[key] + (hotWash[key] ? ' ' : '') + t); clearFieldResult(key); }}
                    />
                  </div>
                </div>
                {hotWash[key].trim().length > 20 && (
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={() => handleCheckField(key)}
                      disabled={checkingField === key || isChecking}
                      className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40 transition-colors"
                    >
                      {checkingField === key ? 'Checking…' : 'Check quality'}
                    </button>
                  </div>
                )}
                <TextQualityIndicator
                  result={qualityResults[key] ?? null}
                  isChecking={checkingField === key}
                  onAcceptRevision={t => { onChange(key, t); clearFieldResult(key); }}
                  onDismiss={() => clearFieldResult(key)}
                />
              </>
            ) : (
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {hotWash[key] || <span className="text-slate-600 italic">Not recorded.</span>}
              </p>
            )}
          </div>
        </div>
      ))}

      {canEdit && (
        <div className="hot-wash-save-bar flex items-center justify-between gap-4 pt-2">
          <p className="text-xs text-slate-500">
            {regenerating ? (
              <span className="text-purple-400 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating with AI…
              </span>
            ) : saved && !dirty ? (
              <span className="text-green-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Saved</span>
            ) : dirty ? (
              <span className="text-yellow-400">Unsaved changes</span>
            ) : (
              <span>Auto-generated from session data — edit to refine the post-exercise analysis</span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onRegenerate}
              disabled={saving || regenerating}
              title="Generate post-exercise analysis content using AI"
              className="flex items-center gap-2 bg-purple-600/80 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg px-3 py-2 transition-colors text-sm border border-purple-500/40"
            >
              {regenerating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                : <><Sparkles className="w-4 h-4" /> AI Generate</>
              }
            </button>
            <button
              onClick={onSave}
              disabled={saving || !dirty || regenerating}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-2 transition-colors text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Analysis'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DebriefPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { get, put }  = useApi();
  const currentUser   = useAuthStore((s) => s.user);

  const [data,                setData]                = useState<DebriefData | null>(null);
  const [loading,             setLoading]             = useState(true);
  const [error,               setError]               = useState('');
  const [hotWash,             setHotWash]             = useState<HotWash | null>(null);
  const [hotWashDirty,        setHotWashDirty]        = useState(false);
  const [hotWashSaving,       setHotWashSaving]       = useState(false);
  const [hotWashSaved,        setHotWashSaved]        = useState(false);
  const [hotWashRegenerating, setHotWashRegenerating] = useState(false);
  const [aiDebriefText,       setAiDebriefText]       = useState<string | null>(null);
  const [aiDebriefRegenerating, setAiDebriefRegenerating] = useState(false);
  const [pdfDownloading,      setPdfDownloading]      = useState(false);
  const [wordDownloading,     setWordDownloading]     = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    get<DebriefData>(`/api/sessions/${sessionId}/debrief`)
      .then((d) => {
        setData(d);
        const normalizedHotWash = normalizeHotWash(d.hotWash) ?? autoHotWash(d);
        setHotWash(normalizedHotWash);
        setHotWashSaved(!!d.hotWash);
        if (d.aiDebriefText) setAiDebriefText(d.aiDebriefText);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [sessionId, get]);

  // ── Unsaved changes guard (3 layers, all compatible with BrowserRouter) ──

  // Layer 1: browser close / hard refresh
  useEffect(() => {
    const handle = (e: BeforeUnloadEvent) => { if (hotWashDirty) e.preventDefault(); };
    window.addEventListener('beforeunload', handle);
    return () => window.removeEventListener('beforeunload', handle);
  }, [hotWashDirty]);

  // Layer 2: browser back / forward buttons
  useEffect(() => {
    if (!hotWashDirty) return;
    // Push a dummy entry so the first back-press fires popstate instead of leaving
    window.history.pushState(null, '', window.location.pathname);
    const handle = () => {
      const ok = window.confirm('You have unsaved Post-Exercise Analysis changes.\n\nLeave without saving?');
      if (ok) {
        window.history.back(); // let the navigation proceed
      } else {
        // Re-push to keep the guard in place
        window.history.pushState(null, '', window.location.pathname);
      }
    };
    window.addEventListener('popstate', handle);
    return () => window.removeEventListener('popstate', handle);
  }, [hotWashDirty]);

  // Layer 3: in-app React Router link clicks (sidebar nav, breadcrumbs, etc.)
  useEffect(() => {
    if (!hotWashDirty) return;
    const handle = (e: MouseEvent) => {
      const a = (e.target as Element).closest('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute('href') ?? '';
      // Only intercept internal / relative links
      if (href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:') || href === '#') return;
      const ok = window.confirm('You have unsaved Post-Exercise Analysis changes.\n\nLeave without saving?');
      if (!ok) { e.preventDefault(); e.stopPropagation(); }
    };
    document.addEventListener('click', handle, { capture: true });
    return () => document.removeEventListener('click', handle, { capture: true });
  }, [hotWashDirty]);

  const handleHotWashChange = useCallback((field: keyof HotWash, value: string) => {
    setHotWash((prev) => prev ? { ...prev, [field]: value } : prev);
    setHotWashDirty(true);
    setHotWashSaved(false);
  }, []);

  const saveHotWash = useCallback(async () => {
    if (!hotWash || !sessionId) return;
    setHotWashSaving(true);
    try {
      await put(`/api/sessions/${sessionId}/hot-wash`, hotWash);
      setHotWashSaved(true);
      setHotWashDirty(false);
    } catch {
      // keep dirty state if save fails
    } finally {
      setHotWashSaving(false);
    }
  }, [hotWash, sessionId, put]);

  const regenerateHotWash = useCallback(async () => {
    if (!sessionId) return;
    setHotWashRegenerating(true);
    try {
      const result = await (
        fetch(`/api/sessions/${sessionId}/hot-wash/generate`, {
          method: 'POST',
          credentials: 'include',
        }).then((r) => r.json()) as Promise<{ hotWash: HotWash; provider: string }>
      );
      if (result.hotWash) {
        setHotWash(result.hotWash);
        setHotWashDirty(true);
        setHotWashSaved(false);
      }
    } catch {
      // silently fall back — user still has previous content
    } finally {
      setHotWashRegenerating(false);
    }
  }, [sessionId]);

  const regenerateAIDebrief = useCallback(async () => {
    if (!sessionId) return;
    setAiDebriefRegenerating(true);
    try {
      const result = await (
        fetch(`/api/sessions/${sessionId}/ai-debrief`, {
          method: 'POST',
          credentials: 'include',
        }).then((r) => r.json()) as Promise<{ aiDebriefText: string }>
      );
      if (result.aiDebriefText) setAiDebriefText(result.aiDebriefText);
    } catch {
      // silently fail
    } finally {
      setAiDebriefRegenerating(false);
    }
  }, [sessionId]);

  const handleDownloadPdf = useCallback(async () => {
    if (!sessionId || !data) return;
    setPdfDownloading(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/debrief/pdf`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`PDF download failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const disposition = response.headers.get('content-disposition') ?? '';
      const filenameMatch = disposition.match(/filename=\"?([^"]+)\"?/i);
      const fallbackDate = new Date(data.date).toISOString().slice(0, 10);
      const fallbackName = `aar-${data.scenarioTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${fallbackDate}.pdf`;
      const filename = filenameMatch?.[1] ?? fallbackName;

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message || 'PDF download failed');
    } finally {
      setPdfDownloading(false);
    }
  }, [data, sessionId]);

  const handleDownloadWord = useCallback(async () => {
    if (!sessionId || !data) return;
    setWordDownloading(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/debrief/docx`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Word download failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const disposition = response.headers.get('content-disposition') ?? '';
      const filenameMatch = disposition.match(/filename=\"?([^"]+)\"?/i);
      const fallbackDate = new Date(data.date).toISOString().slice(0, 10);
      const fallbackName = `aar-${data.scenarioTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${fallbackDate}.docx`;
      const filename = filenameMatch?.[1] ?? fallbackName;

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message || 'Word download failed');
    } finally {
      setWordDownloading(false);
    }
  }, [data, sessionId]);

  // Can edit hot wash if facilitator, org admin, or super admin
  const canEditHotWash = currentUser
    ? ['FACILITATOR', 'ORG_ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)
    : false;

  // Group injects by phase (preserving order)
  const phaseGroups = (() => {
    if (!data) return [];
    const order: string[] = [];
    const map = new Map<string, InjectReplay[]>();
    for (const inject of data.injectReplays) {
      if (!map.has(inject.phase)) { order.push(inject.phase); map.set(inject.phase, []); }
      map.get(inject.phase)!.push(inject);
    }
    return order.map(phase => ({ phase, injects: map.get(phase)! }));
  })();

  const facilitatorScriptEntries = data ? buildFacilitatorScriptEntries(data) : [];
  const exerciseOverview = data ? buildExerciseOverviewContent(data, phaseGroups.length) : null;
  const hasAiAssessment = !!data && (!!aiDebriefText || data.scenarioMode === 'AI_DRIVEN');
  const hasNistSummary = !!data && ((data.nistGaps?.length ?? 0) > 0 || (data.mitreTechniques?.length ?? 0) > 0);
  const hasScenarioWalkthrough = !!data && (data.injectReplays?.length ?? 0) > 0;
  const hasScriptEvidence = !!data && hasFacilitatorScriptEvidence(data);
  const sectionNumbers = (() => {
    let current = 1;
    const overview = current++;
    const aiAssessment = hasAiAssessment ? current++ : null;
    const performance = current++;
    const nist = hasNistSummary ? current++ : null;
    const participants = current++;
    const leaderboard = current++;
    const walkthrough = hasScenarioWalkthrough ? current++ : null;
    const instructor = hasScriptEvidence ? current++ : null;
    const hotWash = current++;
    const management = current++;
    return { overview, aiAssessment, performance, nist, participants, leaderboard, walkthrough, instructor, hotWash, management };
  })();

  return (
    <Layout>
      <style>{PRINT_CSS}</style>

      <div className="aar-document p-6 max-w-5xl mx-auto space-y-8">

        {/* ── AAR Cover ──────────────────────────────────────────────────── */}
        <div className="aar-cover border-b border-slate-700/50 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/30 flex-shrink-0 mt-0.5">
                <ClipboardList className="w-7 h-7 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">After Action Report</span>
                </div>
                <h1 className="aar-cover-title text-2xl font-bold text-white leading-tight">
                  {data?.scenarioTitle ?? 'Loading…'}
                </h1>
                <p className="aar-cover-sub text-sm text-blue-400 mt-0.5">
                  {data ? (SCENARIO_TYPE_LABEL[data.scenarioType] ?? data.scenarioType) : ''} · Incident Response Tabletop Exercise
                </p>
                {data && (
                  <div className="aar-cover-meta flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                    {data.orgName && (
                      <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{data.orgName}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />{new Date(data.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                    <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />Facilitator: <span className="text-slate-400">{data.facilitator.displayName}</span></span>
                    <span className="flex items-center gap-1"><Hash className="w-3.5 h-3.5" />Session: <span className="font-mono text-slate-400">{data.joinCode}</span></span>
                    {data.durationMinutes !== null && (
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{data.durationMinutes} min</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {data && hotWash && (
              <div className="no-print flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => exportCsv(data, hotWash)}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg px-4 py-2 transition-colors text-sm border border-slate-600"
                >
                  <Download className="w-4 h-4" />Export AAR
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={pdfDownloading}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg px-4 py-2 transition-colors text-sm border border-blue-500"
                >
                  {pdfDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {pdfDownloading ? 'Generating PDF' : 'Download PDF'}
                </button>
                <button
                  onClick={handleDownloadWord}
                  disabled={wordDownloading}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg px-4 py-2 transition-colors text-sm border border-emerald-500"
                >
                  {wordDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  {wordDownloading ? 'Generating Word' : 'Download Word'}
                </button>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-3 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        ) : data && hotWash ? (
          <>
            {/* ── Section 1: Exercise Overview ─────────────────────────────── */}
            <div className="aar-section bg-slate-800 border border-slate-700/50 rounded-xl p-6">
              <SectionHeader number={sectionNumbers.overview} icon={<BookOpen className="w-4 h-4" />} title="Exercise Overview" />
              <div className="space-y-4">
                <p className="text-sm text-slate-300 leading-relaxed">
                  {exerciseOverview?.purpose}
                </p>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {exerciseOverview?.context}
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 font-medium">
                    {SCENARIO_TYPE_LABEL[data.scenarioType] ?? data.scenarioType}
                  </span>
                  {data.scenarioMode && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
                      {SCENARIO_MODE_LABEL[data.scenarioMode] ?? data.scenarioMode.replace(/_/g, ' ')}
                    </span>
                  )}
                  {data.scenarioDifficulty && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-700 text-slate-300 border border-slate-600 font-medium">
                      {data.scenarioDifficulty}
                    </span>
                  )}
                  <span className="text-xs px-2.5 py-1 rounded-full bg-slate-700 text-slate-300 border border-slate-600">
                    {phaseGroups.length} phase{phaseGroups.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-slate-700 text-slate-300 border border-slate-600">
                    {data.injectReplays.length} inject{data.injectReplays.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-slate-700 text-slate-300 border border-slate-600">
                    {data.playerCount} participant{data.playerCount !== 1 ? 's' : ''}
                  </span>
                </div>
                {data.scenarioObjectives && data.scenarioObjectives.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Exercise Objectives</p>
                    <ul className="space-y-1">
                      {data.scenarioObjectives.map((obj, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                          <CheckCircle className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />{obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                  <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider mb-1">Executive Takeaway</p>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {exerciseOverview?.takeaway}
                  </p>
                </div>
              </div>
            </div>

            {hasAiAssessment && (
              <div className="aar-section bg-slate-800 border border-emerald-500/30 rounded-xl p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <SectionHeader
                      number={sectionNumbers.aiAssessment!}
                      icon={<Sparkles className="w-4 h-4" />}
                      title="Exercise Performance Assessment"
                      sub="Generated by Claude from the adaptive scenario outcome"
                    />
                  </div>
                  {canEditHotWash && (
                    <button
                      onClick={regenerateAIDebrief}
                      disabled={aiDebriefRegenerating}
                      className="no-print flex items-center gap-1.5 bg-emerald-600/80 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg px-3 py-1.5 text-xs transition-colors border border-emerald-500/40 flex-shrink-0"
                    >
                      {aiDebriefRegenerating
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                        : <><RefreshCw className="w-3.5 h-3.5" /> Regenerate Assessment</>
                      }
                    </button>
                  )}
                </div>

                {aiDebriefRegenerating ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-3 bg-slate-700 rounded w-full" />
                    <div className="h-3 bg-slate-700 rounded w-5/6" />
                    <div className="h-3 bg-slate-700 rounded w-4/5" />
                    <div className="h-3 bg-slate-700 rounded w-full mt-3" />
                    <div className="h-3 bg-slate-700 rounded w-3/4" />
                  </div>
                ) : aiDebriefText ? (
                  <div className="prose-sm text-slate-300 leading-relaxed space-y-3">
                    {aiDebriefText.split('\n\n').filter(Boolean).map((para, i) => (
                      <p key={i} className="text-sm text-slate-300 leading-relaxed">{para}</p>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">Exercise performance assessment not yet generated.</p>
                    {canEditHotWash && (
                      <button
                        onClick={regenerateAIDebrief}
                        disabled={aiDebriefRegenerating}
                        className="mt-3 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        Generate now
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2 border-t border-slate-700/50 text-xs text-slate-600">
                  <span>Generated by Claude</span>
                  <span>·</span>
                  <span>{data.injectReplays.length} inject{data.injectReplays.length !== 1 ? 's' : ''}</span>
                  <span>·</span>
                  <span>{data.totalDecisions} decisions</span>
                </div>
              </div>
            )}

            {/* ── Section 3: Performance Summary ────────────────────────────── */}
            <div className="aar-section">
              <SectionHeader number={sectionNumbers.performance} icon={<Activity className="w-4 h-4" />} title="Performance Summary" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <StatCard icon={<Calendar className="w-5 h-5" />} label="Date" value={new Date(data.date).toLocaleDateString()} />
                <StatCard icon={<Users className="w-5 h-5" />} label="Players" value={data.playerCount} />
                <StatCard icon={<Hash className="w-5 h-5" />} label="Decisions" value={data.totalDecisions} />
                <StatCard icon={<Target className="w-5 h-5" />} label="Optimal Rate" value={`${data.optimalRate}%`} sub="correct choices" />
                <StatCard icon={<Star className="w-5 h-5" />} label="Top Score" value={data.leaderboard[0]?.totalScore ?? 0} sub={data.leaderboard[0]?.displayName} />
              </div>
            </div>

            {hasNistSummary && (
              <div className="aar-section bg-slate-800 border border-slate-700/50 rounded-xl p-6 space-y-6">
                <SectionHeader number={sectionNumbers.nist!} icon={<BarChart2 className="w-4 h-4" />} title="NIST CSF Performance & MITRE ATT&CK Summary" />

                {data.nistGaps?.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-4">Average decision score by NIST Cybersecurity Framework function. Gaps highlight areas requiring team development.</p>
                    <div className="space-y-4">
                      {data.nistGaps.map((item) => <NistBar key={item.function} item={item} />)}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-slate-700/50">
                      {Object.entries(STRENGTH_STYLES).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-1.5 text-xs">
                          <div className={`w-2.5 h-2.5 rounded-full ${val.bar}`} />
                          <span className={val.text}>{val.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {data.mitreTechniques?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">MITRE ATT&CK Techniques Encountered</p>
                    <div className="flex flex-wrap gap-2">
                      {data.mitreTechniques.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-1.5">
                          <span className="text-xs font-mono text-orange-400">{t.id}</span>
                          {t.name && <span className="text-xs text-slate-400">â€” {t.name}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="aar-section bg-slate-800 border border-slate-700/50 rounded-xl p-6">
              <SectionHeader number={sectionNumbers.participants} icon={<Users className="w-4 h-4" />} title="Participants" sub={`${data.participants.length} participant${data.participants.length !== 1 ? 's' : ''} in this exercise`} />
              <div className="overflow-x-auto">
                <table className="aar-table w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-700">
                      <th className="text-left pb-3 pr-4">Name</th>
                      <th className="text-left pb-3 pr-4">Assigned Role</th>
                      <th className="text-right pb-3 pr-4 hidden sm:table-cell">Decisions</th>
                      <th className="text-right pb-3 pr-4 hidden sm:table-cell">Optimal</th>
                      <th className="text-right pb-3 pr-4">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {data.participants.map((p) => {
                      const rate = p.decisionCount > 0 ? Math.round((p.optimalCount / p.decisionCount) * 100) : 0;
                      return (
                        <tr key={p.userId} className="hover:bg-slate-700/20 transition-colors">
                          <td className="py-3 pr-4 text-slate-200 font-medium">{p.displayName}</td>
                          <td className="py-3 pr-4 text-slate-400 text-xs">{p.assignedRole || '—'}</td>
                          <td className="py-3 pr-4 text-right text-slate-400 hidden sm:table-cell">{p.decisionCount}</td>
                          <td className="py-3 pr-4 text-right hidden sm:table-cell">
                            <span className={`text-xs font-medium ${rate >= 70 ? 'text-green-400' : rate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{rate}%</span>
                          </td>
                          <td className="py-3 pr-4 text-right font-bold text-white">{p.totalScore}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Section 5: Leaderboard ────────────────────────────────────── */}
            <div className="aar-section bg-slate-800 border border-slate-700/50 rounded-xl p-6">
              <SectionHeader number={sectionNumbers.leaderboard} icon={<Trophy className="w-4 h-4" />} title="Leaderboard" />
              <div className="overflow-x-auto">
                <table className="aar-table w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-700">
                      <th className="text-left pb-3 pr-4">Rank</th>
                      <th className="text-left pb-3 pr-4">Name</th>
                      <th className="text-left pb-3 pr-4 hidden sm:table-cell">Role</th>
                      <th className="text-right pb-3 pr-4">Total</th>
                      <th className="text-right pb-3 pr-4 hidden md:table-cell">Learning</th>
                      <th className="text-right pb-3 hidden md:table-cell">Speed Bonus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {data.leaderboard.map((entry) => (
                      <tr key={entry.userId} className="hover:bg-slate-700/30 transition-colors">
                        <td className="py-3 pr-4">
                          <span className={`text-sm font-bold ${entry.rank === 1 ? 'text-yellow-400' : entry.rank === 2 ? 'text-slate-300' : entry.rank === 3 ? 'text-orange-400' : 'text-slate-500'}`}>#{entry.rank}</span>
                        </td>
                        <td className="py-3 pr-4 text-slate-200 font-medium">{entry.displayName}</td>
                        <td className="py-3 pr-4 text-slate-500 hidden sm:table-cell">{entry.role}</td>
                        <td className="py-3 pr-4 text-right font-bold text-white">{entry.totalScore}</td>
                        <td className="py-3 pr-4 text-right text-slate-400 hidden md:table-cell">{entry.learningScore}</td>
                        <td className="py-3 text-right hidden md:table-cell">
                          {entry.speedBonusTotal > 0
                            ? <span className="text-yellow-400 text-xs flex items-center justify-end gap-1"><Zap className="w-3 h-3" />+{entry.speedBonusTotal}</span>
                            : <span className="text-slate-600">â€”</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {hasScenarioWalkthrough && (
              <div className="aar-section">
                <SectionHeader
                  number={sectionNumbers.walkthrough!}
                  icon={<Shield className="w-4 h-4" />}
                  title="Scenario Walkthrough"
                  sub={`${data.injectReplays.length} inject${data.injectReplays.length !== 1 ? 's' : ''} across ${phaseGroups.length} phase${phaseGroups.length !== 1 ? 's' : ''}`}
                />
                <div className="space-y-6">
                  {phaseGroups.map(({ phase, injects }) => (
                    <div key={phase}>
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-700/40">
                        <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-700 text-slate-300 border border-slate-600 uppercase tracking-wide">
                          {phase}
                        </span>
                        <span className="text-xs text-slate-600">{injects.length} inject{injects.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="space-y-3">
                        {injects.map((inject) => <InjectReplayCard key={inject.id} inject={inject} participants={data.participants} />)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasScriptEvidence && (
              <div className="aar-section">
                <SectionHeader
                  number={sectionNumbers.instructor!}
                  icon={<BookOpen className="w-4 h-4" />}
                  title="Instructor Script Evidence"
                  sub={`${facilitatorScriptEntries.length} scripted segment${facilitatorScriptEntries.length !== 1 ? 's' : ''} captured in session order`}
                />
                <div className="space-y-4">
                  {facilitatorScriptEntries.map((entry) => (
                    <FacilitatorScriptCard key={entry.id} entry={entry} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Section 8: Post-Exercise Analysis ────────────────────────── */}
            <div className="aar-section bg-slate-800 border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <SectionHeader
                  number={sectionNumbers.hotWash}
                  icon={<PenLine className="w-4 h-4" />}
                  title="Post-Exercise Analysis"
                  sub="Facilitator-editable readiness findings and improvement priorities generated from session evidence"
                />
                {canEditHotWash && (
                  <div className="no-print flex items-center gap-1.5 flex-shrink-0">
                    <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs text-slate-500">Editable</span>
                  </div>
                )}
              </div>
              <HotWashEditor
                hotWash={hotWash}
                onChange={handleHotWashChange}
                onSave={saveHotWash}
                onRegenerate={regenerateHotWash}
                saving={hotWashSaving}
                saved={hotWashSaved}
                dirty={hotWashDirty}
                regenerating={hotWashRegenerating}
                canEdit={canEditHotWash}
              />
            </div>

            {/* ── Section 9: Management Review (print-only) ─────────────────── */}
            <div className="management-approval hidden bg-white rounded-xl p-6 border border-gray-300 mt-8">
              <div style={{ borderBottom: '2px solid #1e40af', paddingBottom: '8pt', marginBottom: '12pt' }}>
                <p style={{ fontSize: '11pt', fontWeight: 700, color: '#1e3a8a' }}>Management Review and Approvals</p>
              </div>
              <p style={{ fontSize: '9pt', color: '#475569', marginBottom: '16pt' }}>
                The undersigned have reviewed and approved this After Action Report for the {data.scenarioTitle} tabletop exercise conducted on {new Date(data.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.
              </p>
              {[
                { title: 'Facilitator / Exercise Director' },
                { title: 'Chief Information Security Officer (CISO)' },
                { title: 'Incident Response Lead' },
              ].map(({ title }) => (
                <div key={title} style={{ marginBottom: '20pt' }}>
                  <div style={{ display: 'flex', gap: '24pt', alignItems: 'flex-end' }}>
                    <div style={{ flex: 2 }}>
                      <div style={{ borderBottom: '1px solid #94a3b8', marginBottom: '4pt', height: '20pt' }} />
                      <p style={{ fontSize: '8pt', color: '#64748b' }}>Signature</p>
                    </div>
                    <div style={{ flex: 2 }}>
                      <div style={{ borderBottom: '1px solid #94a3b8', marginBottom: '4pt', height: '20pt' }} />
                      <p style={{ fontSize: '8pt', color: '#64748b' }}>Printed Name & Title</p>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ borderBottom: '1px solid #94a3b8', marginBottom: '4pt', height: '20pt' }} />
                      <p style={{ fontSize: '8pt', color: '#64748b' }}>Date</p>
                    </div>
                  </div>
                  <p style={{ fontSize: '8pt', color: '#1e40af', marginTop: '4pt' }}>{title}</p>
                </div>
              ))}
            </div>

            {/* ── Empty state ───────────────────────────────────────────────── */}
            {data.totalDecisions === 0 && (
              <div className="text-center py-12 text-slate-500">
                <Clock className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No decisions were recorded in this session.</p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </Layout>
  );
}
