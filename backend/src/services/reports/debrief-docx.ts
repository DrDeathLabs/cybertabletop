import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type {
  DebriefPdfData,
  DebriefPdfInjectReplay,
} from './debrief-pdf';

const SCENARIO_TYPE_LABEL: Record<string, string> = {
  RANSOMWARE: 'Ransomware Attack',
  DATA_BREACH: 'Data Breach / PII Exfiltration',
  INSIDER_THREAT: 'Insider Threat',
  BEC: 'Business Email Compromise',
  SUPPLY_CHAIN: 'Supply Chain Compromise',
  DDoS: 'Denial of Service',
  APT: 'Advanced Persistent Threat',
  CUSTOM: 'Custom Scenario',
};

const SCENARIO_MODE_LABEL: Record<string, string> = {
  SCRIPTED: 'From Library',
  LIBRARY: 'From Library',
  AI_GENERATED: 'AI-Generated',
  AI_DRIVEN: 'AI-Driven',
};

const NIST_LABEL: Record<string, string> = {
  IDENTIFY: 'Identify',
  PROTECT: 'Protect',
  DETECT: 'Detect',
  RESPOND: 'Respond',
  RECOVER: 'Recover',
};

function safeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'aar-report';
}

export function getDebriefDocxFilename(data: DebriefPdfData): string {
  const date = new Date(data.date).toISOString().slice(0, 10);
  return `aar-${slug(data.scenarioTitle)}-${date}.docx`;
}

function paragraph(text: string, opts?: {
  heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
  bold?: boolean;
  size?: number;
  color?: string;
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  spacingAfter?: number;
  spacingBefore?: number;
  bullet?: { level: number };
}) {
  return new Paragraph({
    heading: opts?.heading,
    alignment: opts?.alignment,
    spacing: {
      before: opts?.spacingBefore ?? 0,
      after: opts?.spacingAfter ?? 140,
    },
    bullet: opts?.bullet,
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        size: opts?.size,
        color: opts?.color,
      }),
    ],
  });
}

function twoColTable(rows: Array<[string, string]>) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([label, value]) => new TableRow({
      children: [
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          shading: { fill: 'E2E8F0' },
          children: [paragraph(label.toUpperCase(), { bold: true, size: 18, spacingAfter: 40 })],
        }),
        new TableCell({
          width: { size: 70, type: WidthType.PERCENTAGE },
          children: [paragraph(value || 'Not specified', { size: 20, spacingAfter: 40 })],
        }),
      ],
    })),
  });
}

function dataTable(headers: string[], rows: string[][], widths: number[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((header, index) => new TableCell({
          width: { size: widths[index], type: WidthType.PERCENTAGE },
          shading: { fill: 'DCE6F2' },
          children: [paragraph(header, { bold: true, size: 18, spacingAfter: 40 })],
        })),
      }),
      ...rows.map((row) => new TableRow({
        children: row.map((cell, index) => new TableCell({
          width: { size: widths[index], type: WidthType.PERCENTAGE },
          children: [paragraph(cell || '', { size: 18, spacingAfter: 40 })],
        })),
      })),
    ],
  });
}

function buildExerciseOverview(data: DebriefPdfData) {
  const scenarioLabel = SCENARIO_TYPE_LABEL[data.scenarioType] ?? data.scenarioType;
  const orgLabel = safeText(data.orgName) || 'the organization';
  const modeLabel = data.scenarioMode
    ? (SCENARIO_MODE_LABEL[data.scenarioMode] ?? data.scenarioMode.replace(/_/g, ' '))
    : 'tabletop';
  const uniquePhases = new Set(data.injectReplays.map((inject) => inject.phase)).size;
  const phaseText = `${uniquePhases} phase${uniquePhases === 1 ? '' : 's'}`;
  const injectText = `${data.injectReplays.length} inject${data.injectReplays.length === 1 ? '' : 's'}`;

  return {
    purpose: `This exercise evaluated ${orgLabel}'s readiness to manage a ${scenarioLabel.toLowerCase()} through a ${modeLabel.toLowerCase()} tabletop exercise designed to stress coordinated decision-making, incident escalation, communications, and operational response under pressure.`,
    context: `${safeText(data.scenarioDescription)}${safeText(data.scenarioDescription) ? ' ' : ''}The scenario unfolded across ${phaseText} and ${injectText}, requiring participants to interpret evolving conditions, coordinate across stakeholder roles, and make defensible response decisions as the event progressed.`,
    takeaway: data.totalDecisions > 0
      ? 'Overall, the exercise provided a structured opportunity to validate current response capabilities and identify targeted improvement opportunities supported by the performance evidence that follows.'
      : 'Overall, the exercise established a structured scenario for discussion and capability review, even though no decision evidence was captured for scoring.',
  };
}

