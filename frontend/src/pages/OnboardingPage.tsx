import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2, Shield, Users, ChevronRight, ChevronLeft,
  CheckCircle, Loader2, Plus, X,
} from 'lucide-react';
import { VoiceInputButton } from '../components/shared/VoiceInputButton';

// ── Types ────────────────────────────────────────────────────────────────────

interface OnboardingAnswers {
  orgName: string;
  industry: string;
  orgSize: string;
  maturity: number;
  compliance: string[];
  crownJewels: string[];
  primaryThreat: string;
  recentIncident: string;
  rolesPresent: string[];
  experience: string;
  focusArea: string;
}

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
  'Nonprofit',
  'Other',
];

const ORG_SIZES = [
  '1–50 employees', '51–500 employees', '501–5,000 employees',
  '5,000+ employees (Enterprise)', 'Federal Agency',
];

const COMPLIANCE = ['HIPAA', 'PCI-DSS', 'SOC 2', 'ISO 27001', 'NIST CSF', 'NIST 800-53', 'CMMC', 'FedRAMP', 'None'];

const CROWN_JEWELS_OPTIONS = [
  'Patient Records / EHR', 'Financial Data / Payment Systems', 'Personally Identifiable Information (PII)',
  'Intellectual Property / Source Code', 'Controlled Unclassified Information (CUI)', 'Employee Records / HR Data',
  'Customer Data / CRM', 'Trade Secrets / R&D Data', 'Legal / Contracts',
  'Authentication Systems / Identity Provider', 'Active Directory / Domain Controllers',
  'Critical Infrastructure / SCADA / ICS', 'Cloud Infrastructure / AWS / Azure / GCP',
  'Email Systems / Collaboration Tools', 'Backup Systems / Disaster Recovery',
  'Financial Systems / ERP', 'Supply Chain / Vendor Data', 'Encryption Keys / PKI',
  'Network Infrastructure / Firewalls / Routers', 'Security Tools / SIEM / SOC Platform',
];

const PRIMARY_THREATS = [
  'Ransomware', 'Phishing / BEC', 'Insider Threat', 'Nation-State / APT',
  'Data Breach / Exfiltration', 'Supply Chain Attack', 'DDoS', 'Other',
];

const IR_ROLES = [
  'CISO / Security Leadership', 'Incident Commander', 'IR Lead / SOC Analyst',
  'IT / Sysadmin', 'Legal / Compliance', 'PR / Communications', 'Executive Team',
  'HR', 'Third-Party Vendor',
];

const FOCUS_AREAS = [
  'Detection & triage', 'Escalation & communication', 'Containment decisions',
  'Full IR lifecycle', 'Legal & regulatory response', 'Leadership decision-making',
];

const EXPERIENCES = ['First exercise', '1–2 prior exercises', 'Regular practitioner'];

const MATURITY_LABELS = ['', 'Ad hoc', 'Developing', 'Defined', 'Managed', 'Optimized'];

// ── Step components ──────────────────────────────────────────────────────────

function StepHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="p-2 rounded-lg bg-blue-900/40 text-blue-400">{icon}</div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
      </div>
      <p className="text-sm text-gray-400 ml-12">{subtitle}</p>
    </div>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-300 mb-1">
      {children} {required && <span className="text-red-400">*</span>}
    </label>
  );
}

