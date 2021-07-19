import * as React from 'react';
import debounce from 'lodash.debounce';

export function useDebouncedLocalState<T>(
  nonLocalValue: T,
  nonLocalSet: (v: T) => void,
  isText: boolean,
  delay: number = 250
): [T, (v: T) => void] {
  if (!isText) {
    return [nonLocalValue, nonLocalSet];
  }

  const [localValue, setLocalValue] = React.useState<T>(nonLocalValue);

  const debounced = debounce(nonLocalSet, delay);
  function wrapSetLocalValue(v: T) {
    setLocalValue(v);
    debounced(v);
  }

  return [localValue, wrapSetLocalValue];
}

export function Input({
  type,
  placeholder,
  className,
  onChange,
  value,
  min,
  max,
  label,
  disabled,
  readOnly,
  autoWidth,
}: {
  type?: 'text' | 'number' | 'email' | 'password' | 'url' | 'checkbox';
  placeholder?: string;
  className?: string;
  onChange: (value: string) => void;
  value: string;
  min?: number;
  max?: number;
  label?: string;
  disabled?: boolean;
  readOnly?: boolean;
  autoWidth?: boolean;
}) {
  let inputClass = `input ${className ? ' ' + className : ''}`;

  const [localValue, setLocalValue] = useDebouncedLocalState<string>(
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
