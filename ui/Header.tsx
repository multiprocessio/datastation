import * as React from 'react';
import { APP_NAME, MODE } from '../shared/constants';
import '../shared/polyfill';
import { DEFAULT_PROJECT } from '../shared/state';
import { Button } from './components/Button';
import { Link } from './components/Link';
import { Toggle } from './components/Toggle';
import { ProjectContext } from './ProjectStore';
import { SettingsContext } from './Settings';
import { UrlStateContext } from './urlState';

export function Header() {
  const {
    state: { projectId },
    setState: setUrlState,
  } = React.useContext(UrlStateContext);
  const { setState: setProjectState } = React.useContext(ProjectContext);
  const { state: settings, setState: setSettings } =
    React.useContext(SettingsContext);

  const [open, toggleDropdown] = React.useState(false);

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
          <div
            className={`global-dropdown ${open ? 'global-dropdown--open' : ''}`}
            tabIndex={-1}
            onBlur={(e) => {
              // Ignore onBlur for child elements
              if (!e.currentTarget.contains(e.relatedTarget)) {
                toggleDropdown(false);
              }
            }}
          >
            <div className="global-dropdown-anchor">
              <Button
                icon
                onClick={(e) => {
                  e.preventDefault();
                  toggleDropdown((open) => !open);
                }}
              >
                menu
              </Button>
            </div>
            <div className="global-dropdown-body">
              <div className="global-dropdown-section">
                <div className="global-dropdown-sectionName">Settings</div>
                <div className="global-dropdown-items">
                  <div className="global-dropdown-item">
                    <Toggle
                      label={
                        settings.theme !== 'dark' ? 'Light Mode' : 'Dark Mode'
                      }
                      value={settings.theme === 'dark'}
                      onChange={function handleLightModeToggle() {
                        settings.theme =
                          settings.theme === 'dark' ? 'light' : 'dark';
                        setSettings(settings);
                      }}
                    />
                  </div>
                  <div className="global-dropdown-item">
                    <Link args={{ projectId, view: 'settings', page: 0 }}>
                      See All
                    </Link>
                  </div>
                </div>
              </div>
              {MODE === 'browser' ? (
                <div className="global-dropdown-section">
                  <div className="global-dropdown-sectionName">Demo Mode</div>
                  <div className="global-dropdown-items">
                    <div className="global-dropdown-item">
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
                    </div>
                    <div className="global-dropdown-item">
                      <p>
                        This is an in-memory application. Your data does not
                        leave your browser.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
