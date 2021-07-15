import * as React from 'react';

import { MODE } from '../shared/constants';
import { XLSX_MIME_TYPE } from '../shared/text';

import { Select } from './component-library/Select';

export function ContentTypePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="form-row">
      <Select
        label="Content Type"
        value={value}
        onChange={(type: string) => {
          if (type === 'null') {
            type = '';
          }

          return onChange(type);
        }}
      >
        <option value="null">Auto-detect</option>
        <option value="text/csv">CSV</option>
        <option value={XLSX_MIME_TYPE}>Excel</option>
        {MODE !==
          'browser' /* This is getting ridiculous. Really need to find a plugin architecture */ && (
          <option value="parquet">Parquet</option>
        )}
        <option value="application/json">JSON</option>
        <option value="application/jsonlines">Newline-delimited JSON</option>
      </Select>
    </div>
  );
}
