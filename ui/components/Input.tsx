import debounce from 'lodash.debounce';
import * as React from 'react';
import { IN_TESTS } from '../../shared/constants';
import { Tooltip } from './Tooltip';

export const INPUT_SYNC_PERIOD = IN_TESTS ? 0 : 3000;

export function useDebouncedLocalState(
  nonLocalValue: string | number | readonly string[],
  nonLocalSet: (v: string) => void,
  isText = true,
  delay = INPUT_SYNC_PERIOD,
  defaultValue = ''
): [string | number | readonly string[], (v: string) => void, () => void] {
  if (!isText) {
    return [nonLocalValue, nonLocalSet, () => {}];
  }

  const [defaultChanged, setDefaultChanged] = React.useState(false);
  const debounced = React.useCallback(debounce(nonLocalSet, delay), []);

  const [localValue, setLocalValue] = React.useState(nonLocalValue);
  // Resync to props when props changes
  React.useEffect(() => {
    debounced.flush();
    setDefaultChanged(true);
    setLocalValue(nonLocalValue);
  }, [nonLocalValue]);

  function wrapSetLocalValue(v: string) {
    if (String(v) !== String(nonLocalValue)) {
      // Only important the first time
      setDefaultChanged(true);

      // First update local state
      setLocalValue(v);

      // Then set off debouncer to eventually update external state
      debounced(v);
    }
  }

  function flushValue() {
    debounced.flush();
  }

  // Set up initial value if there is any
  React.useEffect(() => {
    if (!localValue && defaultValue && !defaultChanged) {
      wrapSetLocalValue(defaultValue);
    }
  });

  return [localValue, wrapSetLocalValue, flushValue];
}

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
  let inputClass = `input ${className ? ' ' + className : ''}`;

  const [localValue, setLocalValue, flushLocalValue] = useDebouncedLocalState(
    value,
    onChange,
    type !== 'checkbox' && type !== 'radio' && !noDelay,
    INPUT_SYNC_PERIOD,
    defaultValue
  );

  function removeOuterWhitespaceOnFinish() {
    let v = localValue;
    if (typeof localValue === 'string') {
      v = localValue.trim();
      setLocalValue(v);
    }

    flushLocalValue();
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
        size={autoWidth ? Math.max(20, String(localValue).length) : undefined}
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