function Select({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-md bg-gray-800 border border-gray-600 text-white text-sm focus:border-blue-500 focus:outline-none"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function MultiSelect({ values, onChange, options }: {
  values: string[]; onChange: (v: string[]) => void; options: string[];
}) {
  const toggle = (o: string) => {
    if (values.includes(o)) onChange(values.filter(v => v !== o));
    else onChange([...values, o]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button
          key={o}
          type="button"
          onClick={() => toggle(o)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            values.includes(o)
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-400'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function AddableList({ values, onChange, options }: {
  values: string[]; onChange: (v: string[]) => void; options: string[];
}) {
  const [pending, setPending] = useState('');
  const available = options.filter(o => !values.includes(o));

  const add = () => {
    const val = pending || available[0];
    if (val && !values.includes(val)) {
      onChange([...values, val]);
      setPending('');
    }
  };

  const remove = (o: string) => onChange(values.filter(v => v !== o));

  return (
    <div className="space-y-1.5">
      {values.map(v => (
        <div key={v} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-blue-600/15 border border-blue-500/30">
          <span className="text-sm text-blue-200">{v}</span>
          <button type="button" onClick={() => remove(v)} className="text-blue-400 hover:text-red-400 transition-colors flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      ))}
      {available.length > 0 && (
        <div className="flex gap-2 pt-1">
          <select
            value={pending}
            onChange={e => setPending(e.target.value)}
            className="flex-1 px-3 py-2 rounded-md bg-gray-800 border border-gray-600 text-gray-300 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">— Select an asset —</option>
            {available.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <button
            type="button"
            onClick={add}
            disabled={!pending}
            className="flex items-center gap-1 px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            <Plus size={15} /> Add
          </button>
        </div>
      )}
    </div>
  );
}

function MaturitySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <input
        type="range" min={1} max={5} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-blue-500"
      />
      <div className="flex justify-between mt-1">
        {[1, 2, 3, 4, 5].map(n => (
          <div key={n} className="flex flex-col items-center">
            <span className={`text-xs ${value === n ? 'text-blue-400 font-semibold' : 'text-gray-500'}`}>{n}</span>
            <span className={`text-[10px] ${value === n ? 'text-blue-300' : 'text-gray-600'}`}>{MATURITY_LABELS[n]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<OnboardingAnswers>({
    orgName: '', industry: '', orgSize: '', maturity: 3,
    compliance: [], crownJewels: [], primaryThreat: '', recentIncident: '',
    rolesPresent: [], experience: '', focusArea: '',
  });

  const set = <K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const steps = [
    {
      icon: <Building2 size={18} />,
      title: 'Organization Profile',
      subtitle: 'Tell us about your organization so the AI can tailor the scenario.',
    },
    {
      icon: <Shield size={18} />,
      title: 'Threat Context',
      subtitle: 'What are you most focused on protecting today?',
    },
    {
      icon: <Users size={18} />,
      title: 'Team Profile',
      subtitle: 'Help the AI understand who\'s in the room.',
    },
  ];

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(answers),
      });
      if (!res.ok) throw new Error('Failed to save onboarding answers');
      navigate(`/sessions/${sessionId}/lobby`);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  const isLastStep = step === steps.length - 1;
  const canNext = step === 0
    ? Boolean(answers.orgName && answers.industry && answers.orgSize)
    : step === 1
    ? Boolean(answers.crownJewels.length)
    : Boolean(answers.rolesPresent.length && answers.focusArea);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            {steps.map((s, i) => (
              <React.Fragment key={i}>
                <div className={`flex items-center gap-1.5 ${i <= step ? 'text-blue-400' : 'text-gray-600'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                    i < step ? 'bg-blue-600 border-blue-600 text-white'
                    : i === step ? 'bg-gray-900 border-blue-500 text-blue-400'
                    : 'bg-gray-900 border-gray-600 text-gray-600'
                  }`}>
                    {i < step ? <CheckCircle size={14} /> : i + 1}
                  </div>
                  <span className="text-xs hidden sm:inline">{s.title}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 ${i < step ? 'bg-blue-600' : 'bg-gray-700'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
          <p className="text-xs text-gray-500">Step {step + 1} of {steps.length}</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
          <StepHeader {...steps[step]} />

          {/* Step 0: Org Profile */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label required>Organization Name</Label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={answers.orgName}
                    onChange={e => set('orgName', e.target.value)}
                    placeholder="e.g., Acme Corporation"
                    className="flex-1 px-3 py-2 rounded-md bg-gray-800 border border-gray-600 text-white text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <VoiceInputButton size="sm" onTranscript={t => set('orgName', answers.orgName + t)} />
                </div>
              </div>
              <div>
                <Label required>Industry</Label>
                <Select value={answers.industry} onChange={v => set('industry', v)} options={INDUSTRIES} placeholder="Select industry…" />
              </div>
              <div>
                <Label required>Organization Size</Label>
                <Select value={answers.orgSize} onChange={v => set('orgSize', v)} options={ORG_SIZES} placeholder="Select size…" />
              </div>
              <div>
                <Label>Security Maturity Level</Label>
                <MaturitySlider value={answers.maturity} onChange={v => set('maturity', v)} />
              </div>
              <div>
                <Label>Compliance Frameworks</Label>
                <MultiSelect values={answers.compliance} onChange={v => set('compliance', v)} options={COMPLIANCE} />
              </div>
            </div>
          )}

          {/* Step 1: Threat Context */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label required>Primary Assets to Protect (Crown Jewels)</Label>
                <p className="text-xs text-gray-500 mb-2">Add each asset you want to protect</p>
                <AddableList values={answers.crownJewels} onChange={v => set('crownJewels', v)} options={CROWN_JEWELS_OPTIONS} />
              </div>
              <div>
                <Label>Primary Threat Concern</Label>
                <Select value={answers.primaryThreat} onChange={v => set('primaryThreat', v)} options={PRIMARY_THREATS} placeholder="Select threat type…" />
              </div>
              <div>
                <Label>Recent Relevant Incident? (Optional context)</Label>
                <div className="flex gap-2 items-start">
                  <textarea
                    value={answers.recentIncident}
                    onChange={e => set('recentIncident', e.target.value)}
                    placeholder="Brief description if relevant — helps the AI tailor the scenario…"
                    rows={2}
                    className="flex-1 px-3 py-2 rounded-md bg-gray-800 border border-gray-600 text-white text-sm focus:border-blue-500 focus:outline-none resize-none"
                  />
                  <VoiceInputButton size="sm" onTranscript={t => set('recentIncident', answers.recentIncident + ' ' + t)} />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Team Profile */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label required>Roles Present Today</Label>
                <MultiSelect values={answers.rolesPresent} onChange={v => set('rolesPresent', v)} options={IR_ROLES} />
              </div>
              <div>
                <Label>Team Exercise Experience</Label>
                <div className="flex gap-2">
                  {EXPERIENCES.map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => set('experience', e)}
                      className={`flex-1 px-3 py-2 rounded-md text-xs font-medium border transition-colors ${
                        answers.experience === e
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label required>Primary Learning Goal for Today</Label>
                <div className="grid grid-cols-2 gap-2">
                  {FOCUS_AREAS.map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => set('focusArea', f)}
                      className={`px-3 py-2 rounded-md text-xs font-medium border transition-colors text-left ${
                        answers.focusArea === f
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} /> Back
            </button>

            {isLastStep ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canNext || submitting}
                className="flex items-center gap-2 px-5 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                {submitting ? 'Saving…' : 'Start Session'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                disabled={!canNext}
                className="flex items-center gap-2 px-5 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-4">
          Your answers are used only to customize this exercise — they are not shared externally.
        </p>
      </div>
    </div>
  );
}
