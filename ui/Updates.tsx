import * as React from 'react';
import { SITE_ROOT, VERSION } from '../shared/constants';
import { request } from '../shared/http';
import log from '../shared/log';
import { ContentTypeInfo } from '../shared/state';
import { SettingsContext } from './Settings';

export function Updates() {
  const { state: settings } = React.useContext(SettingsContext);
  const [updates, setUpdates] = React.useState(null);
  React.useEffect(
    function getUpdates() {
      async function run() {
        try {
          const updates = await request(
            window.fetch,
            'GET',
            `${SITE_ROOT}/api/updates?version=${VERSION}&i=${settings.id}`,
            new ContentTypeInfo(),
            [],
            '',
            true
          );
          setUpdates(updates);
        } catch (e) {
          log.error(e);
        }
      }

      run();
    },
    [settings.id]
  );

  if (!updates) {
    return null;
  }

  return (
    <div>
      <div className="title">Updates</div>
      <ul>
        {updates.updates.map(function renderUpdate(u: string) {
          return <li key={u}>{u}</li>;
        })}
      </ul>
    </div>
  );
}
