import * as React from 'react';
import { APP_NAME, MODE, SITE_ROOT } from '../shared/constants';
import '../shared/polyfill';
import { DEFAULT_PROJECT } from '../shared/state';
import { Button } from './components/Button';
import { Link } from './components/Link';
import { Toggle } from './components/Toggle';
import { ProjectContext } from './ProjectStore';
import { SettingsContext } from './settings';
import { UrlStateContext } from './urlState';

export function Header() {
  const {
    state: { projectId },
    setState: setUrlState,
  } = React.useContext(UrlStateContext);
  const { setState: setProjectState } = React.useContext(ProjectContext);
  const { state: settings, setState: setSettings } =
    React.useContext(SettingsContext);

  return (
    <header>
      <div className="vertical-align-center">
        <Link args={{ projectId, view: 'editor', page: 0 }} className="logo">
          {APP_NAME}
        </Link>
        <div className="flex-right vertical-align-center">
          {MODE === 'browser' ? (
            <React.Fragment>
              <a href={`${SITE_ROOT}/#online-environment`} target="_blank">
                About
              </a>
              <span title="Drop all state and load a sample project.">
                <Button
                  onClick={() => {
                    setProjectState(DEFAULT_PROJECT);
                    setUrlState({
                      projectId: DEFAULT_PROJECT.projectName,
                      page: 0,
                      view: 'editor',
                    });
                  }}
                >
                  Load Default Project
                </Button>
              </span>
              <a
                href="https://github.com/multiprocessio/datastation"
                target="_blank"
                className="stars"
              >
                <iframe
                  src="https://datastation.multiprocess.io/stars.html"
                  frameBorder="0"
                  scrolling="0"
                  width="100"
                  height="20"
                  title="GitHub"
                ></iframe>
              </a>
            </React.Fragment>
          ) : (
            <span>{projectId}</span>
          )}
          <Toggle
            label={settings.theme === 'light' ? 'Light Mode' : 'Dark Mode'}
            value={settings.theme !== 'light'}
            onChange={function handleLightModeToggle() {
              settings.theme = settings.theme === 'light' ? 'dark' : 'light';
              setSettings(settings);
            }}
          />
        </div>
      </div>
    </header>
  );
}
