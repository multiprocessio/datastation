import * as React from 'react';
import { ArrayShape, ObjectShape, ScalarShape, toString } from 'shape';
import { PanelResult } from '../shared/state';
import { Button } from './component-library/Button';
import { Input } from './component-library/Input';
import { Select } from './component-library/Select';

export function orderedObjectFields(
  o: ObjectShape,
  preferredDefaultType?: 'number' | 'string'
) {
  const fields = Object.entries(o.children);
  fields.sort(([aName, a], [bName, b]) => {
    if (a.kind === 'scalar' && b.kind === 'scalar') {
      const ass = a as ScalarShape;
      const bss = b as ScalarShape;
      if (ass.name !== bss.name) {
        if (ass.name === preferredDefaultType) {
          return -1;
        }

        if (bss.name === preferredDefaultType) {
          return 1;
        }
      }
    }

    return aName > bName ? 1 : -1;
  });

  return fields;
}

export function FieldPicker({
  onChange,
  label,
  value,
  panelSourceResult,
  labelValue,
  labelOnChange,
  onDelete,
  preferredDefaultType,
}: {
  onChange: (v: string) => void;
  label: string;
  value: string;
  panelSourceResult: PanelResult;
  labelValue?: string;
  labelOnChange?: (v: string) => void;
  onDelete?: () => void;
  preferredDefaultType?: 'number' | 'string';
}) {
  // Default the label to the field name
  const [labelModified, setLabelModified] = React.useState(false);
  React.useEffect(() => {
    if (labelOnChange && labelValue === '' && value !== '' && !labelModified) {
      labelOnChange(value);
    }
  }, [value, labelValue, labelModified, labelOnChange]);

  const labelOnChangeWrapper = (v: string) => {
    setLabelModified(true);
    return labelOnChange(v);
  };

  let fieldPicker = null;
  if (
    panelSourceResult &&
    panelSourceResult.shape &&
    panelSourceResult.shape.kind === 'array' &&
    (panelSourceResult.shape as ArrayShape).children.kind === 'object'
  ) {
    const fields = orderedObjectFields(
      (panelSourceResult.shape as ArrayShape).children as ObjectShape,
      preferredDefaultType
    );
    fieldPicker = (
      <Select label={label} value={value} onChange={onChange}>
        {fields.map(([name, shape]) => (
          <option key={name} value={name}>
            {name} ({toString(shape)})
          </option>
        ))}
      </Select>
    );
  } else {
    fieldPicker = <Input label={label} value={value} onChange={onChange} />;
  }

  if (!labelOnChange) {
    return fieldPicker;
  }

  return (
    <div>
      {onDelete && (
        <Button icon onClick={onDelete}>
          delete
        </Button>
      )}
      {fieldPicker}
      <Input label="Label" value={labelValue} onChange={labelOnChangeWrapper} />
    </div>
  );
}
