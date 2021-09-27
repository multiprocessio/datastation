import * as React from 'react';

export function Modal({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal">
      <div className="modal-body">{children}</div>
    </div>
  );
}
