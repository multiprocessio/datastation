import * as React from 'react';
import { CHAT_LINK, MODE } from '../../shared/constants';
import log from '../shared/log';
import { Alert } from './Alert';
import { Highlight } from './Highlight';

type Props = { children: React.ReactNode; className?: string };
type State = { error?: Error };

// SOURCE: https://reactjs.org/docs/error-boundaries.html
export class ErrorBoundary extends React.Component<Props, State> {
  state = { error: null } as State;

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    log.error(error, errorInfo);
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
            <p>
              {MODE === 'server' &&
                'If it was an unhandled error after you executed the panel, refreshing this page may allow you to fix the problem. Otherwise you may need to edit this project in the database manually to delete this panel.'}
              {MODE === 'browser' &&
                'If it was an unhandled error after you executed the panel, refreshing this page may allow you to fix the problem.'}
              {MODE === 'desktop' &&
                'If it was an unhandled error after you executed the panel, closing this window and reopening the project may allow you to fix the problem. Otherwise you may need to edit this project file manually to delete this panel.'}
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
