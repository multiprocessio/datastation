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
  autoWidth,
}: {
  type?: 'text' | 'number' | 'email' | 'password' | 'url' | 'checkbox';
  placeholder?: string;
  className?: string;
  onChange: (value: string) => void;
  value: string;
  min?: number;
  max?: number;
  label?: string;
  disabled?: boolean;
  readOnly?: boolean;
  autoWidth?: boolean;
}) {
  let inputClass = `input ${className ? ' ' + className : ''}`;

  const input = (
    <input
      {...(type === 'checkbox' ? { checked: value === 'true' } : { value })}
      className={label ? '' : inputClass}
      type={type}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
        onChange(e.target.value)
      }
      disabled={disabled}
      readOnly={readOnly}
      min={min}
      max={max}
      placeholder={placeholder}
      size={autoWidth ? Math.min(100, value.length) : undefined}
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
