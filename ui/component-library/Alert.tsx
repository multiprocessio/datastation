import * as React from 'react';

type AlertTypes = 'fatal' | 'error' | 'warning' | 'info';

export function Alert({
  type,
  children,
}: {
  type: AlertTypes;
  children: React.ReactNode;
}) {
  const icon =
    (
      {
        error: 'new_releases',
        fatal: 'bug_report',
      } as Record<AlertTypes, string>
    )[type] || type;
  return (
    <div className={`vertical-align-center alert alert-${type}`}>
      <span className="material-icons" children={icon} />
      <div>{children}</div>
    </div>
  );
}
