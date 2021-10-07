import React from 'react';
import { Input, InputProps } from './Input';

export interface RadioProps extends InputProps {
  options: Array<{ label: string; value: string }>;
  vertical?: boolean;
}

export function Radio({ options, value, vertical, ...props }: RadioProps) {
  React.useEffect(() => {
    if (!options.length) {
      return;
    }

    if (!options.map((o) => String(o.value)).includes(String(value))) {
      props.onChange(String(options[0].value));
    }
  });

  return (
    <span className={`radio ${vertical ? 'radio--vertical' : ''}`}>
      {options.map((o) => (
        <Input
          className="radio-element"
          key={o.value}
          type="radio"
          {...props}
          value={o.value}
          checked={String(o.value) === String(value)}
          label={o.label}
        />
      ))}
    </span>
  );
}
