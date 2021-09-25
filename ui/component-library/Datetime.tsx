import format from 'date-fns/format';
import React from 'react';
import { Input, InputProps } from './Input';

export interface Datetime extends Omit<InputProps, 'value' | 'onChange'> {
  value: Date;
  onChange: (d: Date) => void;
}

export function Datetime({
  value,
  label,
  className,
  onChange,
  ...props
}: Datetime) {
  const date = format(value, 'yyyy-mm-dd');
  const time = format(value, 'yyyy-mm-dd');

  function onDateChange(newDate: string) {
    const copy = new Date(value);
    const nd = new Date(newDate);
    copy.setDate(nd.getDate());
    copy.setMonth(nd.getMonth());
    copy.setFullYear(nd.getFullYear());
    onChange(copy);
  }

  function onTimeChange(newTime: string) {
    const copy = new Date(value);
    const [h, m] = newTime.split(':');
    copy.setHours(+h || 0);
    copy.setMinutes(+m || 0);
    onChange(copy);
  }

  return (
    <div className={`flex ${className}`}>
      <Input
        onChange={onDateChange}
        label={label}
        type="date"
        value={date}
        {...props}
      />
      <Input onChange={onTimeChange} type="time" value={time} {...props} />
    </div>
  );
}
