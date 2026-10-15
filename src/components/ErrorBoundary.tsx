import { Component, ErrorInfo, ReactNode } from 'react';
import { error as logError } from '@tauri-apps/plugin-log';

/** Write a front-end error into the app log file (no-op outside Tauri). */
export function reportError(where: string, err: unknown, extra = '') {
  const e = err instanceof Error ? err : new Error(String(err));
  logError(`[${where}] ${e.message}\n${e.stack ?? ''}${extra ? `\n${extra}` : ''}`).catch(() => { /* not in Tauri */ });
}

interface Props { children: ReactNode; label: string }
interface State { err: Error | null }

/** Keeps one broken view from blanking the whole app, and records what happened. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    reportError(this.props.label, err, info.componentStack ?? '');
  }

  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="h-full w-full flex items-center justify-center p-6 bg-surface">
        <div className="glass-card !transform-none max-w-[32rem] p-6 text-center">
          <div className="text-lg font-bold text-on-surface">Something went wrong in this view</div>
          <p className="text-sm text-on-surface-variant mt-2">Your pipeline is saved. The error was written to the GridX log file.</p>
          <pre className="mt-3 text-left text-[11px] text-error bg-surface-container-low rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap">{this.state.err.message}</pre>
          <button onClick={() => this.setState({ err: null })} className="btn-de mt-4">Try again</button>
        </div>
      </div>
    );
  }
}
