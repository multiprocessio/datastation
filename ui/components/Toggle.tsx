import React from 'react';

export function Toggle({
  label,
  className,
  value,
  onChange,
}: {
  label: string;
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
    </label>
  );
}
