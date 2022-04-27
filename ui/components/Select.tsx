import * as React from 'react';
import { Tooltip } from './Tooltip';

export const NONE = '-- None --';

export function Select({
  value,
  onChange,
  children,
  disabled,
  label,
  className,
  allowNone,
  tooltip,
  subtext,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  label?: string;
  className?: string;
  allowNone?: string;
  tooltip?: React.ReactNode;
  subtext?: React.ReactNode;
}) {
  let selectClass = 'select vertical-align-center';
  if (className) {
    selectClass += ' ' + className;
  }

  const select = (
    <div className="vertical-align-center">
      <select
        className={`${label ? '' : className} select-container`}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
          onChange(e.target.value)
        }
        disabled={disabled}
      >
        {allowNone ? <option value={NONE}>{allowNone}</option> : null}
        {children}
      </select>
      {tooltip && <Tooltip>{tooltip}</Tooltip>}
      <div>
        <small>{subtext}</small>
      </div>
    </div>
  );

  return (
    <label className={selectClass}>
      {label && <span className="select-label">{label}</span>}
      {select}
    </label>
  );
}
