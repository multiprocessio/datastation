import { IconTrash } from '@tabler/icons';
import * as React from 'react';
import { ArrayShape, ObjectShape, ScalarShape, Shape } from 'shape';
import { title } from '../../shared/text';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';

export type FieldGroup = { name: string; elements: Array<[string, Shape]> };

export function flattenObjectFields(o: ObjectShape): Array<[string, Shape]> {
  let stack: [[string[], Shape]] = [[[], o]];
  const flat: Array<[string, Shape]> = [];

  while (stack.length) {
    const [path, shape] = stack.pop();

    switch (shape.kind) {
      case 'scalar':
        flat.push([path.join('.'), shape]);
        break;
      case 'object':
        for (const [key, value] of Object.entries(shape.children)) {
          stack.push([[...path, key.replace('.', '\\.')], value]);
        }
        break;
    }
  }

  return flat.sort(([a], [b]) => (a > b ? 1 : -1));
}

export function orderedObjectFields(
  o: ObjectShape,
  preferredDefaultType: 'number' | 'string' = 'string'
) {
  const fields = flattenObjectFields(o);
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

    if (a.kind !== 'scalar' && b.kind === 'scalar') {
      return 1;
    }

    return aName > bName ? 1 : -1;
  });

  const groups: Array<FieldGroup> = [];
  fields.forEach(([field, shape]) => {
    const ss = shape as ScalarShape;
    const scalar = shape.kind === 'scalar';
    let last = groups[groups.length - 1];

    // If first time, start a new group with this name
    if (!last) {
      groups.push({
        name: scalar ? title(ss.name) : 'Other',
        elements: [[field, shape]],
      });
      return;
    }

    // If needed, create a new group for scalars
    if (scalar && last.name != title(ss.name)) {
      groups.push({
        name: title(ss.name),
        elements: [[field, shape]],
      });
      return;
    }

    // Start the "Other" group when needed
    if (!scalar && last.name !== 'Other') {
      groups.push({
        name: 'Other',
        elements: [[field, shape]],
      });
      return;
    }

    last.elements.push([field, shape]);
  });
  return groups;
}

function renderOptions(group: FieldGroup, grouped: boolean) {
  const options = group.elements.map(([name]) => (
    <option key={name} value={name}>
      {name}
    </option>
  ));

  if (grouped) {
    return (
      <optgroup key={group.name} label={group.name}>
        {options}
      </optgroup>
    );
  }

  return options;
}

export function wellFormedGraphInput(shape?: Shape) {
  return (
    shape &&
    shape.kind === 'array' &&
    (shape as ArrayShape).children.kind === 'object'
  );
}

export function allFields(shape: Shape) {
  if (!wellFormedGraphInput(shape)) {
    return [];
  }

  const os = (shape as ArrayShape).children as ObjectShape;
  return flattenObjectFields(os);
}

export function unusedFields(shape: Shape, ...fields: Array<string>) {
  return allFields(shape).filter(([field]) => {
    return !fields.includes(field);
  }).length;
}

export function FieldPicker({
  onChange,
  label,
  value,
  shape,
  labelValue,
  labelOnChange,
  onDelete,
  preferredDefaultType,
  used,
  allowNone,
  tooltip,
}: {
  onChange: (v: string) => void;
  label: string;
  value: string;
  shape?: Shape;
  labelValue?: string;
  labelOnChange?: (v: string) => void;
  onDelete?: () => void;
  preferredDefaultType?: 'number' | 'string';
  used?: Array<string>;
  allowNone?: string;
  tooltip?: React.ReactNode;
}) {
  // Default the label to the field name
  const [labelModified, setLabelModified] = React.useState(false);
  React.useEffect(() => {
    if (
      labelOnChange &&
      !labelModified &&
      value &&
      title(value) !== labelValue
    ) {
      labelOnChange(title(value));
    }
  }, [value, labelValue, labelModified, labelOnChange]);

  const labelOnChangeWrapper = (v: string) => {
    setLabelModified(true);
    return labelOnChange(v);
  };

  let fieldPicker = null;
  if (wellFormedGraphInput(shape)) {
    const fieldGroups = orderedObjectFields(
      (shape as ArrayShape).children as ObjectShape,
      preferredDefaultType
    );
    fieldPicker = (
      <Select
        label={label}
        value={value}
        onChange={onChange}
        used={used}
        allowNone={allowNone}
        tooltip={labelOnChange ? null : tooltip}
      >
        {fieldGroups.length === 1
          ? renderOptions(fieldGroups[0], false)
          : fieldGroups.map((fg) => renderOptions(fg, true))}
      </Select>
    );
  } else {
    fieldPicker = (
      <Input
        placeholder={allowNone}
        label={label}
        value={value}
        onChange={onChange}
        tooltip={labelOnChange ? null : tooltip}
      />
    );
  }

  if (!labelOnChange) {
    return fieldPicker;
  }

  return (
    <React.Fragment>
      {fieldPicker}
      <Input
        label="Label"
        value={labelValue}
        onChange={labelOnChangeWrapper}
        tooltip={tooltip}
      />
      {onDelete && (
        <Button icon onClick={onDelete} type="outline">
          <IconTrash />
        </Button>
      )}
    </React.Fragment>
  );
}
