import * as React from 'react';
import { PanelResult } from '../shared/state';
import { Button } from './component-library/Button';
import { Input } from './component-library/Input';
import { Select } from './component-library/Select';

export function FieldPicker({
  onChange,
  label,
  value,
  panelSourceResult,
  labelValue,
  labelOnChange,
  onDelete,
}: {
  onChange: (v: string) => void;
  label: string;
  value: string;
  panelSourceResult: PanelResult;
  labelValue?: string;
  labelOnChange?: (v: string) => void;
  onDelete?: () => void;
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
    panelSourceResult.value &&
    panelSourceResult.value.length
  ) {
    const fields = Object.keys(panelSourceResult.value[0]);
    fields.sort();
    fieldPicker = (
      <Select label={label} value={value} onChange={onChange}>
        {fields.map((f) => (
          <option key={f} value={f}>
            {f}
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
