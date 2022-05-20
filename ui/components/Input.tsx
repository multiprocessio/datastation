import * as React from 'react';
import { IN_TESTS } from '../../shared/constants';
import { Tooltip } from './Tooltip';

export const INPUT_SYNC_PERIOD = IN_TESTS ? 0 : 3000;

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onChange: (value: string) => void;
  label?: string;
  autoWidth?: boolean;
  tooltip?: React.ReactNode;
  invalid?: React.ReactNode;
}

export function Input({
  className,
  onChange,
  invalid,
  value,
  label,
  autoWidth,
  type,
  tooltip,
  ...props
}: InputProps) {
  const inputClass = `input ${className ? ' ' + className : ''}`;

  const [local, setLocal] = React.useState(value);
  // Resync value when outer changes
  React.useEffect(() => {
    setLocal(value);
  }, [value]);

  const input = (
    <React.Fragment>
      <input
        value={local}
        type={type}
        className={label ? '' : inputClass}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onChange(String(local))}
        {...props}
        size={autoWidth ? Math.max(20, String(value).length) : undefined}
      />
      {tooltip && <Tooltip children={tooltip} />}
      {invalid && <small className="input-invalid">{invalid}</small>}
    </React.Fragment>
  );

  if (label) {
    return (
      <label className={inputClass + ' vertical-align-center'}>
        <span className="input-label">{label}</span>
        {input}
      </label>
    );
  }

  return input;
}
