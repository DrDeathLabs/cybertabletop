import PDFDocument from 'pdfkit';

export interface DebriefPdfOption {
  id: string;
  text: string;
  scoreWeight: number;
  isOptimal: boolean;
  scriptedFeedback: string;
  feedbackTags: string[];
  consequences: string | null;
}

export interface DebriefPdfDecision {
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

export interface DebriefPdfInjectReplay {
  id: string;
  title: string;
  phase: string;
  narrative: string;
  mitreAttackId: string | null;
  mitreAttackName: string | null;
  nistCsfFunction: string | null;
  options: DebriefPdfOption[];
  decisions: DebriefPdfDecision[];
}

export interface DebriefPdfParticipant {
  userId: string;
  displayName: string;
  assignedRole: string;
  totalScore: number;
  learningScore: number;
  optimalCount: number;
  decisionCount: number;
}

export interface DebriefPdfLeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  role: string;
  totalScore: number;
  learningScore: number;
  speedBonusTotal: number;
}

export interface DebriefPdfNistGap {
  function: string;
  avgScore: number;
  decisionCount: number;
  strength: string;
}

export interface DebriefPdfMitreTechnique {
  id: string;
  name: string | null;
}

export interface DebriefPdfHotWash {
  overallAssessment?: string;
  strengthsObserved?: string;
  gapsAndImprovementAreas?: string;
  rootCauses?: string;
  operationalImpact?: string;
  priorityActions?: string;
  nextTrainingSteps?: string;
  leadershipConsiderations?: string;
}

export interface DebriefPdfScript {
  opening: string | null;
  roundIntros: Record<string, string>;
  rounds: Record<string, string>;
  closing: string | null;
}

export interface DebriefPdfData {
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
  leaderboard: DebriefPdfLeaderboardEntry[];
  participants: DebriefPdfParticipant[];
  mitreTechniques: DebriefPdfMitreTechnique[];
  nistGaps: DebriefPdfNistGap[];
  injectReplays: DebriefPdfInjectReplay[];
  facilitatorScript?: DebriefPdfScript | null;
  hotWash?: DebriefPdfHotWash | null;
  aiDebriefText?: string | null;
}

type ScriptEntry = {
  title: string;
  subtitle: string;
  content: string;
};

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

function normalizeHotWash(hotWash: DebriefPdfHotWash | null | undefined) {
  return {
    overallAssessment: safeText(hotWash?.overallAssessment),
    strengthsObserved: safeText(hotWash?.strengthsObserved),
    gapsAndImprovementAreas: safeText(hotWash?.gapsAndImprovementAreas),
    rootCauses: safeText(hotWash?.rootCauses),
    operationalImpact: safeText(hotWash?.operationalImpact),
    priorityActions: safeText(hotWash?.priorityActions),
    nextTrainingSteps: safeText(hotWash?.nextTrainingSteps),
    leadershipConsiderations: safeText(hotWash?.leadershipConsiderations),
  };
}

