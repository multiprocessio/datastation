import * as React from 'react';
import { Button } from './components/Button';

export function Sidebar({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = React.useState(true);

  return (
    <div className={`section sidebar ${!expanded ? 'sidebar--collapsed' : ''}`}>
      <div className="title vertical-align-center">
        <span className="material-icons-outlined">manage_search</span>
        <Button
          icon
          className="flex-right"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'keyboard_arrow_left' : 'keyboard_arrow_right'}
        </Button>
      </div>
      {expanded && children}
    </div>
  );
}
