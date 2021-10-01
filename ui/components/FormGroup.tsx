import React from 'react';

export function FormGroup({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="form-group">
      {label && <label className="form-group-label">{label}</label>}
      <div className="form-group-children">{children}</div>
    </div>
  );
}
