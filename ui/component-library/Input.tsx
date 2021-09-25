import debounce from 'lodash.debounce';
import * as React from 'react';

export const INPUT_SYNC_PERIOD = 125;

export function useDebouncedLocalState(
  nonLocalValue: string,
  nonLocalSet: (v: string) => void,
  isText: boolean = true,
  delay: number = INPUT_SYNC_PERIOD
): [string, (v: string) => void] {
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

export function Input({
  type,
  placeholder,
  className,
  onBlur,
  onChange,
  value,
  min,
  max,
  label,
  name,
  disabled,
  readOnly,
  autoWidth,
}: {
  type?:
    | 'text'
    | 'number'
    | 'email'
    | 'password'
    | 'url'
    | 'checkbox'
    | 'radio';
  placeholder?: string;
  className?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  value: string;
  min?: number;
  max?: number;
  label?: string;
  name?: string;
  disabled?: boolean;
  readOnly?: boolean;
  autoWidth?: boolean;
}) {
  let inputClass = `input ${className ? ' ' + className : ''}`;

  const [localValue, setLocalValue] = useDebouncedLocalState(
    value,
    onChange,
    type !== 'checkbox'
  );

  const input = (
    <input
      {...(type === 'checkbox'
        ? { checked: value === 'true' }
        : { value: localValue })}
      className={label ? '' : inputClass}
      type={type}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
        setLocalValue(e.target.value)
      }
      name={name}
      onBlur={onBlur}
      disabled={disabled}
      readOnly={readOnly}
      min={min}
      max={max}
      placeholder={placeholder}
      size={autoWidth ? Math.min(100, localValue.length) : undefined}
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
