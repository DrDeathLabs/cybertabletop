/**
 * Facilitator Script Generation
 *
 * Generates four types of facilitator talking-point scripts:
 *   - Opening: why we're doing this, scenario context, ground rules
 *   - Round intro: set the scene when an inject is first presented, start discussion
 *   - Round debrief: what happened, team decisions, teaching points (post-reveal)
 *   - Closing: wrap-up, lessons learned, next steps
 *
 * All scripts are written as flowing, recitation-ready prose — no headers, no
 * bullet points, no numbered lists. The facilitator should be able to pick up
 * the script and read it word-for-word to the room.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../logger';
import { getAISettings } from '../ai-config';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OpeningScriptParams {
  scenarioTitle: string;
  scenarioType: string;
  difficulty: string;
  description: string;
  objectives: string[];
  orgName?: string;
  industry?: string;
  rolesList: string[];
  totalRounds: number;
}

export interface RoundIntroScriptParams {
  roundNumber: number;
  totalRounds: number;
  injectTitle: string;
  narrative: string;
  phase: string;
  rolesList: string[];
  scenarioTitle: string;
  scenarioType: string;
}

export interface RoundScriptParams {
  roundNumber: number;
  totalRounds: number;
  injectTitle: string;
  narrative: string;
  phase: string;
  decisions: Array<{
    playerName: string;
    role: string;
    chosenOption: string;
    score: number;
    isOptimal: boolean;
  }>;
  optimalOption: string;
  optimalFeedback: string;
  isLastRound: boolean;
  scenarioTitle: string;
}

export interface ClosingScriptParams {
  scenarioTitle: string;
  scenarioType: string;
  orgName?: string;
  industry?: string;
  rounds: Array<{
    roundNumber: number;
    injectTitle: string;
    phase: string;
    avgScore: number;
  }>;
  overallAvgScore: number;
  topPerformers: Array<{ name: string; role: string }>;
  totalParticipants: number;
}

export interface PreSessionClosingScriptParams {
  scenarioTitle: string;
  scenarioType: string;
  orgName?: string;
  industry?: string;
  totalRounds: number;
  phases: string[];
  objectives: string[];
}

// ─── AI call ──────────────────────────────────────────────────────────────────

async function callAI(prompt: string): Promise<string> {
  const cfg = await getAISettings();

  if (cfg.activeProvider === 'anthropic' && cfg.anthropic.apiKey) {
    const client = new Anthropic({ apiKey: cfg.anthropic.apiKey });
    const msg = await client.messages.create({
      model: cfg.anthropic.model,
      max_tokens: cfg.anthropic.maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    return msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '';
  }

  if (cfg.activeProvider === 'ollama') {
    const { baseUrl, model, apiKey, temperature, numPredict, numCtx } = cfg.ollama;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        // numPredict is guaranteed ≥ 8192 by ai-config.ts getAISettings() — no override needed here.
        options: { temperature, num_predict: numPredict, num_ctx: numCtx },
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json() as { response?: string };
    return data.response?.trim() ?? '';
  }

  throw new Error('No AI provider configured.');
}

// ─── Opening script ───────────────────────────────────────────────────────────

export async function generateOpeningScript(params: OpeningScriptParams): Promise<string> {
  const { scenarioTitle, scenarioType, difficulty, description, objectives, orgName, industry, rolesList, totalRounds } = params;

  const orgContext = orgName ? `The organization participating today is ${orgName}${industry ? ` in the ${industry} sector` : ''}.` : '';
  const rolesContext = rolesList.length ? `In the room today we have: ${rolesList.join(', ')}.` : '';
  const objectivesContext = objectives.length ? `The learning objectives for this exercise are: ${objectives.join('; ')}.` : '';

  const prompt = `You are a cybersecurity professor and exercise facilitator. Write a word-for-word opening script that you will read aloud to your class at the start of a ${scenarioType} tabletop exercise called "${scenarioTitle}".

Context for writing the script:
- Difficulty: ${difficulty}
- ${orgContext}
- ${rolesContext}
- ${objectivesContext}
- Number of rounds: ${totalRounds > 0 ? totalRounds : 'variable'}
- Scenario background: ${description}

Write the script as flowing spoken prose — exactly what you would say out loud to the room. Write it the way a professor addresses students at the start of a class exercise: direct, engaging, educational, and warm.

The script should naturally cover:
- A genuine welcome and brief statement of why this exercise matters (not generic — tie it to the specific scenario type and what professionals in this field actually face)
- A quick and clear explanation of how the exercise works: they'll see a situation unfold across rounds, each round they'll read an inject and choose their response, at the end of each round you reveal results and discuss
- Ground rules stated conversationally: speak your thinking out loud, there are no wrong answers as long as you can defend your reasoning, stay in your role, silence your phones, be honest about what you'd actually do
- Setting the scene for the scenario — paint a picture of the organization and situation they're stepping into, without revealing what's coming. Build some tension.
- A brief acknowledgment of each role in the room and why that perspective matters during an incident
- A natural kickoff line to move into the first inject

Do NOT use any headers, bullet points, numbered lists, or markdown formatting. Do NOT label sections. Write it as pure spoken prose that flows naturally from one idea to the next — the kind of thing you could print out and read straight through. Use [pause] or [look around the room] for brief stage directions where helpful. Aim for 380–450 words.`;

  logger.info('Generating facilitator opening script', { scenarioTitle, scenarioType });
  return callAI(prompt);
}

// ─── Round intro script ────────────────────────────────────────────────────────

export async function generateRoundIntroScript(params: RoundIntroScriptParams): Promise<string> {
  const { roundNumber, totalRounds, injectTitle, narrative, phase, rolesList, scenarioTitle, scenarioType } = params;

  const roundLabel = totalRounds > 0 ? `Round ${roundNumber} of ${totalRounds}` : `Round ${roundNumber}`;
  const rolesContext = rolesList.length ? `Roles in the room: ${rolesList.join(', ')}.` : '';

  const prompt = `You are a cybersecurity professor facilitating a live tabletop exercise. Write a word-for-word script that you will read aloud to your class when presenting ${roundLabel} of the "${scenarioTitle}" exercise.

What the students are about to see on their screens:
- Inject title: "${injectTitle}"
- IR phase: ${phase}
- ${rolesContext}
- Inject text (summarized): ${narrative.slice(0, 700)}

Write the script as flowing spoken prose — exactly what you say out loud to the room when this inject appears, BEFORE students submit their decisions.

The script should:
- Open by orienting the class to what they're looking at. Describe the situation in vivid, present-tense language as if it's unfolding right now — "Here's what your team is dealing with..." Bring the scenario to life beyond what's on the screen.
- Tell each role what lens to view this through. For example: "If you're the IR Lead, your first question should be... If you're in an executive role, think about what your board would want to know..." Keep this conversational, not a list.
- Ask one good open-ended question to get the group talking before they commit to their choice. Make it a genuinely interesting question about the situation — not "what's the right answer" but something that surfaces real thinking about the problem.
- End with a clear, simple cue to review their options and make their decision.

Do NOT use any headers, bullet points, numbered lists, or markdown. Write pure flowing prose the way a professor talks through a case study with their class. Use [pause] or [look at the group] sparingly for stage directions. Aim for 160–200 words.`;

  logger.info('Generating facilitator round intro script', { roundNumber, scenarioTitle });
  return callAI(prompt);
}

// ─── Round after-action script ────────────────────────────────────────────────

export async function generateRoundScript(params: RoundScriptParams): Promise<string> {
  const { roundNumber, totalRounds, injectTitle, narrative, phase, decisions, optimalOption, optimalFeedback, isLastRound, scenarioTitle } = params;

  const hasDecisions = decisions.length > 0;
  const decisionSummary = hasDecisions
    ? decisions.map(d => `${d.playerName} (${d.role}) chose: "${d.chosenOption}" — score ${d.score}/100${d.isOptimal ? ' [optimal]' : ''}`).join('\n')
    : 'Decisions not yet available — generate a general teaching debrief for this inject.';

  const roundLabel = totalRounds > 0 ? `Round ${roundNumber} of ${totalRounds}` : `Round ${roundNumber}`;

  const optimalSection = optimalOption
    ? `- Best response: "${optimalOption}"\n- Why it was the right call: ${optimalFeedback.slice(0, 400)}`
    : '- Best response: (not yet determined — draw on IR best practice for this phase instead)';

  const prompt = `You are a cybersecurity professor facilitating a live tabletop exercise. Write a word-for-word script that you will read aloud to your class AFTER revealing the results for ${roundLabel} of "${scenarioTitle}".

What just happened this round:
- Inject: "${injectTitle}" (${phase} phase)
- Situation: ${narrative.slice(0, 500)}
- Team decisions:
${decisionSummary}
${optimalSection}
${isLastRound ? '- This was the FINAL round of the exercise.' : ''}

Write the script as flowing spoken prose — exactly what you say to the class after the results appear. Write it like a professor leading a post-case debrief: thoughtful, educational, conversational, and non-judgmental.

The script should:
- Open by briefly narrating what just happened in the scenario — bring the situation to life in one or two sentences, as if you're summarizing the plot point
- Objectively describe how the group responded. If decisions were split, name that. Don't call anyone out — frame it as "some of you chose..." Never shame a choice.
- Pose two or three genuine discussion questions that invite the group to reflect on their reasoning. Ground them in the actual situation. These should be questions a professor would ask to draw out critical thinking — "What would you have needed to know before you could make that call with confidence?" or "Who in this room had the most information at this stage, and who didn't?"
- Deliver the teaching point: explain the optimal response and why it's the right move. Reference relevant frameworks (NIST CSF, PICERL, NIST SP 800-61) naturally, the way a professor weaves in citations. Be educational, not prescriptive.
- ${isLastRound ? 'Close by acknowledging this was the final round and transitioning into the full debrief.' : 'End with a brief transition sentence that keeps the momentum into the next round.'}

Do NOT use any headers, bullet points, numbered lists, or markdown. Write pure flowing prose. Use [pause] or [look at the group] sparingly. Aim for 270–330 words.`;

  logger.info('Generating facilitator round after-action script', { roundNumber, scenarioTitle });
  return callAI(prompt);
}

// ─── Closing script ───────────────────────────────────────────────────────────

export async function generateClosingScript(params: ClosingScriptParams): Promise<string> {
  const { scenarioTitle, scenarioType, orgName, industry, rounds, overallAvgScore, topPerformers, totalParticipants } = params;

  const orgContext = orgName ? `for ${orgName}${industry ? ` (${industry})` : ''}` : '';
  const performanceLabel = overallAvgScore >= 75 ? 'strong' : overallAvgScore >= 50 ? 'solid' : 'developing';
  const topPerformerContext = topPerformers.length
    ? `Top performers today: ${topPerformers.map(p => `${p.name} (${p.role})`).join(', ')}.`
    : '';
  const roundSummary = rounds.map(r =>
    `Round ${r.roundNumber} [${r.phase}] "${r.injectTitle}" — team avg ${r.avgScore}/100`
  ).join('\n');

  const prompt = `You are a cybersecurity professor facilitating a tabletop exercise. Write a word-for-word closing script that you will read aloud to your class at the end of the "${scenarioTitle}" (${scenarioType}) exercise ${orgContext}.

Exercise data:
- Participants: ${totalParticipants}
- Overall performance: ${overallAvgScore}/100 (${performanceLabel})
- ${topPerformerContext}
- Rounds completed:
${roundSummary}

Write the script as flowing spoken prose — exactly what you say to close out the session. Write it the way a great professor ends a class: genuine, substantive, memorable, and motivating.

The script should:
- Open with a sincere, specific acknowledgment of the work done today — not generic "great job" but something that ties to what actually happened in the exercise. Name the scenario arc: from initial detection through to resolution.
- Walk the class through the journey of the exercise — what phase each round represented and how the scenario evolved. Help them see the full story they just lived through.
- Name specific things the team did well, tied to actual round scores and phases where performance was strong. Be concrete.
- Offer constructive observations on where the team's decisions revealed gaps — frame these as normal, common blind spots in real incidents, not failures. Use this to teach.
- Deliver two or three key takeaways — not a bulleted list, but woven naturally into speech. These should be the things you'd want them to remember and act on.
- Give concrete next steps: what the organization should do in the next 30, 60, and 90 days to build on this exercise. Reference policy, training, and practice cadence.
- Close with a genuine send-off about preparedness — something memorable that connects today's work to real-world consequences.

Do NOT use any headers, bullet points, numbered lists, or markdown. Write pure flowing prose from start to finish. Use [pause] or [look around the room] sparingly. Aim for 420–490 words.`;

  logger.info('Generating facilitator closing script', { scenarioTitle, totalRounds: rounds.length });
  return callAI(prompt);
}

export async function generatePreSessionClosingScript(params: PreSessionClosingScriptParams): Promise<string> {
  const { scenarioTitle, scenarioType, orgName, industry, totalRounds, phases, objectives } = params;

  const orgContext = orgName ? `for ${orgName}${industry ? ` (${industry})` : ''}` : '';
  const phaseSummary = phases.length ? phases.join(' -> ') : 'Detect -> Contain -> Recover';
  const objectivesContext = objectives.length
    ? objectives.join('; ')
    : 'incident response decision-making and cross-functional coordination';

  const prompt = `You are a cybersecurity professor preparing facilitator notes for a tabletop exercise. Write a word-for-word closing script for the end of the "${scenarioTitle}" (${scenarioType}) exercise ${orgContext}.

Important context:
- This script is being prepared BEFORE the session starts.
- The exercise is expected to run ${totalRounds} rounds.
- The scenario arc is expected to move through these phases: ${phaseSummary}
- The learning objectives are: ${objectivesContext}

Write the script as flowing spoken prose that the facilitator can read aloud at the end of the exercise.

The script should:
- Sound like a true closing wrap-up, not an opening or preview
- Summarize the journey the team just went through from the first round to the final round
- Reinforce the main lessons the facilitator should land, tied to the expected phases of the exercise
- Give practical next steps the organization should take after the exercise
- Avoid mentioning exact scores, player names, or specific decisions, because those details are not known yet
- End with a strong final line about preparedness and practice

Do NOT use headers, bullet points, numbered lists, or markdown. Write pure spoken prose with natural transitions and occasional stage directions like [pause] only when helpful. Aim for 320-420 words.`;

  logger.info('Generating facilitator pre-session closing script', { scenarioTitle, totalRounds });
  return callAI(prompt);
}
