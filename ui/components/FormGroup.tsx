import React from 'react';

export function FormGroup({
  label,
  children,
  major,
  optional,
}: {
  major?: boolean;
  label?: string;
  optional?: string;
  children: React.ReactNode;
}) {
  const body = (
    <div className={`form-group ${major ? 'form-group--major' : ''}`}>
      {label && <label className="form-group-label">{label}</label>}
      <div className="form-group-children">{children}</div>
    </div>
  );

  if (!optional) {
    return body;
  }

  return <details>
    <summary>{optional}</summary>
    {body}
  </details>
}
