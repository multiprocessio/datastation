import * as React from 'react';

import { PanelInfo, PanelInfoType } from '../shared/state';

import { Select } from './component-library/Select';

export function PanelSourcePicker({
  value,
  onChange,
  panels,
}: {
  value: number;
  onChange: (n: number) => void;
  panels: Array<PanelInfo>;
}) {
  return (
    <Select
      label="Panel Source"
      onChange={(value: string) => onChange(+value)}
      value={value.toString()}
    >
      {panels.map((panel, i) => (
        <option key={panel.id} value={i.toString()}>
          [#{i}] {panel.name}
        </option>
      ))}
    </Select>
  );
}
