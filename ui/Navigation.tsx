import React from 'react';
import { Button } from './components/Button';
import { UrlState, UrlStateContext } from './urlState';
import {
  TablerIcon
} from '@tabler/icons';

export function Navigation<View extends string = UrlState['view']>({ pages }: { pages: Array<{ title: string; icon: TablerIcon, view: View }> }) {
  const {
    state: { projectId, view },
    setState: setUrlState,
  } = React.useContext(UrlStateContext);

  return (
    <div className="navigation">
      {pages.map((page) => (
        <div
          key={page.title}
          className={`navigation-item ${view === page.view ? 'navigation-item--active' : ''
            }`}
          title={page.title}
        >
          <Button
            icon
            onClick={() => setUrlState({ view: page.view, page: 0, projectId })}
          >
            <page.icon />
          </Button>
        </div>
      ))}
    </div>
  );
}
