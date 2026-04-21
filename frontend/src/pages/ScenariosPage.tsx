import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Plus,
  Play,
  Lock,
  Star,
  Loader2,
  AlertTriangle,
  Pencil,
  Trash2,
  Tag,
  List,
  X,
} from 'lucide-react';
import Layout from '../components/shared/Layout';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/shared/Toaster';

interface Scenario {
  id: string;
  title: string;
  description?: string;
  type: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  isBuiltIn: boolean;
  _count?: { injects: number };
  injectCount?: number;
}

const DIFFICULTY_STYLES: Record<string, string> = {
  BEGINNER: 'bg-green-500/15 text-green-400 border-green-500/40',
  INTERMEDIATE: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40',
  ADVANCED: 'bg-orange-500/15 text-orange-400 border-orange-500/40',
  EXPERT: 'bg-red-500/15 text-red-400 border-red-500/40',
};

const TYPE_STYLES: Record<string, string> = {
  RANSOMWARE: 'bg-purple-500/15 text-purple-400 border-purple-500/40',
  PHISHING: 'bg-blue-500/15 text-blue-400 border-blue-500/40',
  DATA_BREACH: 'bg-red-500/15 text-red-400 border-red-500/40',
  INSIDER_THREAT: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40',
  SUPPLY_CHAIN: 'bg-teal-500/15 text-teal-400 border-teal-500/40',
  APT: 'bg-pink-500/15 text-pink-400 border-pink-500/40',
  DDOS: 'bg-orange-500/15 text-orange-400 border-orange-500/40',
  CUSTOM: 'bg-slate-500/15 text-slate-400 border-slate-500/40',
};

function Badge({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={`inline-block text-xs px-2 py-0.5 rounded border font-medium ${className}`}
    >
      {label}
    </span>
  );
}

export default function ScenariosPage() {
  const navigate = useNavigate();
  const { get, del } = useApi();
  const toast = useToast();

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Scenario | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    get<{ scenarios: Scenario[] }>('/api/scenarios')
      .then((data) => setScenarios(data.scenarios ?? []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [get]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await del(`/api/scenarios/${deleteTarget.id}`);
      setScenarios((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      toast('Scenario deleted', 'success');
      setDeleteTarget(null);
    } catch (err: unknown) {
      toast((err as Error).message ?? 'Failed to delete scenario', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const injectCount = (s: Scenario) =>
    s._count?.injects ?? s.injectCount ?? 0;

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/30">
              <BookOpen className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Scenario Library</h1>
              <p className="text-slate-400 text-sm mt-0.5">Browse and manage training scenarios</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/scenarios/new')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg px-4 py-2 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Create New Scenario
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-3 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        ) : scenarios.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-base font-medium">No scenarios available</p>
            <p className="text-slate-500 text-sm mt-1">Create your first scenario to get started.</p>
            <button
              onClick={() => navigate('/scenarios/new')}
              className="mt-5 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg px-4 py-2 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Create Scenario
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scenarios.map((scenario) => (
              <div
                key={scenario.id}
                className="bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl p-5 transition-all group"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      {scenario.isBuiltIn ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-amber-500/15 text-amber-400 border-amber-500/40 font-medium">
                          <Star className="w-3 h-3" />
                          Built-in
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-slate-600/40 text-slate-400 border-slate-600 font-medium">
                          <Lock className="w-3 h-3" />
                          Custom
                        </span>
                      )}
                      <Badge
                        label={scenario.type?.replace('_', ' ') ?? 'Unknown'}
                        className={
                          TYPE_STYLES[scenario.type] ??
                          'bg-slate-500/15 text-slate-400 border-slate-500/40'
                        }
                      />
                      <Badge
                        label={scenario.difficulty}
                        className={
                          DIFFICULTY_STYLES[scenario.difficulty] ??
                          'bg-slate-500/15 text-slate-400 border-slate-500/40'
                        }
                      />
                    </div>
                    <h3 className="text-base font-semibold text-white group-hover:text-blue-300 transition-colors">
                      {scenario.title}
                    </h3>
                  </div>
                </div>

                {/* Description */}
                {scenario.description && (
                  <p className="text-sm text-slate-400 leading-relaxed line-clamp-2 mb-4">
                    {scenario.description}
                  </p>
                )}

                {/* Meta */}
                <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <List className="w-3.5 h-3.5" />
                    {injectCount(scenario)} injects
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    {scenario.type?.replace('_', ' ') ?? 'General'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      navigate(`/sessions/new?scenarioId=${scenario.id}`)
                    }
                    className="flex-1 flex items-center justify-center gap-1.5 bg-green-600/80 hover:bg-green-600 text-white font-medium rounded-lg py-2 transition-colors text-sm"
                  >
                    <Play className="w-4 h-4" />
                    Use in Session
                  </button>
                  {!scenario.isBuiltIn && (
                    <>
                      <button
                        onClick={() => navigate(`/scenarios/${scenario.id}/edit`)}
                        className="flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg px-3 py-2 transition-colors text-sm border border-slate-600"
                        title="Edit scenario"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(scenario)}
                        className="flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-red-600/70 text-slate-400 hover:text-red-300 font-medium rounded-lg px-3 py-2 transition-colors text-sm border border-slate-600 hover:border-red-500/50"
                        title="Delete scenario"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteTarget(null)}
          />
          <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/30">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-base font-semibold text-white">Delete Scenario</h3>
            </div>
            <p className="text-sm text-slate-400 mb-2">
              Are you sure you want to delete{' '}
              <span className="text-white font-medium">"{deleteTarget.title}"</span>?
            </p>
            <p className="text-xs text-slate-500 mb-6">
              This will permanently remove the scenario and all its injects. Sessions that used this scenario will not be affected.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
