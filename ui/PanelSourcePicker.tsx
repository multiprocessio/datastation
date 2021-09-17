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
  const reversed = panels.slice().reverse();
  return (
    <Select
      label="Panel Source"
      onChange={(value: string) => onChange(+value)}
      value={value.toString()}
    >
      {reversed
        .map((panel, i) => {
          const originalIndex = panels.length - (i + 1);
          return panel.id === currentPanel ? null : (
            <option key={panel.id} value={originalIndex.toString()}>
              [#{originalIndex}] {panel.name}
            </option>
          );
        })
        .filter(Boolean)}
    </Select>
  );
}
