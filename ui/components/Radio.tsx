import React from 'react';
import { Input, InputProps } from './Input';

interface RadioProps extends InputProps {
  options: Array<{ label: string; value: string }>;
  vertical?: boolean;
}

export function Radio({
  options,
  value,
  label,
  vertical,
  ...props
}: RadioProps) {
  React.useEffect(() => {
    if (!options.length) {
      return;
    }

    if (!options.map((o) => String(o.value)).includes(String(value))) {
      props.onChange(String(options[0].value));
    }
  });

  const radioClass = 'radio' + (vertical ? ' radio--vertical' : '');

  const radio = (
    <span
      className={
        (label ? '' : radioClass + ' ') +
        (vertical ? '' : 'vertical-align-center')
      }
    >
      {options.map((o) => {
        const checked = String(o.value) === String(value);
        return (
          <Input
            className={`radio-element ${
              checked ? 'radio-element--selected' : ''
            }`}
            key={o.value}
            type="radio"
            {...props}
            value={o.value}
            checked={checked}
            label={o.label}
          />
        );
      })}
    </span>
  );

  if (label) {
    return (
      <label className={radioClass + ' radio-wrapper vertical-align-center'}>
        <span className="radio-label">{label}</span>
        {radio}
      </label>
    );
  }

  return radio;
}
