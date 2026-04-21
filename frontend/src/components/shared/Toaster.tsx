import { useCallback, useEffect } from 'react';
import { create } from 'zustand';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
}

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function useToast() {
  const addToast = useToastStore((s) => s.addToast);
  // Stable reference — never changes between renders, safe to use in useCallback deps
  return useCallback(
    (message: string, type: ToastType = 'info') => addToast(message, type),
    [addToast],
  );
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />,
  error: <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />,
  info: <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />,
};

const BORDER_COLORS: Record<ToastType, string> = {
  success: 'border-green-500/50',
  error: 'border-red-500/50',
  warning: 'border-yellow-500/50',
  info: 'border-blue-500/50',
};

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast);

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, removeToast]);

  return (
    <div
      className={`flex items-start gap-3 bg-slate-800 border ${BORDER_COLORS[toast.type]} rounded-lg px-4 py-3 shadow-lg min-w-[280px] max-w-[400px] animate-slide-in`}
    >
      {ICONS[toast.type]}
      <p className="text-sm text-slate-200 flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="text-slate-500 hover:text-slate-300 transition-colors ml-1 flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
      <style>{`
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(100%); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in { animation: slide-in 0.25s ease-out; }
      `}</style>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
