import React from 'react';

export function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <span className="tooltip">
      <span className="tooltip-icon material-icons-outlined">help_outline</span>
      <span className="tooltip-body">{children}</span>
    </span>
  );
}
