import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'An unexpected error occurred.';
      let isFirebaseError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            errorMessage = `Firebase Error (${parsed.operationType}): ${parsed.error}`;
            isFirebaseError = true;
          }
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-[32px] p-8 shadow-xl border border-zinc-100 text-center space-y-6">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle size={32} />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Something went wrong</h1>
              <p className="text-zinc-500 text-sm leading-relaxed">
                {errorMessage}
              </p>
              {isFirebaseError && (
                <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest mt-4">
                  Please check your connection or permissions.
                </p>
              )}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all"
            >
              <RefreshCcw size={18} />
              Reload App
            </button>
          </div>
        </div>
      );
    }

    const { children } = this.props;
    return children;
  }
}
