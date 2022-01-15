import * as React from 'react';
import { Input } from './Input';

type Base = {
  className?: string;
  onChange: (fileName: string) => void;
  label?: string;
  disabled?: boolean;
  readOnly?: boolean;
  accept?: string;
  value: string;
  onRead?: (value: ArrayBuffer) => void;
  allowManualEntry?: boolean;
  allowFilePicker?: boolean;
  placeholder?: string;
};

// SOURCE: https://stackoverflow.com/a/49725198/1507139
type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

type Props = RequireAtLeastOne<Base, 'allowManualEntry' | 'allowFilePicker'>;

export function FileInput({
  className,
  onChange,
  onRead,
  label,
  disabled,
  readOnly,
  accept,
  value,
  allowManualEntry,
  allowFilePicker,
  placeholder,
}: Props) {
  let inputClass = `input ${className ? ' ' + className : ''}`;

  const manualInput = (
    <Input
      placeholder={placeholder}
      autoWidth={true}
      value={value}
      onChange={onChange}
    />
  );

  const input = (
    <input
      type="file"
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const { files } = e.target;
        if (!files.length) {
          return;
        }

        const fr = new FileReader();

        if (onRead) {
          fr.onload = function () {
            onRead(fr.result as ArrayBuffer);
          };

          fr.readAsArrayBuffer(files[0]);
        }

        // .path is available on Electron and gives the full path.
        // Browsers otherwise only support giving you the file name
        // without path for security reasons.
        onChange(files[0].path || files[0].name);
      }}
      disabled={disabled}
      readOnly={readOnly}
      accept={accept}
    />
  );

  return (
    <label className={inputClass}>
      {label && <span className="input-label">{label}</span>}
      <span>
        {allowManualEntry && manualInput}
        {allowFilePicker && input}
      </span>
    </label>
  );
}
