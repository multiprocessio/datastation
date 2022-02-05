import {
  IconAlertTriangle,
  IconBug,
  IconHeartbeat,
  IconInfoCircle,
} from '@tabler/icons';
import * as React from 'react';

type AlertTypes = 'fatal' | 'error' | 'warning' | 'info';

export function Alert({
  type,
  children,
}: {
  type: AlertTypes;
  children: React.ReactNode;
}) {
  const icon = (
    {
      info: <IconInfoCircle />,
      warning: <IconAlertTriangle />,
      error: <IconBug />,
      fatal: <IconHeartbeat />,
    } as Record<AlertTypes, React.ReactNode>
  )[type];
  return (
    <div className={`vertical-align-center alert alert-${type}`}>
      {icon}
      <div>{children}</div>
    </div>
  );
}