function buildScriptEntries(data: DebriefPdfData) {
  const script = data.facilitatorScript;
  if (!script) return [];

  const entries: Array<{ title: string; subtitle: string; content: string }> = [];
  if (safeText(script.opening)) {
    entries.push({
      title: 'Opening Script',
      subtitle: 'Welcome, ground rules, and scenario framing',
      content: safeText(script.opening),
    });
  }

  data.injectReplays.forEach((inject, index) => {
    const key = String(index + 1);
    const intro = safeText(script.roundIntros?.[key]);
    const afterAction = safeText(script.rounds?.[key]);
    const phaseLabel = inject.phase ? `${inject.phase} phase` : 'Scenario progression';
    if (intro) {
      entries.push({
        title: `Round ${index + 1}: ${inject.title} Intro`,
        subtitle: phaseLabel,
        content: intro,
      });
    }
    if (afterAction) {
      entries.push({
        title: `Round ${index + 1}: ${inject.title} After Action`,
        subtitle: phaseLabel,
        content: afterAction,
      });
    }
  });

  if (safeText(script.closing)) {
    entries.push({
      title: 'Closing Script',
      subtitle: 'Exercise wrap-up, lessons learned, and next steps',
      content: safeText(script.closing),
    });
  }

  return entries;
}

function injectWalkthrough(inject: DebriefPdfInjectReplay, index: number) {
  const blocks: (Paragraph | Table)[] = [
    paragraph(`Inject ${index + 1}: ${inject.title}`, { heading: HeadingLevel.HEADING_2, spacingBefore: 200 }),
    paragraph(
      [
        inject.phase ? `Phase: ${inject.phase}` : '',
        inject.nistCsfFunction ? `NIST: ${NIST_LABEL[inject.nistCsfFunction] ?? inject.nistCsfFunction}` : '',
        inject.mitreAttackId ? `MITRE: ${inject.mitreAttackId}${inject.mitreAttackName ? ` (${inject.mitreAttackName})` : ''}` : '',
      ].filter(Boolean).join(' | '),
      { size: 18, color: '64748B', spacingAfter: 80 },
    ),
    paragraph(inject.narrative, { size: 20 }),
    paragraph('Available Responses', { heading: HeadingLevel.HEADING_3 }),
  ];

  inject.options.forEach((option, optionIndex) => {
    blocks.push(paragraph(
      `${option.isOptimal ? 'Recommended Response' : `Option ${optionIndex + 1}`} — Score ${option.scoreWeight}`,
      { bold: true, size: 20, color: option.isOptimal ? '15803D' : '0F172A', spacingAfter: 60 },
    ));
    blocks.push(paragraph(option.text, { size: 20 }));
    if (safeText(option.scriptedFeedback)) {
      blocks.push(paragraph(`Facilitator note: ${safeText(option.scriptedFeedback)}`, { size: 18, color: '64748B' }));
    }
    if (safeText(option.consequences)) {
      blocks.push(paragraph(`Consequence: ${safeText(option.consequences)}`, { size: 18, color: '64748B' }));
    }
  });

  blocks.push(paragraph('Participant Responses', { heading: HeadingLevel.HEADING_3 }));
  if (inject.decisions.length === 0) {
    blocks.push(paragraph('No participant responses were recorded for this inject.', { size: 18, color: '64748B' }));
  } else {
    inject.decisions.forEach((decision) => {
      blocks.push(paragraph(
        `${decision.playerName}${decision.playerRole ? ` (${decision.playerRole})` : ''} — ${decision.isOptimal ? 'Correct response' : 'Incorrect response'}`,
        { bold: true, size: 20, color: decision.isOptimal ? '15803D' : 'B91C1C', spacingBefore: 100 },
      ));
      blocks.push(paragraph(`Selected response: ${decision.optionText}`, { size: 20 }));
      blocks.push(paragraph(`Score earned: ${decision.score + decision.speedBonus}`, { size: 18, color: '64748B' }));
      if (safeText(decision.rationale)) {
        blocks.push(paragraph(`Participant rationale: ${safeText(decision.rationale)}`, { size: 18 }));
      }
      if (safeText(decision.feedback)) {
        blocks.push(paragraph(`${decision.isOptimal ? 'Why this was recommended' : 'Why this was not recommended'}: ${safeText(decision.feedback)}`, { size: 18, color: '64748B' }));
      }
    });
  }

  return blocks;
}

