import { Component, type ReactNode } from "react";

/** Shows a readable message instead of a blank page if rendering ever fails. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <h2>Something went wrong</h2>
        <p>The game screen hit an error. Reloading usually fixes it.</p>
        <button type="button" className="key primary" onClick={() => window.location.reload()}>
          Reload
        </button>
        <pre>{this.state.error.message}</pre>
      </div>
    );
  }
}
