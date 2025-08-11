import React from 'react';

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
};

type State = { hasError: boolean; error?: Error };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep this lightweight; avoid throwing again
    console.error('[ErrorBoundary] caught error in tree:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="min-h-screen grid place-items-center p-6">
          <div className="max-w-lg w-full rounded-2xl shadow p-6 border bg-white dark:bg-gray-800">
            <h1 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Something went wrong</h1>
            <p className="text-sm opacity-80 mb-4 text-gray-700 dark:text-gray-300">{this.state.error?.message}</p>
            <button 
              className="px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100" 
              onClick={this.handleReset}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}