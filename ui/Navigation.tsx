import { Icon as TablerIcon } from '@tabler/icons';
import React from 'react';
import { Button } from './components/Button';
import { DefaultView, UrlStateContext } from './urlState';

export function Navigation<View extends string = DefaultView>({
  pages,
}: {
  pages: Array<{ title: string; icon: TablerIcon; endpoint: View }>;
}) {
  const {
    state: { projectId, view },
    setState: setUrlState,
  } = React.useContext(UrlStateContext);

  return (
    <div className="navigation">
      {pages.map((page) => (
        <div
          key={page.title}
          className={`navigation-item ${view === page.endpoint ? 'navigation-item--active' : ''
            }`}
          title={page.title}
        >
          <Button
            icon
            onClick={() =>
              setUrlState({
                view: page.endpoint as DefaultView /* this is unideal but made difficult because the UrlStateContext is global */,
                page: 0,
                projectId,
              })
            }
          >
            <page.icon />
          </Button>
        </div>
      ))}
    </div>
  );
}
