import debounce from 'lodash.debounce';
import * as React from 'react';

export const INPUT_SYNC_PERIOD = 125;

export function useDebouncedLocalState(
  nonLocalValue: string | number | readonly string[],
  nonLocalSet: (v: string) => void,
  isText: boolean = true,
  delay: number = INPUT_SYNC_PERIOD
): [string | number | readonly string[], (v: string) => void] {
  if (!isText) {
    return [nonLocalValue, nonLocalSet];
  }

  const [localValue, setLocalValue] = React.useState(nonLocalValue);
  React.useEffect(() => {
    setLocalValue(nonLocalValue);
  }, [nonLocalValue]);

  const debounced = React.useCallback(debounce(nonLocalSet, delay), []);
  function wrapSetLocalValue(v: string) {
    setLocalValue(v);
    debounced(v);
  }

  return [localValue, wrapSetLocalValue];
}

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onChange: (value: string) => void;
  label?: string;
  autoWidth?: boolean;
}

export function Input({
  className,
  onChange,
  value,
  label,
  autoWidth,
  type,
  ...props
}: InputProps) {
  let inputClass = `input ${className ? ' ' + className : ''}`;

  const [localValue, setLocalValue] = useDebouncedLocalState(
    value,
    onChange,
    type !== 'checkbox'
  );

  const input = (
    <input
      type={type}
      {...(type === 'checkbox'
        ? { checked: value === 'true' }
        : { value: localValue })}
      className={label ? '' : inputClass}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
        setLocalValue(String(e.target.value))
      }
      {...props}
      size={autoWidth ? Math.min(100, String(localValue).length) : undefined}
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
