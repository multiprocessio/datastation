import * as React from 'react';

export function Select({
  value,
  onChange,
  children,
  disabled,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  let selectClass = 'select';
  if (className) {
    selectClass += ' ' + className;
  }

  const select = (
    <select
      className={label ? '' : className}
      value={value}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
        onChange(e.target.value)
      }
      children={children}
      disabled={disabled}
    />
  );

  if (label) {
    return (
      <label className={selectClass}>
        {label}
        {select}
      </label>
    );
  }

  return select;
}
