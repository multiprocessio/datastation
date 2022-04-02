import debounce from 'lodash.debounce';
import * as React from 'react';
import { IN_TESTS } from '../../shared/constants';
import { Tooltip } from './Tooltip';

export const INPUT_SYNC_PERIOD = IN_TESTS ? 0 : 3000;

export function registerDebouncedChangeHandler(
  node: HTMLInputElement,
  onChange: (v: string) => void,
  noDelay?: boolean
): [() => void, () => void] {
  const debounced = debounce(onChange, INPUT_SYNC_PERIOD);
  function listener(e: Event) {
    const v = String((e.target as HTMLInputElement).value).trim();
    if (noDelay) {
      onChange(v);
      return;
    }

    debounced(v);
  }

  node.addEventListener('input', listener);
  return [
    () => node.removeEventListener('input', listener),
    () => debounced.flush(),
  ];
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
  const inputClass = `input ${className ? ' ' + className : ''}`;
  const [inputNode, inputRef] = React.useState<HTMLInputElement>(null);
  const flush = React.useRef<() => void>(() => {
    /* ignore */
  });

  React.useEffect(() => {
    if (!inputNode) {
      return;
    }

    const [unload, f] = registerDebouncedChangeHandler(
      inputNode,
      onChange,
      noDelay
    );
    flush.current = f;
    return unload;
  }, [inputNode, onChange, noDelay]);

  const input = (
    <React.Fragment>
      <input
        defaultValue={value || defaultValue}
        type={type}
        ref={inputRef}
        className={label ? '' : inputClass}
        onBlur={
          () =>
            flush.current() /* Simplifying this to onBlur={flush.current} doesn't work. */
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
