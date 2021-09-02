import * as React from 'react';
import { CHAT_LINK } from '../shared/constants';

// SOURCE: https://reactjs.org/docs/error-boundaries.html
export class ErrorBoundary extends React.Component {
  state = { hasError: false };

  constructor(props: { children: React.ReactNode }) {
    super(props);
  }

  static getDerivedStateFromError() {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <p>
            This section has crashed. Feel free to message the{' '}
            <a target="_blank" href={CHAT_LINK}>
              community support channel
            </a>{' '}
            with details about how to reproduce the error.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
