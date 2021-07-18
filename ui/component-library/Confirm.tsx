import * as React from 'react';

import { Button } from './Button';

export function Confirm({
  className,
  onConfirm,
  message,
  action,
  render,
  right,
}: {
  className?: string;
  onConfirm: () => void;
  message: string;
  action: string;
  right?: boolean;
  render: (triggerConfirm: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={className}>
      <div className="confirm">
        {render(() => setOpen(true))}
        <div
          className={`confirm-popup ${open ? 'confirm-popup--open' : ''} ${
            right ? 'confirm-popup--right' : ''
          }`}
        >
          <p>Are you sure you want to {message}?</p>
          <div className="text-right">
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              {action}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
