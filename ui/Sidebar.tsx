import { IconChevronLeft, IconChevronRight, IconSearch } from '@tabler/icons';
import * as React from 'react';
import { Button } from './components/Button';

export function Sidebar({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = React.useState(true);

  return (
    <div className={`section sidebar ${!expanded ? 'sidebar--collapsed' : ''}`}>
      <div className="title vertical-align-center">
        <IconSearch height={18} width={18} />
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
