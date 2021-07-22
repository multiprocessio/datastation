import * as React from 'react';
import { SITE_ROOT, VERSION } from '../shared/constants';
import { request } from '../shared/http';
import { ContentTypeInfo } from '../shared/state';

export function Updates() {
  const [updates, setUpdates] = React.useState(null);
  React.useEffect(() => {
    async function run() {
      try {
        const updates = await request(
          window.fetch,
          'GET',
          `${SITE_ROOT}/api/updates?version=${VERSION}`,
          new ContentTypeInfo(),
          [],
          '',
          true
        );
        setUpdates(updates);
      } catch (e) {
        console.error(e);
      }
    }

    run();
  }, []);

  if (!updates) {
    return null;
  }

  return (
    <div>
      <div className="title">Updates</div>
      <ul>
        {updates.updates.map((u: string) => {
          return <li>{u}</li>;
        })}
      </ul>
    </div>
  );
}