export async function generateDebriefDocx(data: DebriefPdfData): Promise<Buffer> {
  const overview = buildExerciseOverview(data);
  const scriptEntries = buildScriptEntries(data);
  const exerciseDate = new Date(data.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const scenarioLabel = SCENARIO_TYPE_LABEL[data.scenarioType] ?? data.scenarioType;
  const modeLabel = data.scenarioMode ? (SCENARIO_MODE_LABEL[data.scenarioMode] ?? data.scenarioMode.replace(/_/g, ' ')) : 'Exercise';

  const doc = new Document({
    creator: 'CyberTabletop',
    title: `${data.scenarioTitle} After Action Report`,
    description: 'Cybersecurity tabletop after action report',
    features: {
      updateFields: true,
    },
    sections: [
      {
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `${data.scenarioTitle} • After Action Report • Page `, size: 16, color: '64748B' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '64748B' }),
                ],
              }),
            ],
          }),
        },
        children: [
          paragraph('AFTER ACTION REPORT', { bold: true, size: 22, color: '1D4ED8', spacingAfter: 220 }),
          paragraph(data.scenarioTitle, { heading: HeadingLevel.TITLE, size: 40, bold: true, spacingAfter: 120 }),
          paragraph(`${scenarioLabel} • ${modeLabel} • Incident Response Tabletop Exercise`, { size: 22, color: '64748B', spacingAfter: 320 }),
          twoColTable([
            ['Organization', safeText(data.orgName) || 'Not specified'],
            ['Facilitator', data.facilitator.displayName],
            ['Exercise Date', exerciseDate],
            ['Session Code', data.joinCode],
            ['Duration', data.durationMinutes !== null ? `${data.durationMinutes} minutes` : 'Not recorded'],
            ['Difficulty', safeText(data.scenarioDifficulty) || 'Not specified'],
          ]),
          new Paragraph({ children: [new PageBreak()] }),
          paragraph('Table of Contents', { heading: HeadingLevel.HEADING_1 }),
          new TableOfContents('Select field and update in Word if needed', {
            hyperlink: true,
            headingStyleRange: '1-3',
          }),
          new Paragraph({ children: [new PageBreak()] }),
          paragraph('Exercise Overview', { heading: HeadingLevel.HEADING_1 }),
          paragraph(overview.purpose, { size: 20 }),
          paragraph(overview.context, { size: 20 }),
          paragraph('Training Objectives', { heading: HeadingLevel.HEADING_2 }),
          ...data.scenarioObjectives.map((objective) => paragraph(objective, { size: 20, bullet: { level: 0 } })),
          paragraph('Executive Takeaway', { heading: HeadingLevel.HEADING_2 }),
          paragraph(overview.takeaway, { size: 20 }),
          paragraph('Exercise Performance Assessment', { heading: HeadingLevel.HEADING_1 }),
          paragraph(safeText(data.aiDebriefText) || 'Exercise performance assessment not yet generated.', { size: 20 }),
          paragraph('Performance Summary', { heading: HeadingLevel.HEADING_1 }),
          dataTable(
            ['Metric', 'Value', 'Notes'],
            [
              ['Participants', String(data.playerCount), 'Active exercise participants'],
              ['Recorded Decisions', String(data.totalDecisions), 'Participant decision evidence captured'],
              ['Optimal Rate', `${data.optimalRate}%`, 'Responses aligned to the best option'],
              ['Top Performer', data.leaderboard[0]?.displayName ?? 'Not available', data.leaderboard[0] ? `${data.leaderboard[0].totalScore} total points` : ''],
            ],
            [28, 22, 50],
          ),
          paragraph('NIST CSF Performance and MITRE ATT&CK Summary', { heading: HeadingLevel.HEADING_1 }),
          data.nistGaps.length > 0
            ? dataTable(
              ['NIST Function', 'Avg Score', 'Decisions', 'Assessment'],
              data.nistGaps.map((gap) => [
                NIST_LABEL[gap.function] ?? gap.function,
                `${gap.avgScore}%`,
                String(gap.decisionCount),
                gap.strength.replace(/-/g, ' '),
              ]),
              [34, 18, 18, 30],
            )
            : paragraph('No NIST CSF performance data was recorded for this session.', { size: 18, color: '64748B' }),
          paragraph('MITRE ATT&CK Techniques', { heading: HeadingLevel.HEADING_2 }),
          ...(data.mitreTechniques.length > 0
            ? data.mitreTechniques.map((technique) => paragraph(`${technique.id}${technique.name ? ` — ${technique.name}` : ''}`, { size: 20, bullet: { level: 0 } }))
            : [paragraph('No MITRE ATT&CK techniques were captured in the recorded session data.', { size: 18, color: '64748B' })]),
          paragraph('Participants', { heading: HeadingLevel.HEADING_1 }),
          dataTable(
            ['Participant', 'Role', 'Decisions', 'Optimal Rate', 'Total Score'],
            data.participants.map((participant) => [
              participant.displayName,
              participant.assignedRole || 'Not assigned',
              String(participant.decisionCount),
              participant.decisionCount > 0 ? `${Math.round((participant.optimalCount / participant.decisionCount) * 100)}%` : '0%',
              String(participant.totalScore),
            ]),
            [28, 28, 14, 15, 15],
          ),
          paragraph('Leaderboard', { heading: HeadingLevel.HEADING_1 }),
          dataTable(
            ['Rank', 'Participant', 'Role', 'Total', 'Learning', 'Speed Bonus'],
            data.leaderboard.map((entry) => [
              String(entry.rank),
              entry.displayName,
              entry.role || 'Not assigned',
              String(entry.totalScore),
              String(entry.learningScore),
              String(entry.speedBonusTotal),
            ]),
            [8, 28, 22, 12, 15, 15],
          ),
          paragraph('Scenario Walkthrough', { heading: HeadingLevel.HEADING_1 }),
          ...data.injectReplays.flatMap((inject, index) => injectWalkthrough(inject, index)),
          paragraph('Instructor Script Evidence', { heading: HeadingLevel.HEADING_1 }),
          ...(scriptEntries.length > 0
            ? scriptEntries.flatMap((entry) => [
              paragraph(entry.title, { heading: HeadingLevel.HEADING_2 }),
              paragraph(entry.subtitle, { size: 18, color: '64748B', spacingAfter: 80 }),
              paragraph(entry.content, { size: 20 }),
            ])
            : [paragraph('No facilitator script evidence was recorded for this session.', { size: 18, color: '64748B' })]),
          paragraph('Post-Exercise Analysis', { heading: HeadingLevel.HEADING_1 }),
          paragraph('Overall Readiness Assessment', { heading: HeadingLevel.HEADING_2 }),
          paragraph(safeText(data.hotWash?.overallAssessment) || 'Not recorded.', { size: 20 }),
          paragraph('Strengths Observed', { heading: HeadingLevel.HEADING_2 }),
          paragraph(safeText(data.hotWash?.strengthsObserved) || 'Not recorded.', { size: 20 }),
          paragraph('Gaps and Improvement Areas', { heading: HeadingLevel.HEADING_2 }),
          paragraph(safeText(data.hotWash?.gapsAndImprovementAreas) || 'Not recorded.', { size: 20 }),
          paragraph('Root Causes and Contributing Factors', { heading: HeadingLevel.HEADING_2 }),
          paragraph(safeText(data.hotWash?.rootCauses) || 'Not recorded.', { size: 20 }),
          paragraph('Likely Operational Impact', { heading: HeadingLevel.HEADING_2 }),
          paragraph(safeText(data.hotWash?.operationalImpact) || 'Not recorded.', { size: 20 }),
          paragraph('Priority Improvement Actions', { heading: HeadingLevel.HEADING_2 }),
          paragraph(safeText(data.hotWash?.priorityActions) || 'Not recorded.', { size: 20 }),
          paragraph('Recommended Next Training Steps', { heading: HeadingLevel.HEADING_2 }),
          paragraph(safeText(data.hotWash?.nextTrainingSteps) || 'Not recorded.', { size: 20 }),
          paragraph('Leadership Considerations', { heading: HeadingLevel.HEADING_2 }),
          paragraph(safeText(data.hotWash?.leadershipConsiderations) || 'Not recorded.', { size: 20 }),
          paragraph('Management Review and Approvals', { heading: HeadingLevel.HEADING_1 }),
          dataTable(
            ['Approver Role', 'Signature', 'Printed Name / Title', 'Date'],
            [
              ['Facilitator / Exercise Director', '', '', ''],
              ['Chief Information Security Officer (CISO)', '', '', ''],
              ['Incident Response Lead', '', '', ''],
            ],
            [34, 22, 28, 16],
          ),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
