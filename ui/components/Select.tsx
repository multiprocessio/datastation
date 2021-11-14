import * as React from 'react';
import { Tooltip } from './Tooltip';

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

export const NONE = '----none----';

export function Select({
  value,
  onChange,
  children,
  disabled,
  label,
  className,
  used,
  allowNone,
  tooltip,
  subtext,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  label?: string;
  className?: string;
  used?: Array<string>;
  allowNone?: string;
  tooltip?: React.ReactNode;
  subtext?: React.ReactNode;
}) {
  let selectClass = 'select vertical-align-center';
  if (className) {
    selectClass += ' ' + className;
  }

  React.useEffect(() => {
    const values = [
      allowNone ? NONE : null,
      ...getOptionValues(children),
    ].filter(Boolean);
    if (values.length && !values.includes(value)) {
      let foundUnused = false;
      for (let value of values) {
        if ((used && used.includes(value)) || allowNone) {
          continue;
        }

        foundUnused = true;
        onChange(value);
        break;
      }

      if (allowNone) {
        onChange(NONE);
        return;
      }

      if (!foundUnused) {
        onChange(values[0]);
      }
    }
  }, [value, getOptionValues(children).join(',')]);

  const select = (
    <div>
      <select
        className={`${label ? '' : className} select-container`}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
          onChange(e.target.value)
        }
        disabled={disabled}
      >
        {allowNone ? <option value={NONE}>{allowNone}</option> : null}
        {children}
      </select>
      {tooltip && <Tooltip>{tooltip}</Tooltip>}
      <div>
        <small>{subtext}</small>
      </div>
    </div>
  );
  if (label) {
    return (
      <label className={selectClass}>
        <span className="select-label">{label}</span>
        {select}
      </label>
    );
  }

  return select;
}
