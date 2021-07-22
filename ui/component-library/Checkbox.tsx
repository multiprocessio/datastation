import * as React from 'react';
import { Input } from './Input';

export function Checkbox({
  className,
  onChange,
  value,
  label,
  disabled,
}: {
  className?: string;
  onChange: (v: boolean) => void;
  value: boolean;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <Input
      type="checkbox"
      label={label}
      value={String(value)}
      onChange={() => onChange(!value)}
      disabled={disabled}
      className={className}
    />
  );
}
