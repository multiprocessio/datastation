import React from 'react';
import { Input, InputProps } from './Input';

export interface RadioProps extends InputProps {
  options: Array<{label:string;value:string;}>;
}

export function Radio({
  options,
  value,
  ...props
}: RadioProps) {
  React.useEffect(() => {
    if (!options.length) {
      return;
    }

    if (!options.map(o => o.value).includes(String(value))) {
      props.onChange(options[0].value);
    }
  });

  return <React.Fragment>{options.map(o => <Input type="radio" {...props} value={o.value} checked={o.value === String(value)} label={o.label} />)}</React.Fragment>;
}
