import * as React from 'react';
import { APP_NAME, MODE } from '../shared/constants';
import '../shared/polyfill';
import { DEFAULT_PROJECT } from '../shared/state';
import { Link } from './components/Link';
import { LocalStorageStore } from './ProjectStore';
import { UrlStateContext } from './urlState';

export function loadDefaultProject() {
  const store = new LocalStorageStore();
  store.update(DEFAULT_PROJECT.projectName, DEFAULT_PROJECT);
  window.location.href = '/?projectId=' + DEFAULT_PROJECT.projectName;
}

export function Header() {
  const {
    state: { projectId },
  } = React.useContext(UrlStateContext);

  return (
    <header>
      <div className="vertical-align-center">
        <Link className="logo" args={{ projectId, view: 'editor', page: 0 }}>
          {APP_NAME}
        </Link>
        <div className="flex-right vertical-align-center">
          {MODE === 'browser' ? (
            <a
              href="https://github.com/multiprocessio/datastation"
              target="_blank"
              className="stars"
            >
              <iframe
                src="https://datastation.multiprocess.io/stars/datastation.html"
                frameBorder="0"
                scrolling="0"
                width="100"
                height="20"
                title="GitHub"
              ></iframe>
            </a>
          ) : (
            <span className="header-project-name">{projectId}</span>
          )}
        </div>
      </div>
    </header>
  );
}
