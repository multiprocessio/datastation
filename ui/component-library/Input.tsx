import * as React from 'react';

export function Input({
  type,
  className,
  onChange,
  value,
  min,
  max,
  label,
  disabled,
}: {
  type?: 'text' | 'number' | 'email' | 'password';
  className?: string;
  onChange: (value: string) => void;
  value: string;
  min?: number;
  max?: number;
  label?: string;
  disabled?: boolean;
}) {
  let inputClass = `input ${className ? ' ' + className : ''}`;

  const input = (
    <input
      className={label ? '' : inputClass}
      type={type}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
        onChange(e.target.value)
      }
      disabled={disabled}
      value={value}
      min={min}
      max={max}
    />
  );

  if (label) {
    return (
      <label className={inputClass}>
        {label}
        {input}
      </label>
    );
  }

  return input;
}
