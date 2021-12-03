import React from 'react';
import { MODE } from '../shared/constants';
import { mergeDeep } from '../shared/object';
import {
  GetSettingsRequest,
  GetSettingsResponse,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
} from '../shared/rpc';
import { Settings } from '../shared/settings';
import { asyncRPC } from './asyncRPC';

export const SettingsContext = React.createContext<{
  state: Settings;
  setState: (a0: Partial<Settings>) => void;
}>({
  state: new Settings(''),
  setState(a) {
    throw new Error('Context not initialized.');
  },
});

export function useSettings(): [Settings, (s: Settings) => Promise<void>] {
  const [settings, setSettingsInternal] = React.useState(null);

  function loadBrowserSettings() {
    if (MODE === 'browser') {
      let settings = new Settings('');
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

  async function setSettings(s: Settings) {
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
