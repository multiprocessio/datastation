import * as React from 'react';

export function FileInput({
  className,
  onChange,
  label,
  disabled,
  readOnly,
  accept,
}: {
  className?: string;
  onChange: (files: Array<File>) => void;
  label?: string;
  disabled?: boolean;
  readOnly?: boolean;
  accept?: string;
}) {
  let inputClass = `input ${className ? ' ' + className : ''}`;

  const input = (
    <input
      className={label ? '' : inputClass}
      type="file"
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(Array.prototype.slice.apply(e.target.files));
      }}
      disabled={disabled}
      readOnly={readOnly}
      accept={accept}
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
