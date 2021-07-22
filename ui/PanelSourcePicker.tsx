import * as React from 'react';
import { PanelInfo } from '../shared/state';
import { Select } from './component-library/Select';

export function PanelSourcePicker({
  value,
  onChange,
  panels,
  currentPanel,
}: {
  value: number;
  onChange: (n: number) => void;
  panels: Array<PanelInfo>;
  currentPanel: string;
}) {
  return (
    <Select
      label="Panel Source"
      onChange={(value: string) => onChange(+value)}
      value={value.toString()}
    >
      {panels
        .map((panel, i) =>
          panel.id === currentPanel ? null : (
            <option key={panel.id} value={i.toString()}>
              [#{i}] {panel.name}
            </option>
          )
        )
        .filter(Boolean)}
    </Select>
  );
}
