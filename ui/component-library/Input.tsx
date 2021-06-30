import * as React from 'react';

export function Input({
  type,
  placeholder,
  className,
  onChange,
  value,
  min,
  max,
  label,
  disabled,
  readOnly,
}: {
  type?: 'text' | 'number' | 'email' | 'password';
  placeholder?: string;
  className?: string;
  onChange: (value: string) => void;
  value: string;
  min?: number;
  max?: number;
  label?: string;
  disabled?: boolean;
  readOnly?: boolean;
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
      readOnly={readOnly}
      value={value}
      min={min}
      max={max}
      placeholder={placeholder}
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
