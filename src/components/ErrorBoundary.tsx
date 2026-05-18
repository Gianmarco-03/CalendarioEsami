import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
    this.setState({ error, info });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 text-red-900 p-3 text-[12px] leading-relaxed">
        <div className="font-bold mb-1">{this.props.fallbackTitle ?? "Errore di rendering"}</div>
        <div className="mb-2 font-mono whitespace-pre-wrap break-words">
          {this.state.error.message}
        </div>
        {this.state.info?.componentStack && (
          <details className="text-[11px] opacity-80">
            <summary className="cursor-pointer">Component stack</summary>
            <pre className="whitespace-pre-wrap break-words mt-1">
              {this.state.info.componentStack}
            </pre>
          </details>
        )}
      </div>
    );
  }
}
