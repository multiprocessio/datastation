import * as React from 'react';

export function Alert({
  type,
  children,
}: {
  type: 'error' | 'warning' | 'info';
  children: React.ReactNode;
}) {
  return (
    <div className={`vertical-align-center alert alert-${type}`}>
      <span className="material-icons">
        {type === 'error' ? 'new_releases' : type}
      </span>
      <div>{children}</div>
    </div>
  );
}
