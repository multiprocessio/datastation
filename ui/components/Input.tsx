import * as React from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { IN_TESTS } from '../../shared/constants';
import { Tooltip } from './Tooltip';

export const INPUT_SYNC_PERIOD = IN_TESTS ? 0 : 3000;

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onChange: (value: string) => void;
  label?: string;
  autoWidth?: boolean;
  defaultValue?: string;
  tooltip?: React.ReactNode;
  invalid?: React.ReactNode;
  noDelay?: boolean;
}

export function Input({
  className,
  onChange,
  invalid,
  value,
  label,
  autoWidth,
  type,
  noDelay,
  defaultValue,
  tooltip,
  ...props
}: InputProps) {
  const inputClass = `input ${className ? ' ' + className : ''}`;

  const debounced = useDebouncedCallback(onChange, INPUT_SYNC_PERIOD);
  // Flush on unmount
  React.useEffect(
    () => () => {
      debounced.flush();
    },
    [debounced]
  );

  const input = (
    <React.Fragment>
      <input
        defaultValue={value || defaultValue}
        type={type}
        className={label ? '' : inputClass}
        onChange={(e) => debounced(e.target.value)}
        onBlur={
          () =>
            debounced.flush() /* Simplifying this to onBlur={debounced.flush} doesn't work. */
        }
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
