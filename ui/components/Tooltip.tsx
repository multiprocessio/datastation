import { IconHelp } from '@tabler/icons';
import React from 'react';

export function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <span className="tooltip">
      <span className="tooltip-icon">
        <IconHelp />
      </span>
      <span className="tooltip-body">{children}</span>
    </span>
  );
}
