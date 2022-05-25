import * as React from 'react';
import { IN_TESTS } from '../../shared/constants';
import { Tooltip } from './Tooltip';

export const INPUT_SYNC_PERIOD = IN_TESTS ? 0 : 3000;

export interface InputProps
  extends Omit<Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>, 'style'> {
  onChange: (value: string) => void;
  label?: string;
  autoWidth?: boolean;
  tooltip?: React.ReactNode;
  invalid?: React.ReactNode;
  noBuffer?: boolean;
}

export function Input({
  className,
  onChange,
  invalid,
  value,
  label,
  autoWidth,
  type,
  noBuffer,
  tooltip,
  ...props
}: InputProps) {
  const inputClass = `input ${className ? ' ' + className : ''}`;

  const [local, setLocal] = React.useState(value);
  // Resync value when outer changes
  React.useEffect(() => {
    setLocal(value);
  }, [value]);

  const changeProps = noBuffer
    ? {
      onChange(e: React.ChangeEvent<HTMLInputElement>) {
        onChange(String(e.target.value));
      },
    }
    : {
      onChange(e: React.ChangeEvent<HTMLInputElement>) {
        setLocal(e.target.value);
      },
      onBlur() {
        onChange(String(local));
      },
    };

  const input = (
    <React.Fragment>
      <input
        value={local}
        type={type}
        className={label ? '' : inputClass}
        {...changeProps}
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
