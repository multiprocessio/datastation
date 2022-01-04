import React from 'react';
import { MODE } from '../shared/constants';
import { mergeDeep } from '../shared/object';
import {
  GetSettingsRequest,
  GetSettingsResponse,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
} from '../shared/rpc';
import { Settings as SettingsT } from '../shared/settings';
import { asyncRPC } from './asyncRPC';
import { FormGroup } from './components/FormGroup';
import { Toggle } from './components/Toggle';

export const SettingsContext = React.createContext<{
  state: SettingsT;
  setState: (a0: Partial<SettingsT>) => void;
}>({
  state: new SettingsT(''),
  setState(a) {
    throw new Error('Context not initialized.');
  },
});

export function useSettings(): [SettingsT, (s: SettingsT) => Promise<void>] {
  const [settings, setSettingsInternal] = React.useState(null);

  function loadBrowserSettings() {
    if (MODE === 'browser') {
      let settings = new SettingsT('');
      try {
        settings = mergeDeep(
          settings,
          JSON.parse(localStorage.getItem('settings'))
        );
      } catch (e) {}

      setSettingsInternal(settings);
    }
  }

  async function loadSettings() {
    const settings = await asyncRPC<GetSettingsRequest, GetSettingsResponse>(
      'getSettings',
      null
    );
    setSettingsInternal(settings);
  }

  React.useEffect(
    function checkForSettings() {
      if (!settings) {
        if (MODE === 'browser') {
          loadBrowserSettings();
        } else {
          loadSettings();
        }
      }
    },
    [settings]
  );

  async function setSettings(s: SettingsT) {
    setSettingsInternal({ ...s });

    if (MODE === 'browser') {
      localStorage.setItem('settings', JSON.stringify(s));
      return;
    }

    return asyncRPC<UpdateSettingsRequest, UpdateSettingsResponse>(
      'updateSettings',
      s
    );
  }

  return [settings, setSettings];
}

export function Settings() {
  const { state: settings, setState: setSettings } =
    React.useContext(SettingsContext);
  if (!settings) {
    return null;
  }

  return (
    <div className="card">
      <h1>Settings</h1>
      {MODE === 'desktop' && (
        <p>
          After making changes, restart DataStation for them to take effect
          across all windows.
        </p>
      )}
      <div className="form">
        <FormGroup label="Visual">
          <div className="form-row">
            <Toggle
              label={settings.theme !== 'dark' ? 'Light Mode' : 'Dark Mode'}
              value={settings.theme === 'dark'}
              onChange={function handleLightModeToggle() {
                settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
                setSettings(settings);
              }}
            />
          </div>
        </FormGroup>
      </div>
    </div>
  );
}
