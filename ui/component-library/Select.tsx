import * as React from 'react';
import ReactSelect from 'react-select';

function htmlToOptions(children: React.ReactNode) {
  return React.Children.map(children, (c: React.ReactElement) => {
    if (!c) {
      return;
    }

    if (c.type === 'option') {
      const o = (c as React.ReactElement);
      return {label: o.props.children, value: o.props.value};
    }

    if (c.type === 'optgroup') {
      return {
        label: (c as React.ReactElement).props.label,
        options: htmlToOptions(c.props.children),
      };
    }

    return;
  })
    .filter(Boolean)
}

function getOptionValues(children: React.ReactNode): Array<string> {
  return React.Children.map(children, (c: React.ReactElement) => {
    if (!c) {
      return;
    }

    if (c.type === 'option') {
      return (c as React.ReactElement).props.value;
    }

    if (c.type === 'optgroup') {
      return getOptionValues(c.props.children);
    }

    return;
  })
    .filter(Boolean)
    .flat();
}

export function Select({
  value,
  onChange,
  children,
  disabled,
  label,
  className,
  used,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  label?: string;
  className?: string;
  used?: Array<string>;
}) {
  let selectClass = 'select';
  if (className) {
    selectClass += ' ' + className;
  }

  React.useEffect(() => {
    const values = getOptionValues(children);
    if (values.length && !values.includes(value)) {
      let foundUnused = false;
      for (let value of values) {
        if (used && used.includes(value)) {
          continue;
        }

        foundUnused = true;
        onChange(value);
        break;
      }

      if (!foundUnused) {
        onChange(values[0]);
      }
    }
  }, [value, getOptionValues(children).join(',')]);

  const select = (
    <ReactSelect
      className={label ? '' : className}
      value={value}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>{
        console.log(e);
        onChange(e.target.value)
      }}
      disabled={disabled}
      options={htmlToOptions(children)}
    />
  );

  console.log(htmlToOptions(children), children);
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
