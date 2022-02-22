import React from 'react';

export function FormGroup({
  label,
  children,
  major,
}: {
  major?: boolean;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`form-group ${major ? 'form-group--major' : ''}`}>
      {label && <label className="form-group-label">{label}</label>}
      <div className="form-group-children">{children}</div>
    </div>
  );
}
