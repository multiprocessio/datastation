import * as React from 'react';
import { CHAT_LINK } from '../shared/constants';
import { Alert } from './component-library/Alert';
import { Highlight } from './component-library/Highlight';

type Props = { children: React.ReactNode; className?: string };
type State = { error?: Error };

// SOURCE: https://reactjs.org/docs/error-boundaries.html
export class ErrorBoundary extends React.Component<Props, State> {
  state = { error: null } as State;

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className={this.props.className}>
          <Alert type="fatal">
            <p>
              This section crashed due to a bug. Feel free to message the{' '}
              <a target="_blank" href={CHAT_LINK}>
                community support channel
              </a>{' '}
              with details about how to reproduce the error.
            </p>
            <Highlight
              language="javascript"
              theme="light"
              children={this.state.error.stack || this.state.error.message}
            />
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}
