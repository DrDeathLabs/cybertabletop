import { useEffect, useState, useRef, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  BookOpen,
  ToggleLeft,
  ToggleRight,
  Loader2,
  AlertTriangle,
  ChevronDown,
  Zap,
  Trophy,
  MessageSquare,
  Sparkles,
  Library,
  CheckCircle2,
  Circle,
  Building2,
  Bot,
  Eye,
  Search,
  X,
} from 'lucide-react';
import Layout from '../components/shared/Layout';
import { useApi } from '../hooks/useApi';
import { useAuthStore } from '../stores/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Scenario {
  id: string;
  title: string;
  description: string;
  type: string;
  difficulty: string;
  objectives: string[];
  _count?: { injects: number };
}

interface SessionSettings {
  speedBonusEnabled: boolean;
  showLeaderboard: boolean;
  showFeedbackImmediately: boolean;
}

interface CreateSessionResponse {
  session: { id: string; joinCode: string };
}

interface ScenarioSetup {
  title: string;
  description: string;
  objectives: string[];
  phases: string[];
}

interface GeneratedInject {
  phaseOrder: number;
  injectOrder: number;
  phase: string;
  title: string;
  narrative: string;
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
}

function AddableList({ values, onChange, options }: {
  values: string[];
  onChange: (v: string[]) => void;
  options: string[];
}) {
  const [pending, setPending] = useState('');
  const available = options.filter((option) => !values.includes(option));

  const add = () => {
    const value = pending || available[0];
    if (!value || values.includes(value)) return;
    onChange([...values, value]);
    setPending('');
  };

  const remove = (value: string) => onChange(values.filter((entry) => entry !== value));

  return (
    <div className="space-y-2">
      {values.map((value) => (
        <div
          key={value}
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30"
        >
          <span className="text-sm text-purple-200">{value}</span>
          <button
            type="button"
            onClick={() => remove(value)}
            className="text-purple-300 hover:text-red-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      {available.length > 0 && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <select
              value={pending}
              onChange={(e) => setPending(e.target.value)}
              className="w-full appearance-none bg-slate-900 border border-slate-600 rounded-lg pl-4 pr-10 py-2.5 text-slate-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-colors text-sm cursor-pointer"
            >
              <option value="">— Select an asset —</option>
              {available.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>
          <button
            type="button"
            onClick={add}
            disabled={!pending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      )}
    </div>
  );
}

interface FinalizeResponse {
  session: { id: string; joinCode: string };
  scenarioId: string;
  scenarioTitle: string;
}

// Generation progress state
interface AiGen {
  step: 'setup' | 'inject' | 'saving' | 'done';
  injectCurrent: number; // 1-indexed inject being generated right now
  injectTotal: number;
  currentPhase: string;
  scenarioTitle: string;
  completedInjects: Array<{ phase: string; title: string }>;
  liveText: string; // raw token stream for the inject currently being generated
}

type Mode = 'library' | 'ai' | 'ai-driven';

// ─── Constants ────────────────────────────────────────────────────────────────

const SCENARIO_TYPES = [
  { value: 'RANSOMWARE', label: 'Ransomware Attack' },
  { value: 'DATA_BREACH', label: 'Data Breach' },
  { value: 'INSIDER_THREAT', label: 'Insider Threat' },
  { value: 'BEC', label: 'Business Email Compromise' },
  { value: 'SUPPLY_CHAIN', label: 'Supply Chain Attack' },
  { value: 'DDoS', label: 'Distributed Denial of Service' },
  { value: 'APT', label: 'Advanced Persistent Threat' },
  { value: 'CUSTOM', label: 'Custom Cybersecurity Incident' },
];

const DIFFICULTY_OPTIONS = [
  {
    value: 'BEGINNER',
    label: 'Beginner',
    desc: 'Clear right/wrong choices, basic concepts',
    color: 'text-green-400',
    border: 'border-green-500/40',
    bg: 'bg-green-500/10',
  },
  {
    value: 'INTERMEDIATE',
    label: 'Intermediate',
    desc: 'Moderate depth, some nuance required',
    color: 'text-yellow-400',
    border: 'border-yellow-500/40',
    bg: 'bg-yellow-500/10',
  },
  {
    value: 'ADVANCED',
    label: 'Advanced',
    desc: 'Complex trade-offs, significant depth',
    color: 'text-orange-400',
    border: 'border-orange-500/40',
    bg: 'bg-orange-500/10',
  },
  {
    value: 'EXPERT',
    label: 'Expert',
    desc: 'Nation-state level, board impact',
    color: 'text-red-400',
    border: 'border-red-500/40',
    bg: 'bg-red-500/10',
  },
];

const DIFFICULTY_BADGES: Record<string, string> = {
  BEGINNER: 'bg-green-500/10 border-green-500/30 text-green-300',
  INTERMEDIATE: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
  ADVANCED: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
  EXPERT: 'bg-red-500/10 border-red-500/30 text-red-300',
};

const INDUSTRIES = [
  'Federal / Civilian',
  'Department of War',
  'Government / State & Local',
  'Defense / DoD Contractor',
  'Financial Services / Banking',
  'Financial Services / Insurance',
  'Healthcare / Hospital',
  'Healthcare / Health Plan',
  'Retail / E-Commerce',
  'Energy / Utilities',
  'Energy / Oil & Gas',
  'Manufacturing',
  'Technology / SaaS',
  'Technology / Cloud Provider',
  'Telecommunications',
  'Education / Higher Ed',
  'Education / K-12',
  'Transportation / Logistics',
  'Legal / Professional Services',
  'Media / Entertainment',
  'Pharmaceutical / Biotech',
  'Critical Infrastructure',
];

const CROWN_JEWELS_OPTIONS = [
  'Personally Identifiable Information (PII)',
  'Controlled Unclassified Information (CUI)',
  'Financial Data / Payment Systems',
  'Intellectual Property / Source Code',
  'Authentication Systems / Identity Provider',
  'Active Directory / Domain Controllers',
  'Critical Infrastructure / SCADA / ICS',
  'Cloud Infrastructure / AWS / Azure / GCP',
  'Email Systems / Collaboration Tools',
  'Backup Systems / Disaster Recovery',
  'Financial Systems / ERP',
  'Supply Chain / Vendor Data',
  'Encryption Keys / PKI',
  'Network Infrastructure / Firewalls / Routers',
  'Security Tools / SIEM / SOC Platform',
  'Citizen Service Portals / Case Management',
  'Mission Systems / Operational Data',
  'Personnel Records / HR Data',
  'Legal / Contracts',
  'Customer Data / CRM',
];

// Setup thinking messages — cycle while waiting for the setup API call
const SETUP_MESSAGES = [
  'Analyzing threat landscape…',
  'Researching attack vectors…',
  'Building narrative arc…',
  'Mapping MITRE ATT&CK techniques…',
  'Designing phase structure…',
  'Calibrating difficulty level…',
  'Generating learning objectives…',
  'Profiling threat actors…',
  'Scoping blast radius…',
  'Assembling scenario brief…',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({
  label,
  description,
  icon,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
        checked
          ? 'bg-blue-500/10 border-blue-500/40'
          : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600'
      }`}
    >
      <div
        className={`p-2 rounded-lg flex-shrink-0 ${
          checked ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-500'
        }`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${checked ? 'text-blue-300' : 'text-slate-300'}`}>
          {label}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <div className="flex-shrink-0">
        {checked ? (
          <ToggleRight className="w-6 h-6 text-blue-400" />
        ) : (
          <ToggleLeft className="w-6 h-6 text-slate-600" />
        )}
      </div>
    </button>
  );
}

function SessionSettingsPanel({
  settings,
  setSettings,
}: {
  settings: SessionSettings;
  setSettings: React.Dispatch<React.SetStateAction<SessionSettings>>;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6">
      <h2 className="text-base font-semibold text-white mb-4">Session Settings</h2>
      <div className="space-y-3">
        <Toggle
          label="Speed Bonus"
          description="Award bonus points for faster decisions"
          icon={<Zap className="w-4 h-4" />}
          checked={settings.speedBonusEnabled}
          onChange={(v) => setSettings((s) => ({ ...s, speedBonusEnabled: v }))}
        />
        <Toggle
          label="Show Leaderboard"
          description="Display live rankings to all players"
          icon={<Trophy className="w-4 h-4" />}
          checked={settings.showLeaderboard}
          onChange={(v) => setSettings((s) => ({ ...s, showLeaderboard: v }))}
        />
        <Toggle
          label="Show Feedback Immediately"
          description="Players see feedback right after submitting (not after reveal)"
          icon={<MessageSquare className="w-4 h-4" />}
          checked={settings.showFeedbackImmediately}
          onChange={(v) => setSettings((s) => ({ ...s, showFeedbackImmediately: v }))}
        />
      </div>
    </div>
  );
}

// Live generation progress panel shown while AI is running
function GenerationProgress({ gen }: { gen: AiGen }) {
  const totalSteps = gen.injectTotal + 2; // setup + injects + saving
  const doneSteps =
    gen.step === 'setup'
      ? 0
      : gen.step === 'inject'
        ? gen.injectCurrent  // setup done + injects done so far
        : gen.step === 'saving'
          ? gen.injectTotal + 1
          : totalSteps;
  const pct = Math.round((doneSteps / totalSteps) * 100);

  // Cycling thinking message during setup
  const [setupMsgIdx, setSetupMsgIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (gen.step !== 'setup') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(
      () => setSetupMsgIdx((i) => (i + 1) % SETUP_MESSAGES.length),
      2400,
    );
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [gen.step]);

  return (
    <div className="bg-slate-800 border border-purple-500/30 rounded-xl p-5 space-y-4">
      {/* Title + progress bar */}
      <div>
        {gen.scenarioTitle && (
          <p className="text-sm font-semibold text-white mb-2 truncate">
            {gen.scenarioTitle}
          </p>
        )}
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-700"
              style={{ width: `${Math.max(pct, gen.step === 'setup' ? 3 : 0)}%` }}
            />
          </div>
          <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-1.5">
        {/* Setup step */}
        <div className="flex items-start gap-2.5 text-xs">
          {gen.step === 'setup' ? (
            <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin flex-shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <span className={gen.step === 'setup' ? 'text-purple-300' : 'text-slate-400'}>
              {gen.step === 'setup'
                ? SETUP_MESSAGES[setupMsgIdx]
                : 'Scenario overview generated'}
            </span>
          </div>
        </div>

        {/* Inject steps */}
        {Array.from({ length: gen.injectTotal }, (_, i) => {
          const isDone = gen.completedInjects[i] !== undefined;
          const isActive = gen.step === 'inject' && gen.injectCurrent === i + 1;
          const label = gen.completedInjects[i]
            ? gen.completedInjects[i].title
            : isActive
              ? gen.currentPhase
              : `Round ${i + 1}`;
          return (
            <div key={i} className="flex items-center gap-2.5 text-xs">
              {isDone ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
              ) : isActive ? (
                <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin flex-shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
              )}
              <span
                className={isDone ? 'text-slate-400' : isActive ? 'text-purple-300' : 'text-slate-600'}
              >
                {isDone ? (
                  <><span className="text-slate-500">Round {i + 1}: </span>{label}</>
                ) : isActive ? (
                  `Round ${i + 1}: ${label} — generating…`
                ) : (
                  `Round ${i + 1}`
                )}
              </span>
            </div>
          );
        })}

        {/* Saving step */}
        <div className="flex items-center gap-2.5 text-xs">
          {gen.step === 'saving' ? (
            <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin flex-shrink-0" />
          ) : gen.step === 'done' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
          ) : (
            <Circle className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
          )}
          <span
            className={
              gen.step === 'saving' ? 'text-purple-300' : gen.step === 'done' ? 'text-slate-400' : 'text-slate-600'
            }
          >
            Creating session…
          </span>
        </div>
      </div>

    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CreateSessionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { get, post } = useApi();
  const logout = useAuthStore((s) => s.logout);

  const preselectedScenarioId = searchParams.get('scenarioId') ?? '';
  const [mode, setMode] = useState<Mode>('library');

  // ── Library state ──────────────────────────────────────────────────────────
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenariosLoading, setScenariosLoading] = useState(true);
  const [selectedScenarioId, setSelectedScenarioId] = useState(preselectedScenarioId);
  const [librarySearch, setLibrarySearch] = useState('');
  const [librarySessionName, setLibrarySessionName] = useState('');

  // ── AI state ───────────────────────────────────────────────────────────────
  const [aiSessionName, setAiSessionName] = useState('');
  const [aiType, setAiType] = useState('RANSOMWARE');
  const [aiDifficulty, setAiDifficulty] = useState('INTERMEDIATE');
  const [aiRounds, setAiRounds] = useState(4);
  const [aiOrgName, setAiOrgName] = useState('');
  const [aiIndustry, setAiIndustry] = useState('');
  const [aiCrownJewels, setAiCrownJewels] = useState<string[]>([]);
  const [aiGen, setAiGen] = useState<AiGen | null>(null);

  // ── AI-Driven state ────────────────────────────────────────────────────────
  const [adSessionName, setAdSessionName] = useState('');
  const [adType, setAdType] = useState('RANSOMWARE');
  const [adDifficulty, setAdDifficulty] = useState('INTERMEDIATE');
  const [adObjectives, setAdObjectives] = useState('');
  const [adRounds, setAdRounds] = useState(5);
  const [adPreviewMode, setAdPreviewMode] = useState(true);
  const adPlayerOnboarding = false;

  // ── Shared ─────────────────────────────────────────────────────────────────
  const [settings, setSettings] = useState<SessionSettings>({
    speedBonusEnabled: true,
    showLeaderboard: true,
    showFeedbackImmediately: false,
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    get<{ scenarios: Scenario[] }>('/api/scenarios')
      .then((data) => {
        const list = data.scenarios ?? [];
        setScenarios(list);
        if (!selectedScenarioId && list.length > 0) setSelectedScenarioId(list[0].id);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setScenariosLoading(false));
  }, [get, selectedScenarioId]);

  const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId);
  const normalizedLibrarySearch = librarySearch.trim().toLowerCase();
  const filteredScenarios = scenarios.filter((scenario) => {
    if (!normalizedLibrarySearch) return true;

    const haystack = [
      scenario.title,
      scenario.description,
      scenario.type,
      scenario.difficulty,
      ...(scenario.objectives ?? []),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedLibrarySearch);
  });

  useEffect(() => {
    if (scenariosLoading) return;
    if (filteredScenarios.length === 0) return;
    if (!selectedScenarioId || !filteredScenarios.some((scenario) => scenario.id === selectedScenarioId)) {
      setSelectedScenarioId(filteredScenarios[0].id);
    }
  }, [filteredScenarios, scenariosLoading, selectedScenarioId]);

  const selectedLibraryScenario = filteredScenarios.find((scenario) => scenario.id === selectedScenarioId)
    ?? selectedScenario;

  const formatScenarioType = (type: string | undefined) => {
    if (!type) return 'Scenario';
    if (type === 'DDoS' || type === 'DDOS') return 'DDoS';
    return type.replace(/_/g, ' ');
  };

  const fetchWithRefresh = async (url: string, body: object) => {
    const doFetch = () => fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    let response = await doFetch();
    if (response.status !== 401) return response;

    const refreshed = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });

    if (!refreshed.ok) {
      logout();
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    response = await doFetch();
    return response;
  };

  // ── Library submit ─────────────────────────────────────────────────────────
  const handleLibrarySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedScenarioId) { setError('Please select a scenario.'); return; }
    setError('');
    setCreating(true);
    try {
      const data = await post<CreateSessionResponse>('/api/sessions', {
        scenarioId: selectedScenarioId,
        sessionName: librarySessionName.trim() || undefined,
        settings,
      });
      navigate(`/sessions/${data.session.id}/lobby`);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to create session.');
    } finally {
      setCreating(false);
    }
  };

  // ── Streaming setup fetch — reads SSE token stream, resolves with ScenarioSetup ──
  const streamSetup = async (
    payload: object,
    onToken: (t: string) => void,
  ): Promise<ScenarioSetup> => {
    const resp = await fetchWithRefresh('/api/sessions/generate/setup/stream', payload);

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
      throw new Error((err as { error?: string }).error ?? `Request failed (${resp.status})`);
    }

    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const msg = JSON.parse(line.slice(6)) as {
          t?: string; done?: boolean; setup?: ScenarioSetup; error?: string;
        };
        if (msg.error) throw new Error(msg.error);
        if (msg.t) onToken(msg.t);
        if (msg.done && msg.setup) return msg.setup;
      }
    }
    throw new Error('Setup stream ended without completing');
  };

  // ── Streaming inject fetch — reads SSE token stream, resolves with full inject ──
  const streamInject = async (
    payload: object,
    onToken: (t: string) => void,
  ): Promise<GeneratedInject> => {
    const resp = await fetchWithRefresh('/api/sessions/generate/inject/stream', payload);

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
      throw new Error((err as { error?: string }).error ?? `Request failed (${resp.status})`);
    }

    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const msg = JSON.parse(line.slice(6)) as {
          t?: string; done?: boolean; inject?: GeneratedInject; error?: string;
        };
        if (msg.error) throw new Error(msg.error);
        if (msg.t) onToken(msg.t);
        if (msg.done && msg.inject) return msg.inject;
      }
    }
    throw new Error('Stream ended without completing');
  };

  // ── AI submit — multi-step ─────────────────────────────────────────────────
  const handleAiSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    setAiGen({
      step: 'setup',
      injectCurrent: 0,
      injectTotal: aiRounds,
      currentPhase: '',
      scenarioTitle: aiOrgName ? `${aiOrgName} Scenario` : '',
      completedInjects: [],
      liveText: '',
    });

    try {
      // ── Step 1: scenario overview (streamed) ──────────────────────────────
      const setup = await streamSetup(
        {
          type: aiType,
          difficulty: aiDifficulty,
          rounds: aiRounds,
          orgName: aiOrgName,
          industry: aiIndustry,
          crownJewels: aiCrownJewels,
        },
        (token) => setAiGen((g) => g ? { ...g, liveText: g.liveText + token } : g),
      );

      setAiGen((g) => g && ({
        ...g,
        step: 'inject',
        injectCurrent: 1,
        injectTotal: aiRounds,
        currentPhase: setup.phases[0] ?? 'Round 1',
        scenarioTitle: setup.title,
        liveText: '',
      }));

      // ── Step 2: one inject per round (streamed) ────────────────────────────
      const completedInjects: GeneratedInject[] = [];

      for (let i = 0; i < aiRounds; i++) {
        const phase = setup.phases[i] ?? `Round ${i + 1}`;

        // Reset live text for this inject
        setAiGen((g) => g && ({ ...g, liveText: '', currentPhase: phase }));

        const inject = await streamInject(
          {
            type: aiType,
            difficulty: aiDifficulty,
            rounds: aiRounds,
            injectIndex: i,
            phase,
            scenarioSetup: { title: setup.title, description: setup.description },
            previousInjects: completedInjects.map((inj) => ({
              phase: inj.phase,
              title: inj.title,
              narrative: inj.narrative,
            })),
            orgName: aiOrgName,
            industry: aiIndustry,
            crownJewels: aiCrownJewels,
          },
          (token) => setAiGen((g) => g ? { ...g, liveText: g.liveText + token } : g),
        );

        completedInjects.push(inject);

        setAiGen((g) => g && ({
          ...g,
          injectCurrent: i + 2,
          currentPhase: setup.phases[i + 1] ?? '',
          liveText: '',
          completedInjects: completedInjects.map((inj) => ({
            phase: inj.phase,
            title: inj.title,
          })),
        }));
      }

      // ── Step 3: save + create session ─────────────────────────────────────
      setAiGen((g) => g && ({ ...g, step: 'saving', liveText: '' }));

      const result = await post<FinalizeResponse>('/api/sessions/generate/finalize', {
        type: aiType,
        difficulty: aiDifficulty,
        orgName: aiOrgName,
        industry: aiIndustry,
        crownJewels: aiCrownJewels,
        settings,
        sessionName: aiSessionName.trim() || undefined,
        scenarioSetup: {
          title: setup.title,
          description: setup.description,
          objectives: setup.objectives,
        },
        injects: completedInjects,
      });

      setAiGen((g) => g && ({ ...g, step: 'done' }));
      navigate(`/sessions/${result.session.id}/lobby`);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'AI scenario generation failed. Please try again.');
      setAiGen(null);
    } finally {
      setCreating(false);
    }
  };

  // ── AI-Driven submit ──────────────────────────────────────────────────────
  const handleAiDrivenSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const result = await post<{ session: { id: string }; aiDriven: boolean }>('/api/sessions', {
        aiDriven: true,
        sessionName: adSessionName.trim() || undefined,
        aiPreviewMode: adPreviewMode,
        playerOnboarding: adPlayerOnboarding,
        scenarioType: adType,
        difficulty: adDifficulty,
        objectives: adObjectives || undefined,
        approximateRounds: adRounds,
        settings,
      });
      // If facilitator fills out onboarding; if player-driven, go straight to lobby
      if (adPlayerOnboarding) {
        navigate(`/sessions/${result.session.id}/lobby`);
      } else {
        navigate(`/sessions/${result.session.id}/onboarding`);
      }
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to create AI-driven session.');
    } finally {
      setCreating(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className={`p-6 mx-auto ${mode === 'library' ? 'max-w-6xl' : 'max-w-2xl'}`}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/30">
            <Plus className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Create Session</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Configure and launch a new tabletop exercise
            </p>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-6 p-1 bg-slate-800 rounded-xl border border-slate-700/50">
          <button
            type="button"
            onClick={() => { setMode('library'); setError(''); setAiGen(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              mode === 'library'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Library className="w-4 h-4" />
            From Library
          </button>
          <button
            type="button"
            onClick={() => { setMode('ai'); setError(''); setAiGen(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              mode === 'ai'
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            AI Generated
          </button>
          <button
            type="button"
            onClick={() => { setMode('ai-driven'); setError(''); setAiGen(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              mode === 'ai-driven'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-4 h-4" />
            AI-Driven
          </button>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {/* ── Library mode ─────────────────────────────────────────────────── */}
        {mode === 'library' && (
          <form onSubmit={handleLibrarySubmit} className="space-y-8">
            <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-semibold text-white">Select Scenario</h2>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                  Session Name <span className="text-slate-600 normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={librarySessionName}
                  onChange={(e) => setLibrarySessionName(e.target.value)}
                  placeholder="e.g., Q2 Ransomware Readiness Drill"
                  maxLength={100}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors text-sm"
                />
              </div>

              {scenariosLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading scenarios…
                </div>
              ) : scenarios.length === 0 ? (
                <div className="text-slate-500 text-sm">
                  No scenarios available.{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/scenarios/new')}
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Create one first.
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={librarySearch}
                      onChange={(e) => setLibrarySearch(e.target.value)}
                      placeholder="Search by title, type, description, or objective"
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors text-sm"
                    />
                  </div>

                  {filteredScenarios.length === 0 ? (
                    <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-4 py-8 text-center text-sm text-slate-500">
                      No library scenarios match that search yet.
                    </div>
                  ) : (
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                      <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-700/60 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">Scenario Library</p>
                            <p className="text-xs text-slate-500">
                              Browse and compare before you launch
                            </p>
                          </div>
                          <span className="text-xs text-slate-500">
                            {filteredScenarios.length} shown
                          </span>
                        </div>

                        <div className="max-h-[34rem] overflow-y-auto p-3 space-y-3">
                          {filteredScenarios.map((scenario) => {
                            const isSelected = scenario.id === selectedScenarioId;
                            return (
                              <button
                                key={scenario.id}
                                type="button"
                                onClick={() => setSelectedScenarioId(scenario.id)}
                                className={`w-full rounded-xl border p-4 text-left transition-all ${
                                  isSelected
                                    ? 'bg-blue-500/10 border-blue-500/40 shadow-[0_0_0_1px_rgba(59,130,246,0.2)]'
                                    : 'bg-slate-800/70 border-slate-700/60 hover:border-slate-500/80 hover:bg-slate-800'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <div className="min-w-0">
                                    <p className={`text-sm font-semibold ${isSelected ? 'text-blue-200' : 'text-white'}`}>
                                      {scenario.title}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                      {formatScenarioType(scenario.type)}
                                    </p>
                                  </div>
                                  <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${DIFFICULTY_BADGES[scenario.difficulty] ?? 'border-slate-600 text-slate-300'}`}>
                                    {scenario.difficulty}
                                  </span>
                                </div>

                                <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">
                                  {scenario.description}
                                </p>

                                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                  {scenario._count?.injects != null && (
                                    <span className="rounded-full bg-slate-700/60 px-2.5 py-1">
                                      {scenario._count.injects} rounds
                                    </span>
                                  )}
                                  <span className="rounded-full bg-slate-700/60 px-2.5 py-1">
                                    {scenario.objectives?.length ?? 0} objectives
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {selectedLibraryScenario && (
                        <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-5 space-y-5">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${DIFFICULTY_BADGES[selectedLibraryScenario.difficulty] ?? 'border-slate-600 text-slate-300'}`}>
                                {selectedLibraryScenario.difficulty}
                              </span>
                              <span className="rounded-full bg-slate-700/60 px-2.5 py-1 text-[11px] text-slate-300">
                                {formatScenarioType(selectedLibraryScenario.type)}
                              </span>
                              {selectedLibraryScenario._count?.injects != null && (
                                <span className="rounded-full bg-slate-700/60 px-2.5 py-1 text-[11px] text-slate-300">
                                  {selectedLibraryScenario._count.injects} rounds
                                </span>
                              )}
                            </div>

                            <h3 className="text-xl font-semibold text-white leading-tight">
                              {selectedLibraryScenario.title}
                            </h3>
                            <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                              {selectedLibraryScenario.description}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                              Learning Objectives
                            </p>
                            <div className="space-y-2">
                              {selectedLibraryScenario.objectives?.map((objective, index) => (
                                <div
                                  key={`${selectedLibraryScenario.id}-objective-${index}`}
                                  className="rounded-lg border border-slate-700/60 bg-slate-800/80 px-3 py-2.5 text-sm text-slate-200 leading-relaxed"
                                >
                                  {objective}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-3">
                            <p className="text-xs font-medium text-blue-300 uppercase tracking-wide mb-1.5">
                              Selected For Launch
                            </p>
                            <p className="text-sm text-slate-200">
                              This scenario will be used for the new session as soon as you click <span className="font-semibold text-white">Create Session</span>.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <SessionSettingsPanel settings={settings} setSettings={setSettings} />

            <button
              type="submit"
              disabled={creating || !selectedScenarioId || scenariosLoading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3.5 transition-colors text-base"
            >
              {creating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating session…
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Create Session
                </>
              )}
            </button>
          </form>
        )}

        {/* ── AI Generated mode ─────────────────────────────────────────────── */}
        {mode === 'ai' && (
          <form onSubmit={handleAiSubmit} className="space-y-6">
            {/* Config card — hidden while generating */}
            {!creating && (
              <>
                <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <h2 className="text-base font-semibold text-white">Scenario Configuration</h2>
                  </div>

                  <div className="space-y-5">
                    {/* Session name */}
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                        Session Name <span className="text-slate-600 normal-case font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={aiSessionName}
                        onChange={(e) => setAiSessionName(e.target.value)}
                        placeholder="e.g., Q2 Ransomware Readiness Drill"
                        maxLength={100}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-colors text-sm"
                      />
                    </div>

                    {/* Organization context */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                          <span className="flex items-center gap-1.5">
                            <Building2 className="w-3 h-3" />
                            Organization Name
                            <span className="text-slate-600 normal-case font-normal">(optional)</span>
                          </span>
                        </label>
                        <input
                          type="text"
                          value={aiOrgName}
                          onChange={(e) => setAiOrgName(e.target.value)}
                          placeholder="e.g. Acme Corp"
                          maxLength={100}
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-colors text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                          Industry Sector
                          <span className="text-slate-600 font-normal normal-case ml-1">(optional)</span>
                        </label>
                        <div className="relative">
                          <select
                            value={aiIndustry}
                            onChange={(e) => setAiIndustry(e.target.value)}
                            className="w-full appearance-none bg-slate-900 border border-slate-600 rounded-lg pl-3 pr-8 py-2.5 text-slate-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-colors text-sm cursor-pointer"
                          >
                            <option value="">— Select industry —</option>
                            {INDUSTRIES.map((ind) => (
                              <option key={ind} value={ind}>{ind}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                        Primary Assets / Data Types
                        <span className="text-slate-600 font-normal normal-case ml-1">(optional)</span>
                      </label>
                      <p className="text-xs text-slate-500 mb-2">
                        Add the systems or data types this scenario should revolve around.
                      </p>
                      <AddableList
                        values={aiCrownJewels}
                        onChange={setAiCrownJewels}
                        options={CROWN_JEWELS_OPTIONS}
                      />
                    </div>

                    {/* Org context hint */}
                    {(aiOrgName || aiIndustry || aiCrownJewels.length > 0) && (
                      <div className="flex items-start gap-2 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2.5 text-xs text-purple-300">
                        <Sparkles className="w-3 h-3 flex-shrink-0 mt-0.5 text-purple-400" />
                        <span>
                          The AI will tailor this scenario for{' '}
                          {aiOrgName && <strong>{aiOrgName}</strong>}
                          {aiOrgName && aiIndustry && ' in the '}
                          {aiIndustry && <strong>{aiIndustry}</strong>}
                          {aiIndustry && ' sector'}
                          {aiCrownJewels.length > 0 && (
                            <>
                              {' '}with emphasis on <strong>{aiCrownJewels.join(', ')}</strong>
                            </>
                          )} — including sector-specific threat actors,
                          regulatory context, and the assets you selected.
                        </span>
                      </div>
                    )}

                    {/* Type */}
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                        Scenario Type
                      </label>
                      <div className="relative">
                        <select
                          value={aiType}
                          onChange={(e) => setAiType(e.target.value)}
                          className="w-full appearance-none bg-slate-900 border border-slate-600 rounded-lg pl-4 pr-10 py-2.5 text-slate-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-colors text-sm cursor-pointer"
                        >
                          {SCENARIO_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                      </div>
                    </div>

                    {/* Difficulty */}
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                        Difficulty
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {DIFFICULTY_OPTIONS.map((d) => (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => setAiDifficulty(d.value)}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              aiDifficulty === d.value
                                ? `${d.bg} ${d.border}`
                                : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600'
                            }`}
                          >
                            <p className={`text-sm font-semibold ${d.color}`}>{d.label}</p>
                            <p className="text-xs text-slate-500 mt-0.5 leading-tight">{d.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Rounds */}
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                        Number of Rounds
                        <span className="ml-2 text-purple-400 font-bold normal-case">
                          {aiRounds}
                        </span>
                      </label>
                      <input
                        type="range"
                        min={2}
                        max={10}
                        value={aiRounds}
                        onChange={(e) => setAiRounds(Number(e.target.value))}
                        className="w-full accent-purple-500"
                      />
                      <div className="flex justify-between text-xs text-slate-600 mt-1">
                        <span>2 (quick)</span>
                        <span>6 (standard)</span>
                        <span>10 (full)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <SessionSettingsPanel settings={settings} setSettings={setSettings} />
              </>
            )}

            {/* Live generation progress */}
            {creating && aiGen && <GenerationProgress gen={aiGen} />}

            <button
              type="submit"
              disabled={creating}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/40 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3.5 transition-colors text-base"
            >
              {creating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>
                    {aiGen?.step === 'setup'
                      ? 'Building scenario…'
                      : aiGen?.step === 'inject'
                        ? `Round ${aiGen.injectCurrent} of ${aiGen.injectTotal}…`
                        : 'Creating session…'}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate &amp; Launch
                </>
              )}
            </button>
          </form>
        )}

        {/* ── AI-Driven mode ─────────────────────────────────────────────── */}
        {mode === 'ai-driven' && (
          <form onSubmit={handleAiDrivenSubmit} className="space-y-6">
            {/* Header callout */}
            <div className="flex items-start gap-3 bg-emerald-900/20 border border-emerald-500/30 rounded-xl px-4 py-3">
              <Bot className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-300">Fully Adaptive Exercise</p>
                <p className="text-xs text-emerald-200/60 mt-0.5">
                  The AI generates each inject in real time, adapting the scenario based on how your team responds. No pre-scripted injects required.
                </p>
              </div>
            </div>

            {/* Scenario config */}
            <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Bot className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-semibold text-white">Scenario Configuration</h2>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Exercise Name <span className="text-slate-500 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={adSessionName}
                  onChange={e => setAdSessionName(e.target.value)}
                  placeholder="e.g., Q2 Ransomware Readiness Drill"
                  maxLength={100}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Incident Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {SCENARIO_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setAdType(t.value)}
                      className={`px-3 py-2 rounded-lg text-sm text-left border transition-all ${
                        adType === t.value
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-medium'
                          : 'bg-slate-900/60 border-slate-700/50 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Difficulty</label>
                <div className="grid grid-cols-2 gap-2">
                  {DIFFICULTY_OPTIONS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setAdDifficulty(d.value)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        adDifficulty === d.value
                          ? `${d.bg} ${d.border}`
                          : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600'
                      }`}
                    >
                      <p className={`text-sm font-medium ${adDifficulty === d.value ? d.color : 'text-slate-300'}`}>{d.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{d.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Total Rounds: <span className="text-emerald-400 font-semibold">{adRounds}</span> <span className="text-slate-500 font-normal text-xs">(last round is always recovery)</span>
                </label>
                <input
                  type="range" min={2} max={12} step={1} value={adRounds}
                  onChange={e => setAdRounds(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>2 (Quick)</span><span>7 (Standard)</span><span>12 (Extended)</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Learning Objectives <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <textarea
                  value={adObjectives}
                  onChange={e => setAdObjectives(e.target.value)}
                  placeholder="One per line, e.g.&#10;Assess ransomware containment decisions&#10;Test executive communication protocol"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-emerald-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            {/* Facilitator options */}
            <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Eye className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-semibold text-white">Facilitator Options</h2>
              </div>

              <Toggle
                label="Preview & edit each inject before presenting"
                description="You'll see each AI-generated inject first and can edit it before players see it."
                icon={<Eye className="w-4 h-4" />}
                checked={adPreviewMode}
                onChange={setAdPreviewMode}
              />
              <p className="text-xs text-slate-500 pl-2">
                You'll complete an org context questionnaire after creating this session.
              </p>
            </div>

            {/* Session settings */}
            <SessionSettingsPanel settings={settings} setSettings={setSettings} />

            <button
              type="submit"
              disabled={creating}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/40 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3.5 transition-colors text-base"
            >
              {creating ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Creating session…</>
              ) : (
                <><Bot className="w-5 h-5" /> Create AI-Driven Session</>
              )}
            </button>
          </form>
        )}
      </div>
    </Layout>
  );
}
