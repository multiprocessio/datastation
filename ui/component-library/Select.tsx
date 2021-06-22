import * as React from 'react';

function getOptionValues(children: React.ReactNode) {
  return React.Children.map(
    children,
    // This could blow up if someone ever doesn't pass <option> to <Select>
    (c) => (c as React.ReactElement).props.value
  );
}

export function Select({
  value,
  onChange,
  children,
  disabled,
  label,
  className,
  nodefault,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  label?: string;
  className?: string;
  nodefault?: boolean;
}) {
  let selectClass = 'select';
  if (className) {
    selectClass += ' ' + className;
  }

  React.useEffect(() => {
    const values = getOptionValues(children);
    if (values.length && !values.includes(value)) {
      onChange(values[0]);
    }
  }, [value, getOptionValues(children).join(',')]);

  const select = (
    <select
      className={label ? '' : className}
      value={value}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
        onChange(e.target.value)
      }
      disabled={disabled}
    >
      {nodefault && <option label=" "></option>}
      {children}
    </select>
  );

  if (label) {
    return (
      <label className={selectClass}>
        {label}
        {select}
      </label>
    );
  }

  return select;
}
