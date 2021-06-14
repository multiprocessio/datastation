import * as React from 'react';

export function FileInput({
  className,
  onChange,
  label,
  disabled,
  readOnly,
}: {
  className?: string;
  onChange: (files: Array<File>) => void;
  label?: string;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  let inputClass = `input ${className ? ' ' + className : ''}`;

  const input = (
    <input
      className={label ? '' : inputClass}
      type="file"
      onChange={function () {
        onChange(this.files);
      }}
      disabled={disabled}
      readOnly={readOnly}
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
