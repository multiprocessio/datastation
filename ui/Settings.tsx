import { IconTrash } from '@tabler/icons';
import React from 'react';
import { MODE } from '../shared/constants';
import { LANGUAGES } from '../shared/languages';
import { mergeDeep, newId } from '../shared/object';
import {
  GetSettingsRequest,
  GetSettingsResponse,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
} from '../shared/rpc';
import { Settings as SettingsT } from '../shared/settings';
import { asyncRPC } from './asyncRPC';
import { Alert } from './components/Alert';
import { Button } from './components/Button';
import { FileInput } from './components/FileInput';
import { FormGroup } from './components/FormGroup';
import { Input } from './components/Input';
import { Toggle } from './components/Toggle';

export const SettingsContext = React.createContext<{
  state: SettingsT;
  setState: (a0: Partial<SettingsT>) => void;
}>({
  state: new SettingsT(''),
  setState() {
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
      } catch (e) {
        // Do nothing
      }

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

  if (!settings.caCerts) {
    settings.caCerts = [];
  }

  return (
    <div className="card settings">
      <h1>Settings</h1>
      <div className="form">
        <FormGroup major label="Visual">
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
        {MODE !== 'browser' && (
          <>
            <FormGroup major label="Language Path Overrides">
              {Object.keys(LANGUAGES)
                .sort()
                .filter((k) => k !== 'sql')
                .map((languageId) => (
                  <div key={languageId} className="form-row form-row--multi">
                    <Input
                      onChange={function handleLanguagePathChange(
                        newValue: string
                      ) {
                        settings.languages[languageId].path = newValue;
                        setSettings(settings);
                      }}
                      label={LANGUAGES[languageId].name}
                      value={
                        settings.languages[languageId].path ||
                        LANGUAGES[languageId].defaultPath
                      }
                    />
                    <Button
                      onClick={function resetLanguagePath() {
                        settings.languages[languageId].path =
                          LANGUAGES[languageId].defaultPath;
                        setSettings(settings);
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                ))}
              <Alert type="info">
                <div>
                  DataStation defaults to looking up each program on your&nbsp;
                  <code>$PATH</code>. You can override that here with a
                  different program name or an absolute path.
                </div>
              </Alert>
            </FormGroup>

            <FormGroup major label="Custom CA Certificates">
              {settings.caCerts.map((cert, i) => {
                return (
                  <div key={cert.id} className="form-row form-row--multi">
                    <FileInput
                      onChange={(v) => {
                        cert.file = v;
                        setSettings(settings);
                      }}
                      allowFilePicker={MODE === 'desktop'}
                      allowManualEntry={MODE !== 'desktop'}
                      value={cert.file}
                      label="Location"
                    />
                    <Button
                      icon
                      onClick={() => {
                        settings.caCerts.splice(i, 1);
                        setSettings(settings);
                      }}
                    >
                      <IconTrash />
                    </Button>
                  </div>
                );
              })}
              <div className="form-row">
                <Button
                  onClick={() => {
                    settings.caCerts.push({ file: '', id: newId() });
                    setSettings(settings);
                  }}
                >
                  Add CA Cert
                </Button>
              </div>

              <Alert type="info">
                <div>
                  DataStation defaults to looking up each program on your&nbsp;
                  <code>$PATH</code>. You can override that here with a
                  different program name or an absolute path.
                </div>
              </Alert>
            </FormGroup>
          </>
        )}
      </div>
    </div>
  );
}
