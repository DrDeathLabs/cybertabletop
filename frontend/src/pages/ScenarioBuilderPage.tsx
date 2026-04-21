import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  GripVertical,
  CheckCircle,
  Loader2,
  AlertTriangle,
  BookOpen,
  List,
  Eye,
  Save,
  ArrowUp,
  ArrowDown,
  Star,
} from 'lucide-react';
import Layout from '../components/shared/Layout';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/shared/Toaster';

// ─── Types ────────────────────────────────────────────────────────────────────

const IR_ROLES = [
  'Incident Commander',
  'IR Lead',
  'Threat Analyst',
  'Communications/PR',
  'Legal/Compliance',
  'Executive/CISO',
  'IT/Sysadmin',
  'HR',
];

const NIST_FUNCTIONS = ['IDENTIFY', 'PROTECT', 'DETECT', 'RESPOND', 'RECOVER'];

const SCENARIO_TYPES = [
  'RANSOMWARE',
  'PHISHING',
  'DATA_BREACH',
  'INSIDER_THREAT',
  'SUPPLY_CHAIN',
  'APT',
  'DDOS',
  'CUSTOM',
];

const DIFFICULTIES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];

const INJECT_PHASES = [
  'Initial Detection',
  'Investigation',
  'Containment',
  'Eradication',
  'Recovery',
  'Post-Incident',
  'Custom',
];

interface InjectOption {
  id: string;
  text: string;
  scoreWeight: number;
  isOptimal: boolean;
  scriptedFeedback: string;
  feedbackTags: string;
}

interface InjectDraft {
  id: string;
  phase: string;
  customPhase: string;
  title: string;
  narrative: string;
  roleVisibility: string[];
  mitreAttackId: string;
  mitreAttackName: string;
  nistCsfFunction: string;
  timerSeconds: string;
  options: InjectOption[];
}

interface ScenarioMeta {
  title: string;
  description: string;
  type: string;
  difficulty: string;
  objectives: string[];
}

function newOption(): InjectOption {
  return {
    id: crypto.randomUUID(),
    text: '',
    scoreWeight: 50,
    isOptimal: false,
    scriptedFeedback: '',
    feedbackTags: '',
  };
}

function newInject(): InjectDraft {
  return {
    id: crypto.randomUUID(),
    phase: 'Initial Detection',
    customPhase: '',
    title: '',
    narrative: '',
    roleVisibility: [...IR_ROLES],
    mitreAttackId: '',
    mitreAttackName: '',
    nistCsfFunction: 'RESPOND',
    timerSeconds: '',
    options: [newOption(), newOption()],
  };
}

// ─── Step 1: Metadata ─────────────────────────────────────────────────────────

