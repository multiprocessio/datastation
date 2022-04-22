import React from 'react';

export function Toggle({
  label,
  className,
  value,
  rhsLabel,
  onChange,
}: {
  label: string;
  rhsLabel: React.ReactNode;
  value: boolean;
  onChange: () => void;
  className?: string;
}) {
  return (
    <label className={`toggle ${className || ''}`}>
      <span className="toggle-label">{label}</span>
      <input type="checkbox" checked={value} onChange={onChange} />
      <span className="toggle-container">
        <span className="toggle-mover" />
      </span>
      {rhsLabel ? <label className="pl-1">{rhsLabel}</label> : null}
    </label>
  );
}