function buildScriptEntries(data: DebriefPdfData): ScriptEntry[] {
  const script = data.facilitatorScript;
  if (!script) return [];

  const entries: ScriptEntry[] = [];
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
    const roundAar = safeText(script.rounds?.[key]);
    const roundLabel = `Round ${index + 1}: ${inject.title}`;
    const phaseLabel = inject.phase ? `${inject.phase} phase` : 'Scenario progression';

    if (intro) {
      entries.push({
        title: `${roundLabel} Intro`,
        subtitle: phaseLabel,
        content: intro,
      });
    }

    if (roundAar) {
      entries.push({
        title: `${roundLabel} After Action`,
        subtitle: phaseLabel,
        content: roundAar,
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

function fileNameSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'aar-report';
}

export function getDebriefPdfFilename(data: DebriefPdfData): string {
  const date = new Date(data.date).toISOString().slice(0, 10);
  return `aar-${fileNameSlug(data.scenarioTitle)}-${date}.pdf`;
}

export async function generateDebriefPdf(data: DebriefPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 54, bottom: 54, left: 54, right: 54 },
      bufferPages: true,
      autoFirstPage: false,
      info: {
        Title: `${data.scenarioTitle} After Action Report`,
        Author: 'CyberTabletop',
        Subject: 'After Action Report',
        Keywords: 'after action report, cybersecurity, tabletop exercise',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const colors = {
      navy: '#0f172a',
      slate: '#334155',
      muted: '#64748b',
      border: '#cbd5e1',
      light: '#e2e8f0',
      blue: '#1d4ed8',
      blueSoft: '#dbeafe',
      green: '#15803d',
      greenSoft: '#dcfce7',
      red: '#b91c1c',
      redSoft: '#fee2e2',
      amber: '#b45309',
      amberSoft: '#fef3c7',
    };

    const contentWidth = () => doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const bottomLimit = () => doc.page.height - doc.page.margins.bottom;
    const lineGap = 4;

    const addPage = () => {
      doc.addPage();
      doc.y = doc.page.margins.top;
    };

    const ensureSpace = (height = 48) => {
      if (doc.y + height > bottomLimit()) addPage();
    };

    const drawRule = (color = colors.light) => {
      ensureSpace(12);
      doc.save()
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .strokeColor(color)
        .lineWidth(1)
        .stroke()
        .restore();
      doc.moveDown(0.8);
    };

    const textBlock = (text: string, options?: PDFKit.Mixins.TextOptions & { size?: number; color?: string; font?: string }) => {
      const value = safeText(text);
      if (!value) return;
      const size = options?.size ?? 10.5;
      const color = options?.color ?? colors.slate;
      const font = options?.font ?? 'Helvetica';
      ensureSpace(size * 2.4);
      doc.font(font).fontSize(size).fillColor(color).text(value, {
        width: contentWidth(),
        lineGap,
        ...(options ?? {}),
      });
      doc.moveDown(0.55);
    };

    const sectionHeading = (number: number, title: string, subtitle?: string) => {
      ensureSpace(60);
      doc.save()
        .roundedRect(doc.page.margins.left, doc.y, 26, 26, 13)
        .fill(colors.blueSoft)
        .restore();
      doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.blue)
        .text(String(number), doc.page.margins.left, doc.y + 6, { width: 26, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(15).fillColor(colors.navy)
        .text(title, doc.page.margins.left + 38, doc.y + 1, { width: contentWidth() - 38 });
      if (subtitle) {
        doc.font('Helvetica').fontSize(9.5).fillColor(colors.muted)
          .text(subtitle, doc.page.margins.left + 38, doc.y + 20, { width: contentWidth() - 38 });
      }
      doc.y += subtitle ? 40 : 30;
      drawRule(colors.border);
    };

    const keyValueGrid = (rows: Array<{ label: string; value: string }>) => {
      const columnGap = 20;
      const colWidth = (contentWidth() - columnGap) / 2;
      rows.forEach((row, index) => {
        const isLeft = index % 2 === 0;
        if (isLeft) ensureSpace(40);
        const x = doc.page.margins.left + (isLeft ? 0 : colWidth + columnGap);
        const y = doc.y;
        const height = 34;
        doc.save()
          .roundedRect(x, y, colWidth, height, 8)
          .fillAndStroke('#f8fafc', colors.border)
          .restore();
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(colors.muted).text(row.label.toUpperCase(), x + 10, y + 7, { width: colWidth - 20 });
        doc.font('Helvetica').fontSize(10).fillColor(colors.navy).text(row.value, x + 10, y + 18, { width: colWidth - 20, ellipsis: true });
        if (!isLeft || index === rows.length - 1) doc.y += height + 10;
      });
      doc.moveDown(0.3);
    };

    const statCards = (rows: Array<{ label: string; value: string; note?: string }>) => {
      const gap = 12;
      const colWidth = (contentWidth() - gap * 2) / 3;
      ensureSpace(92);
      const startY = doc.y;
      rows.slice(0, 3).forEach((row, index) => {
        const x = doc.page.margins.left + index * (colWidth + gap);
        doc.save()
          .roundedRect(x, startY, colWidth, 78, 10)
          .fillAndStroke('#f8fafc', colors.border)
          .restore();
        doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.muted).text(row.label.toUpperCase(), x + 12, startY + 10, { width: colWidth - 24, align: 'center' });
        doc.font('Helvetica-Bold').fontSize(22).fillColor(colors.navy).text(row.value, x + 12, startY + 28, { width: colWidth - 24, align: 'center' });
        if (row.note) {
          doc.font('Helvetica').fontSize(8.5).fillColor(colors.muted).text(row.note, x + 12, startY + 56, { width: colWidth - 24, align: 'center' });
        }
      });
      doc.y = startY + 92;
    };

    const bulletList = (items: string[], color = colors.slate) => {
      items.filter((item) => safeText(item)).forEach((item) => {
        ensureSpace(24);
        const startX = doc.page.margins.left;
        const textX = startX + 14;
        const startY = doc.y;
        doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.blue).text('•', startX, startY);
        doc.font('Helvetica').fontSize(10.5).fillColor(color).text(item.trim(), textX, startY, {
          width: contentWidth() - 14,
          lineGap,
        });
        doc.moveDown(0.25);
      });
      doc.moveDown(0.3);
    };

    const labeledBody = (label: string, body: string) => {
      const value = safeText(body);
      if (!value) return;
      ensureSpace(30);
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(colors.navy).text(label, { width: contentWidth() });
      doc.moveDown(0.15);
      textBlock(value, { size: 10, color: colors.slate });
    };

    const smallHeading = (label: string) => {
      ensureSpace(20);
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(colors.navy).text(label, { width: contentWidth() });
      doc.moveDown(0.2);
    };

    const simpleTable = (headers: string[], rows: string[][], widths: number[]) => {
      const totalWidth = widths.reduce((sum, width) => sum + width, 0);
      const x = doc.page.margins.left;
      const getRowHeight = (row: string[], fontSize: number) => {
        const heights = row.map((cell, index) => {
          const width = widths[index] - 12;
          return doc.heightOfString(cell, {
            width,
            lineGap: 2,
          });
        });
        return Math.max(24, Math.ceil(Math.max(...heights) + 12));
      };
      const renderRow = (row: string[], isHeader = false) => {
        const rowY = doc.y;
        const fontSize = isHeader ? 8.5 : 8.8;
        const rowHeight = getRowHeight(row, fontSize);
        ensureSpace(rowHeight + 4);
        let cursor = x;
        row.forEach((cell, index) => {
          const width = widths[index];
          doc.save()
            .rect(cursor, rowY, width, rowHeight)
            .fillAndStroke(isHeader ? '#e2e8f0' : '#ffffff', colors.border)
            .restore();
          doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(fontSize)
            .fillColor(colors.navy)
            .text(cell, cursor + 6, rowY + 6, {
              width: width - 12,
              height: rowHeight - 10,
              lineGap: 2,
            });
          doc.y = rowY;
          cursor += width;
        });
        doc.y = rowY + rowHeight;
      };
      ensureSpace(36);
      renderRow(headers, true);
      rows.forEach((row) => renderRow(row));
      doc.moveDown(0.6);
      if (totalWidth < contentWidth()) doc.x = doc.page.margins.left;
    };

    const injectCard = (inject: DebriefPdfInjectReplay, index: number) => {
      ensureSpace(80);
      doc.save()
        .roundedRect(doc.page.margins.left, doc.y, contentWidth(), 28, 8)
        .fillAndStroke('#eff6ff', '#bfdbfe')
        .restore();
      doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.navy)
        .text(`Inject ${index + 1}: ${inject.title}`, doc.page.margins.left + 12, doc.y + 7, { width: contentWidth() - 24 });
      doc.y += 38;

      const meta = [
        inject.phase ? `Phase: ${inject.phase}` : '',
        inject.nistCsfFunction ? `NIST: ${NIST_LABEL[inject.nistCsfFunction] ?? inject.nistCsfFunction}` : '',
        inject.mitreAttackId ? `MITRE: ${inject.mitreAttackId}${inject.mitreAttackName ? ` (${inject.mitreAttackName})` : ''}` : '',
      ].filter(Boolean);
      if (meta.length > 0) {
        doc.font('Helvetica').fontSize(9).fillColor(colors.muted).text(meta.join('   |   '), { width: contentWidth() });
        doc.moveDown(0.35);
      }

      textBlock(inject.narrative, { size: 10.5, color: colors.slate });

      smallHeading('Available Responses');
      inject.options.forEach((option, optionIndex) => {
        ensureSpace(28);
        const prefix = option.isOptimal ? 'Recommended response' : `Option ${optionIndex + 1}`;
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(option.isOptimal ? colors.green : colors.navy)
          .text(`${prefix} • Score ${option.scoreWeight}`, { width: contentWidth() });
        doc.moveDown(0.1);
        textBlock(option.text, { size: 9.8, color: colors.slate });
        if (safeText(option.scriptedFeedback)) {
          textBlock(`Facilitator note: ${safeText(option.scriptedFeedback)}`, { size: 8.8, color: colors.muted });
        }
        if (safeText(option.consequences)) {
          textBlock(`Consequence: ${safeText(option.consequences)}`, { size: 8.8, color: colors.muted });
        }
      });

      smallHeading('Participant Responses');
      if (inject.decisions.length === 0) {
        textBlock('No participant responses were recorded for this inject.', { size: 9.8, color: colors.muted });
      } else {
        inject.decisions.forEach((decision) => {
          ensureSpace(46);
          doc.save()
            .roundedRect(doc.page.margins.left, doc.y, contentWidth(), 20, 6)
            .fillAndStroke(decision.isOptimal ? colors.greenSoft : colors.redSoft, decision.isOptimal ? '#86efac' : '#fca5a5')
            .restore();
          doc.font('Helvetica-Bold').fontSize(9.5).fillColor(colors.navy)
            .text(`${decision.playerName}${decision.playerRole ? ` • ${decision.playerRole}` : ''}`, doc.page.margins.left + 8, doc.y + 5, { width: contentWidth() - 16 });
          doc.font('Helvetica-Bold').fontSize(9.5).fillColor(decision.isOptimal ? colors.green : colors.red)
            .text(decision.isOptimal ? 'Correct response' : 'Incorrect response', doc.page.margins.left + 8, doc.y + 5, { width: contentWidth() - 16, align: 'right' });
          doc.y += 26;
          textBlock(`Selected response: ${decision.optionText}`, { size: 9.8, color: colors.slate });
          textBlock(`Score earned: ${decision.score + decision.speedBonus} (${decision.score} base${decision.speedBonus ? ` + ${decision.speedBonus} speed bonus` : ''})`, { size: 8.8, color: colors.muted });
          if (safeText(decision.rationale)) {
            textBlock(`Participant rationale: ${safeText(decision.rationale)}`, { size: 8.8, color: colors.slate });
          }
          if (safeText(decision.feedback)) {
            textBlock(`${decision.isOptimal ? 'Why this was recommended' : 'Why this was not recommended'}: ${safeText(decision.feedback)}`, { size: 8.8, color: colors.muted });
          }
        });
      }

      drawRule(colors.light);
    };

    addPage();

    const overview = buildExerciseOverview(data);
    const hotWash = normalizeHotWash(data.hotWash);
    const scriptEntries = buildScriptEntries(data);
    const scenarioLabel = SCENARIO_TYPE_LABEL[data.scenarioType] ?? data.scenarioType;
    const modeLabel = data.scenarioMode ? (SCENARIO_MODE_LABEL[data.scenarioMode] ?? data.scenarioMode.replace(/_/g, ' ')) : 'Exercise';

    doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.blue).text('AFTER ACTION REPORT');
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').fontSize(24).fillColor(colors.navy).text(data.scenarioTitle, {
      width: contentWidth(),
      lineGap: 2,
    });
    doc.moveDown(0.35);
    doc.font('Helvetica').fontSize(11).fillColor(colors.muted).text(`${scenarioLabel} • ${modeLabel} • Incident Response Tabletop Exercise`, {
      width: contentWidth(),
    });
    doc.moveDown(1.2);

    keyValueGrid([
      { label: 'Organization', value: safeText(data.orgName) || 'Not specified' },
      { label: 'Facilitator', value: data.facilitator.displayName },
      { label: 'Exercise Date', value: new Date(data.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
      { label: 'Session Code', value: data.joinCode },
      { label: 'Duration', value: data.durationMinutes !== null ? `${data.durationMinutes} minutes` : 'Not recorded' },
      { label: 'Difficulty', value: safeText(data.scenarioDifficulty) || 'Not specified' },
    ]);

    doc.moveDown(0.7);
    drawRule();

    sectionHeading(1, 'Exercise Overview');
    textBlock(overview.purpose);
    textBlock(overview.context);
    if (data.scenarioObjectives.length > 0) {
      labeledBody('Training Objectives', '');
      bulletList(data.scenarioObjectives, colors.slate);
    }
    labeledBody('Executive Takeaway', overview.takeaway);

    if (safeText(data.aiDebriefText)) {
      sectionHeading(2, 'Exercise Performance Assessment');
      textBlock(safeText(data.aiDebriefText));
    }

    sectionHeading(safeText(data.aiDebriefText) ? 3 : 2, 'Performance Summary');
    statCards([
      { label: 'Participants', value: String(data.playerCount), note: 'Active exercise participants' },
      { label: 'Decisions', value: String(data.totalDecisions), note: 'Recorded participant decisions' },
      { label: 'Optimal Rate', value: `${data.optimalRate}%`, note: 'Responses aligned to the best option' },
    ]);

    if (data.leaderboard[0]) {
      textBlock(`Top performer: ${data.leaderboard[0].displayName}${data.leaderboard[0].role ? ` (${data.leaderboard[0].role})` : ''} with ${data.leaderboard[0].totalScore} total points.`, {
        size: 10,
        color: colors.slate,
      });
    }

    const nistNumber = safeText(data.aiDebriefText) ? 4 : 3;
    sectionHeading(nistNumber, 'NIST CSF Performance and MITRE ATT&CK Summary');
    if (data.nistGaps.length > 0) {
      simpleTable(
        ['NIST Function', 'Avg Score', 'Decisions', 'Assessment'],
        data.nistGaps.map((gap) => [
          NIST_LABEL[gap.function] ?? gap.function,
          `${gap.avgScore}%`,
          String(gap.decisionCount),
          gap.strength.replace(/-/g, ' '),
        ]),
        [180, 90, 90, 170],
      );
    } else {
      textBlock('No NIST CSF performance data was recorded for this session.', { size: 9.8, color: colors.muted });
    }

    if (data.mitreTechniques.length > 0) {
      labeledBody('MITRE ATT&CK Techniques Encountered', '');
      bulletList(data.mitreTechniques.map((technique) => `${technique.id}${technique.name ? ` — ${technique.name}` : ''}`), colors.slate);
    } else {
      textBlock('No MITRE ATT&CK techniques were captured in the recorded session data.', { size: 9.8, color: colors.muted });
    }

    const participantsNumber = nistNumber + 1;
    sectionHeading(participantsNumber, 'Participants');
    simpleTable(
      ['Participant', 'Role', 'Decisions', 'Optimal', 'Score'],
      data.participants.map((participant) => [
        participant.displayName,
        participant.assignedRole || 'Not assigned',
        String(participant.decisionCount),
        participant.decisionCount > 0 ? `${Math.round((participant.optimalCount / participant.decisionCount) * 100)}%` : '0%',
        String(participant.totalScore),
      ]),
      [170, 140, 75, 75, 80],
    );

    const leaderboardNumber = participantsNumber + 1;
    sectionHeading(leaderboardNumber, 'Leaderboard');
    simpleTable(
      ['Rank', 'Participant', 'Role', 'Total', 'Learning', 'Speed Bonus'],
      data.leaderboard.map((entry) => [
        String(entry.rank),
        entry.displayName,
        entry.role || 'Not assigned',
        String(entry.totalScore),
        String(entry.learningScore),
        String(entry.speedBonusTotal),
      ]),
      [48, 170, 120, 60, 70, 72],
    );

    const walkthroughNumber = leaderboardNumber + 1;
    sectionHeading(walkthroughNumber, 'Scenario Walkthrough');
    data.injectReplays.forEach((inject, index) => injectCard(inject, index));

    let nextNumber = walkthroughNumber + 1;
    if (scriptEntries.length > 0) {
      sectionHeading(nextNumber, 'Instructor Script Evidence');
      scriptEntries.forEach((entry) => {
        ensureSpace(60);
        doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.navy).text(entry.title, { width: contentWidth() });
        if (entry.subtitle) {
          doc.moveDown(0.15);
          doc.font('Helvetica').fontSize(9).fillColor(colors.muted).text(entry.subtitle, { width: contentWidth() });
        }
        doc.moveDown(0.25);
        textBlock(entry.content, { size: 9.9, color: colors.slate });
        drawRule(colors.light);
      });
      nextNumber += 1;
    }

    sectionHeading(nextNumber, 'Post-Exercise Analysis');
    labeledBody('Overall Readiness Assessment', hotWash.overallAssessment || 'Not recorded.');
    labeledBody('Strengths Observed', hotWash.strengthsObserved || 'Not recorded.');
    labeledBody('Gaps and Improvement Areas', hotWash.gapsAndImprovementAreas || 'Not recorded.');
    labeledBody('Root Causes and Contributing Factors', hotWash.rootCauses || 'Not recorded.');
    labeledBody('Likely Operational Impact', hotWash.operationalImpact || 'Not recorded.');
    labeledBody('Priority Improvement Actions', hotWash.priorityActions || 'Not recorded.');
    labeledBody('Recommended Next Training Steps', hotWash.nextTrainingSteps || 'Not recorded.');
    labeledBody('Leadership Considerations', hotWash.leadershipConsiderations || 'Not recorded.');
    nextNumber += 1;

    sectionHeading(nextNumber, 'Management Review and Approvals');
    textBlock('The following leadership roles should review the report, confirm action ownership, and document approval where required by organizational policy.', {
      size: 10,
      color: colors.slate,
    });

    [
      'Facilitator / Exercise Director',
      'Chief Information Security Officer (CISO)',
      'Incident Response Lead',
    ].forEach((role) => {
      ensureSpace(46);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.navy).text(role, { width: contentWidth() });
      const lineY = doc.y + 12;
      doc.save()
        .moveTo(doc.page.margins.left, lineY)
        .lineTo(doc.page.margins.left + 190, lineY)
        .strokeColor(colors.border)
        .stroke()
        .moveTo(doc.page.margins.left + 220, lineY)
        .lineTo(doc.page.margins.left + 380, lineY)
        .stroke()
        .restore();
      doc.font('Helvetica').fontSize(8.5).fillColor(colors.muted)
        .text('Signature', doc.page.margins.left, lineY + 4)
        .text('Date', doc.page.margins.left + 220, lineY + 4);
      doc.y = lineY + 22;
    });

    const range = doc.bufferedPageRange();
    for (let index = 0; index < range.count; index += 1) {
      doc.switchToPage(index);
      doc.font('Helvetica').fontSize(8.5).fillColor(colors.muted)
        .text(
          `${data.scenarioTitle} • After Action Report • Page ${index + 1} of ${range.count}`,
          doc.page.margins.left,
          doc.page.height - 30,
          { width: contentWidth(), align: 'center' },
        );
    }

    doc.end();
  });
}