function MetaStep({
  meta,
  onChange,
}: {
  meta: ScenarioMeta;
  onChange: (m: ScenarioMeta) => void;
}) {
  const addObjective = () => onChange({ ...meta, objectives: [...meta.objectives, ''] });
  const updateObjective = (i: number, val: string) => {
    const objs = [...meta.objectives];
    objs[i] = val;
    onChange({ ...meta, objectives: objs });
  };
  const removeObjective = (i: number) =>
    onChange({ ...meta, objectives: meta.objectives.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Title */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Scenario Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={meta.title}
            onChange={(e) => onChange({ ...meta, title: e.target.value })}
            placeholder="e.g. Hospital Ransomware Attack"
            required
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 text-sm transition-colors"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Type</label>
          <select
            value={meta.type}
            onChange={(e) => onChange({ ...meta, type: e.target.value })}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
          >
            {SCENARIO_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        {/* Difficulty */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Difficulty</label>
          <select
            value={meta.difficulty}
            onChange={(e) => onChange({ ...meta, difficulty: e.target.value })}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
          <textarea
            value={meta.description}
            onChange={(e) => onChange({ ...meta, description: e.target.value })}
            rows={3}
            placeholder="Brief overview of this scenario…"
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm resize-none transition-colors"
          />
        </div>
      </div>

      {/* Objectives */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-300">Learning Objectives</label>
          <button
            type="button"
            onClick={addObjective}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Objective
          </button>
        </div>
        <div className="space-y-2">
          {meta.objectives.map((obj, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={obj}
                onChange={(e) => updateObjective(i, e.target.value)}
                placeholder={`Objective ${i + 1}…`}
                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm transition-colors"
              />
              <button
                type="button"
                onClick={() => removeObjective(i)}
                className="text-slate-500 hover:text-red-400 transition-colors p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {meta.objectives.length === 0 && (
            <p className="text-xs text-slate-500 italic">No objectives added yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Option editor ────────────────────────────────────────────────────────────

function OptionEditor({
  option,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  option: InjectOption;
  index: number;
  onChange: (o: InjectOption) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div
      className={`border rounded-xl p-4 space-y-3 ${
        option.isOptimal
          ? 'border-green-500/40 bg-green-500/5'
          : 'border-slate-700/50 bg-slate-900/40'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Option {index + 1}
          {option.isOptimal && (
            <span className="ml-2 text-green-400">
              <Star className="w-3 h-3 inline" /> Optimal
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-400 hover:text-green-400 transition-colors">
            <input
              type="checkbox"
              checked={option.isOptimal}
              onChange={(e) => onChange({ ...option, isOptimal: e.target.checked })}
              className="w-3.5 h-3.5 accent-green-500 cursor-pointer"
            />
            Mark Optimal
          </label>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-slate-600 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Option text */}
      <textarea
        value={option.text}
        onChange={(e) => onChange({ ...option, text: e.target.value })}
        rows={2}
        placeholder="Option text shown to players…"
        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm resize-none"
      />

      {/* Score weight */}
      <div>
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>Score Weight</span>
          <span className="font-mono text-slate-300">{option.scoreWeight}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={option.scoreWeight}
          onChange={(e) => onChange({ ...option, scoreWeight: Number(e.target.value) })}
          className="w-full h-1.5 bg-slate-700 rounded-full accent-blue-500 cursor-pointer"
        />
      </div>

      {/* Scripted feedback */}
      <textarea
        value={option.scriptedFeedback}
        onChange={(e) => onChange({ ...option, scriptedFeedback: e.target.value })}
        rows={2}
        placeholder="Scripted feedback for this choice (shown after reveal)…"
        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs resize-none"
      />

      {/* Feedback tags */}
      <input
        type="text"
        value={option.feedbackTags}
        onChange={(e) => onChange({ ...option, feedbackTags: e.target.value })}
        placeholder="Feedback tags (comma-separated): containment, escalation, …"
        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
      />
    </div>
  );
}

// ─── Step 2: Injects ──────────────────────────────────────────────────────────

function InjectsStep({
  injects,
  onChange,
}: {
  injects: InjectDraft[];
  onChange: (injects: InjectDraft[]) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(injects[0]?.id ?? null);

  const addInject = () => {
    const inject = newInject();
    onChange([...injects, inject]);
    setOpenId(inject.id);
  };

  const removeInject = (id: string) => {
    onChange(injects.filter((i) => i.id !== id));
  };

  const updateInject = (id: string, updated: InjectDraft) => {
    onChange(injects.map((i) => (i.id === id ? updated : i)));
  };

  const moveInject = (idx: number, dir: -1 | 1) => {
    const arr = [...injects];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    onChange(arr);
  };

  const updateOption = (inject: InjectDraft, optionId: string, updated: InjectOption) => {
    updateInject(inject.id, {
      ...inject,
      options: inject.options.map((o) => (o.id === optionId ? updated : o)),
    });
  };

  const addOption = (inject: InjectDraft) => {
    if (inject.options.length >= 6) return;
    updateInject(inject.id, { ...inject, options: [...inject.options, newOption()] });
  };

  const removeOption = (inject: InjectDraft, optionId: string) => {
    if (inject.options.length <= 2) return;
    updateInject(inject.id, {
      ...inject,
      options: inject.options.filter((o) => o.id !== optionId),
    });
  };

  const toggleRole = (inject: InjectDraft, role: string) => {
    const vis = inject.roleVisibility.includes(role)
      ? inject.roleVisibility.filter((r) => r !== role)
      : [...inject.roleVisibility, role];
    updateInject(inject.id, { ...inject, roleVisibility: vis });
  };

  return (
    <div className="space-y-4">
      {injects.length === 0 ? (
        <div className="text-center py-10 bg-slate-900/40 rounded-xl border border-dashed border-slate-700">
          <List className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No injects yet. Add your first one.</p>
        </div>
      ) : (
        injects.map((inject, idx) => (
          <div
            key={inject.id}
            className="bg-slate-900/50 border border-slate-700/50 rounded-xl overflow-hidden"
          >
            {/* Inject header */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-700/30 transition-colors"
              onClick={() => setOpenId(openId === inject.id ? null : inject.id)}
            >
              <GripVertical className="w-4 h-4 text-slate-600 flex-shrink-0" />
              <span className="text-xs font-mono text-slate-500 w-6">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">
                  {inject.title || `Untitled Inject ${idx + 1}`}
                </p>
                <p className="text-xs text-slate-500">
                  {inject.phase === 'Custom' ? inject.customPhase || 'Custom' : inject.phase} ·{' '}
                  {inject.options.length} options
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); moveInject(idx, -1); }}
                  disabled={idx === 0}
                  className="p-1 text-slate-600 hover:text-slate-300 disabled:opacity-30 transition-colors"
                  title="Move up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); moveInject(idx, 1); }}
                  disabled={idx === injects.length - 1}
                  className="p-1 text-slate-600 hover:text-slate-300 disabled:opacity-30 transition-colors"
                  title="Move down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeInject(inject.id); }}
                  className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                  title="Delete inject"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <ChevronRight
                  className={`w-4 h-4 text-slate-500 transition-transform ${
                    openId === inject.id ? 'rotate-90' : ''
                  }`}
                />
              </div>
            </div>

            {/* Inject body */}
            {openId === inject.id && (
              <div className="px-4 pb-5 border-t border-slate-700/50 pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Phase */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                      Phase
                    </label>
                    <select
                      value={inject.phase}
                      onChange={(e) => updateInject(inject.id, { ...inject, phase: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
                    >
                      {INJECT_PHASES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    {inject.phase === 'Custom' && (
                      <input
                        type="text"
                        value={inject.customPhase}
                        onChange={(e) => updateInject(inject.id, { ...inject, customPhase: e.target.value })}
                        placeholder="Custom phase name…"
                        className="mt-2 w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                      />
                    )}
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                      Title <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={inject.title}
                      onChange={(e) => updateInject(inject.id, { ...inject, title: e.target.value })}
                      placeholder="Inject title…"
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                    />
                  </div>

                  {/* MITRE */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                      MITRE ATT&CK ID
                    </label>
                    <input
                      type="text"
                      value={inject.mitreAttackId}
                      onChange={(e) => updateInject(inject.id, { ...inject, mitreAttackId: e.target.value })}
                      placeholder="e.g. T1566"
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
                    />
                  </div>

                  {/* MITRE name */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                      MITRE ATT&CK Name
                    </label>
                    <input
                      type="text"
                      value={inject.mitreAttackName}
                      onChange={(e) => updateInject(inject.id, { ...inject, mitreAttackName: e.target.value })}
                      placeholder="e.g. Phishing"
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                    />
                  </div>

                  {/* NIST CSF */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                      NIST CSF Function
                    </label>
                    <select
                      value={inject.nistCsfFunction}
                      onChange={(e) => updateInject(inject.id, { ...inject, nistCsfFunction: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
                    >
                      {NIST_FUNCTIONS.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  {/* Timer */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                      Timer (seconds, optional)
                    </label>
                    <input
                      type="number"
                      value={inject.timerSeconds}
                      onChange={(e) => updateInject(inject.id, { ...inject, timerSeconds: e.target.value })}
                      placeholder="e.g. 120"
                      min={10}
                      max={600}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>

                {/* Narrative */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                    Narrative <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={inject.narrative}
                    onChange={(e) => updateInject(inject.id, { ...inject, narrative: e.target.value })}
                    rows={4}
                    placeholder="Describe the incident situation players will face…"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm resize-none"
                  />
                </div>

                {/* Role visibility */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                    Role Visibility
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {IR_ROLES.map((role) => {
                      const active = inject.roleVisibility.includes(role);
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => toggleRole(inject, role)}
                          className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                            active
                              ? 'bg-blue-500/15 text-blue-400 border-blue-500/40'
                              : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          {role}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Options */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Decision Options ({inject.options.length}/6)
                    </label>
                    <button
                      type="button"
                      onClick={() => addOption(inject)}
                      disabled={inject.options.length >= 6}
                      className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Option
                    </button>
                  </div>
                  <div className="space-y-3">
                    {inject.options.map((opt, oi) => (
                      <OptionEditor
                        key={opt.id}
                        option={opt}
                        index={oi}
                        onChange={(updated) => updateOption(inject, opt.id, updated)}
                        onRemove={() => removeOption(inject, opt.id)}
                        canRemove={inject.options.length > 2}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))
      )}

      <button
        type="button"
        onClick={addInject}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-700 hover:border-blue-500/50 hover:bg-blue-500/5 text-slate-500 hover:text-blue-400 rounded-xl py-3 transition-all text-sm"
      >
        <Plus className="w-4 h-4" />
        Add Inject
      </button>
    </div>
  );
}

// ─── Step 3: Review ───────────────────────────────────────────────────────────

function ReviewStep({
  meta,
  injects,
  isEdit,
  saving,
  onSave,
  error,
}: {
  meta: ScenarioMeta;
  injects: InjectDraft[];
  isEdit: boolean;
  saving: boolean;
  onSave: () => void;
  error: string;
}) {
  const optimalCount = injects.reduce(
    (acc, inj) => acc + inj.options.filter((o) => o.isOptimal).length,
    0
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {/* Summary */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 space-y-3">
        <h3 className="text-base font-semibold text-white">{meta.title || 'Untitled Scenario'}</h3>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="text-slate-400">
            Type: <span className="text-slate-200">{meta.type}</span>
          </span>
          <span className="text-slate-400">
            Difficulty: <span className="text-slate-200">{meta.difficulty}</span>
          </span>
          <span className="text-slate-400">
            Injects: <span className="text-slate-200">{injects.length}</span>
          </span>
          <span className="text-slate-400">
            Optimal Choices: <span className="text-green-400">{optimalCount}</span>
          </span>
        </div>
        {meta.description && (
          <p className="text-sm text-slate-400 leading-relaxed">{meta.description}</p>
        )}
        {meta.objectives.filter(Boolean).length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              Objectives
            </p>
            <ul className="space-y-1">
              {meta.objectives.filter(Boolean).map((obj, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                  {obj}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Inject list */}
      <div>
        <p className="text-sm font-medium text-slate-400 mb-3">
          Injects ({injects.length})
        </p>
        <div className="space-y-2">
          {injects.map((inject, idx) => (
            <div
              key={inject.id}
              className="flex items-center gap-3 bg-slate-900/50 border border-slate-700/40 rounded-lg px-4 py-3"
            >
              <span className="text-xs font-mono text-slate-600 w-5">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 font-medium truncate">
                  {inject.title || `Untitled Inject ${idx + 1}`}
                </p>
                <p className="text-xs text-slate-500">
                  {inject.phase === 'Custom' ? inject.customPhase || 'Custom' : inject.phase} ·{' '}
                  {inject.options.length} options ·{' '}
                  <span className="text-green-400">
                    {inject.options.filter((o) => o.isOptimal).length} optimal
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <button
        type="button"
        onClick={onSave}
        disabled={saving || !meta.title.trim() || injects.length === 0}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3.5 transition-colors text-base"
      >
        {saving ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Save className="w-5 h-5" />
        )}
        {isEdit ? 'Save Changes' : 'Create Scenario'}
      </button>
    </div>
  );
}

// ─── Main ScenarioBuilderPage ─────────────────────────────────────────────────

const STEPS = [
  { label: 'Metadata', icon: <BookOpen className="w-4 h-4" /> },
  { label: 'Injects', icon: <List className="w-4 h-4" /> },
  { label: 'Review & Save', icon: <Eye className="w-4 h-4" /> },
];

export default function ScenarioBuilderPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { get, post, put } = useApi();
  const toast = useToast();

  const isEdit = Boolean(id);

  const [step, setStep] = useState(0);
  const [loadingScenario, setLoadingScenario] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [meta, setMeta] = useState<ScenarioMeta>({
    title: '',
    description: '',
    type: 'RANSOMWARE',
    difficulty: 'INTERMEDIATE',
    objectives: [],
  });

  const [injects, setInjects] = useState<InjectDraft[]>([newInject()]);

  const loadScenario = useCallback(async () => {
    if (!id) return;
    try {
      const resp = await get<{
        scenario: {
          title: string;
          description: string;
          type: string;
          difficulty: string;
          objectives: string[];
          injects: Array<{
            id: string;
            phase: string;
            title: string;
            narrative: string;
            roleVisibility: string[];
            mitreAttackId?: string;
            mitreAttackName?: string;
            nistCsfFunction?: string;
            timerSeconds?: number;
            options: Array<{
              id: string;
              text: string;
              scoreWeight?: number;
              isOptimal?: boolean;
              scriptedFeedback?: string;
              feedbackTags?: string[];
            }>;
          }>;
        };
      }>(`/api/scenarios/${id}`);
      const data = resp.scenario;

      setMeta({
        title: data.title,
        description: data.description ?? '',
        type: data.type,
        difficulty: data.difficulty,
        objectives: data.objectives ?? [],
      });

      setInjects(
        data.injects.map((inj) => ({
          id: inj.id,
          phase: INJECT_PHASES.includes(inj.phase) ? inj.phase : 'Custom',
          customPhase: INJECT_PHASES.includes(inj.phase) ? '' : inj.phase,
          title: inj.title,
          narrative: inj.narrative,
          roleVisibility: inj.roleVisibility ?? [...IR_ROLES],
          mitreAttackId: inj.mitreAttackId ?? '',
          mitreAttackName: inj.mitreAttackName ?? '',
          nistCsfFunction: inj.nistCsfFunction ?? 'RESPOND',
          timerSeconds: inj.timerSeconds ? String(inj.timerSeconds) : '',
          options: inj.options.map((o) => ({
            id: o.id,
            text: o.text,
            scoreWeight: o.scoreWeight ?? 50,
            isOptimal: o.isOptimal ?? false,
            scriptedFeedback: o.scriptedFeedback ?? '',
            feedbackTags: (o.feedbackTags ?? []).join(', '),
          })),
        }))
      );
    } catch (err: unknown) {
      toast((err as Error).message ?? 'Failed to load scenario', 'error');
    } finally {
      setLoadingScenario(false);
    }
  }, [id, get, toast]);

  useEffect(() => {
    if (isEdit) loadScenario();
  }, [isEdit, loadScenario]);

  const handleSave = async () => {
    setSaveError('');
    setSaving(true);

    const payload = {
      title: meta.title.trim(),
      description: meta.description.trim(),
      type: meta.type,
      difficulty: meta.difficulty,
      objectives: meta.objectives.filter(Boolean),
      injects: injects.map((inj, order) => ({
        id: isEdit ? inj.id : undefined,
        phase: inj.phase === 'Custom' ? inj.customPhase || 'Custom' : inj.phase,
        title: inj.title.trim(),
        narrative: inj.narrative.trim(),
        roleVisibility: inj.roleVisibility,
        mitreAttackId: inj.mitreAttackId || undefined,
        mitreAttackName: inj.mitreAttackName || undefined,
        nistCsfFunction: inj.nistCsfFunction || undefined,
        timerSeconds: inj.timerSeconds ? Number(inj.timerSeconds) : undefined,
        order,
        options: inj.options.map((o, optOrder) => ({
          id: isEdit ? o.id : undefined,
          text: o.text.trim(),
          scoreWeight: o.scoreWeight,
          isOptimal: o.isOptimal,
          scriptedFeedback: o.scriptedFeedback || undefined,
          feedbackTags: o.feedbackTags
            ? o.feedbackTags.split(',').map((t) => t.trim()).filter(Boolean)
            : [],
          order: optOrder,
        })),
      })),
    };

    try {
      if (isEdit && id) {
        await put(`/api/scenarios/${id}`, payload);
        toast('Scenario updated successfully', 'success');
      } else {
        const created = await post<{ id: string }>('/api/scenarios', payload);
        toast('Scenario created successfully', 'success');
        navigate(`/scenarios/${created.id}/edit`);
        return;
      }
      navigate('/scenarios');
    } catch (err: unknown) {
      setSaveError((err as Error).message ?? 'Failed to save scenario.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingScenario) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/30">
            <BookOpen className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {isEdit ? 'Edit Scenario' : 'Create Scenario'}
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {isEdit ? `Editing: ${meta.title || 'Untitled'}` : 'Build a new tabletop exercise'}
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center flex-1">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  i === step
                    ? 'text-blue-400 bg-blue-500/10 border border-blue-500/30'
                    : i < step
                    ? 'text-green-400 hover:bg-slate-700/50 cursor-pointer'
                    : 'text-slate-600 cursor-default'
                }`}
              >
                {i < step ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                      i === step
                        ? 'border-blue-500 text-blue-400'
                        : 'border-slate-700 text-slate-600'
                    }`}
                  >
                    {i + 1}
                  </div>
                )}
                {s.label}
              </button>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px bg-slate-700 mx-2" />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6 mb-6">
          {step === 0 && <MetaStep meta={meta} onChange={setMeta} />}
          {step === 1 && <InjectsStep injects={injects} onChange={setInjects} />}
          {step === 2 && (
            <ReviewStep
              meta={meta}
              injects={injects}
              isEdit={isEdit}
              saving={saving}
              onSave={handleSave}
              error={saveError}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 rounded-lg text-sm transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {step < STEPS.length - 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              disabled={step === 0 && !meta.title.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white font-medium rounded-lg text-sm transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
}
