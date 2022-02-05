import { IconChevronLeft, IconChevronRight } from '@tabler/icons';
import * as React from 'react';
import { Button } from './components/Button';
import { UrlStateContext } from './urlState';

export function Sidebar({ children }: { children: React.ReactNode }) {
  const {
    state: { sidebar: expanded },
    setState: setUrlState,
  } = React.useContext(UrlStateContext);

  function setExpanded(v: boolean) {
    setUrlState({ sidebar: v });
  }

  return (
    <div className={`section sidebar ${!expanded ? 'sidebar--collapsed' : ''}`}>
      <div className="title vertical-align-center">
        <Button
          icon
          className="flex-right"
          onClick={function toggleExpanded() {
            return setExpanded(!expanded);
          }}
        >
          {expanded ? <IconChevronLeft /> : <IconChevronRight />}
        </Button>
      </div>
      {expanded && children}
    </div>
  );
}
