import * as React from 'react';
import { APP_NAME, MODE, SITE_ROOT } from '../shared/constants';
import '../shared/polyfill';
import { DEFAULT_PROJECT } from '../shared/state';
import { Button } from './components/Button';
import { Link } from './components/Link';
import { ProjectContext } from './ProjectStore';
import { UrlStateContext } from './urlState';

export function Header({
  setHeaderHeight,
}: {
  setHeaderHeight: (e: HTMLElement) => void;
}) {
  const {
    state: { projectId },
  } = React.useContext(UrlStateContext);
  const { setState: setProjectState } = React.useContext(ProjectContext);

  return (
    <header ref={setHeaderHeight}>
      <div className="vertical-align-center">
        <Link args={{ projectId, view: 'editor', page: 0 }} className="logo">
          {APP_NAME}
        </Link>
        <div className="flex-right vertical-align-center">
          {MODE === 'browser' ? (
            <React.Fragment>
              <span title="Drop all state and load a sample project.">
                <Button
                  onClick={() => {
                    setProjectState(DEFAULT_PROJECT);
                    window.location.reload();
                  }}
                >
                  Reset
                </Button>
              </span>
              <a
                href="https://github.com/multiprocessio/datastation"
                target="_blank"
              >
                <iframe
                  src="https://ghbtns.com/github-btn.html?user=multiprocessio&repo=datastation&type=star&count=true&size=medium"
                  frameBorder="0"
                  scrolling="0"
                  width="80"
                  height="20"
                  title="GitHub"
                ></iframe>
              </a>
              <a href={`${SITE_ROOT}/#online-environment`} target="_blank">
                About
              </a>
            </React.Fragment>
          ) : (
            <span>{projectId}</span>
          )}
        </div>
      </div>
    </header>
  );
}
