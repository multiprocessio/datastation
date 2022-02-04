import debounce from 'lodash.debounce';
import * as React from 'react';
import { Tooltip } from './Tooltip';

export const INPUT_SYNC_PERIOD = 3000;

export function useDebouncedLocalState(
  nonLocalValue: string | number | readonly string[],
  nonLocalSet: (v: string) => void,
  isText = true,
  delay = INPUT_SYNC_PERIOD,
  defaultValue = ''
): [string | number | readonly string[], (v: string) => void] {
  if (!isText) {
    return [nonLocalValue, nonLocalSet];
  }

  const [defaultChanged, setDefaultChanged] = React.useState(false);

  const [localValue, setLocalValue] = React.useState(nonLocalValue);
  React.useEffect(() => {
    setDefaultChanged(true);
    setLocalValue(nonLocalValue);
  }, [nonLocalValue]);

  const debounced = React.useCallback(debounce(nonLocalSet, delay), []);
  function wrapSetLocalValue(v: string) {
    setDefaultChanged(true);
    setLocalValue(v);
    debounced(v);
  }

  React.useEffect(() => {
    if (!localValue && defaultValue && !defaultChanged) {
      wrapSetLocalValue(defaultValue);
    }
  });

  return [localValue, wrapSetLocalValue];
}

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onChange: (value: string) => void;
  label?: string;
  autoWidth?: boolean;
  defaultValue?: string;
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
  defaultValue,
  tooltip,
  ...props
}: InputProps) {
  let inputClass = `input ${className ? ' ' + className : ''}`;

  const [localValue, setLocalValue] = useDebouncedLocalState(
    value,
    onChange,
    type !== 'checkbox' && type !== 'radio',
    INPUT_SYNC_PERIOD,
    defaultValue
  );

  function removeOuterWhitespaceOnFinish() {
    if (typeof localValue === 'string') {
      setLocalValue(localValue.trim());
    }
  }

  const input = (
    <React.Fragment>
      <input
        value={localValue}
        type={type}
        className={label ? '' : inputClass}
        onBlur={removeOuterWhitespaceOnFinish}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setLocalValue(String(e.target.value))
        }
        {...props}
        size={autoWidth ? Math.min(100, String(localValue).length) : undefined}
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
