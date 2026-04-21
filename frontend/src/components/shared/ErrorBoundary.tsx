import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application render failure', { error, componentStack: info.componentStack });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <section className="w-full max-w-lg border border-red-500/30 bg-slate-900 rounded-lg p-6 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div className="space-y-3">
              <div>
                <h1 className="text-xl font-semibold text-white">CyberTabletop hit an error</h1>
                <p className="text-sm text-slate-400 mt-1">
                  Your session data is still stored on the server. Refreshing usually restores the app state.
                </p>
              </div>
              <p className="text-xs text-red-200/80 bg-red-500/10 border border-red-500/20 rounded-md p-3 break-words">
                {this.state.message}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh app
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }
}
