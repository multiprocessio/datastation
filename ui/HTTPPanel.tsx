import * as CSV from 'papaparse';
import * as React from 'react';

import { HTTPPanelInfo } from './ProjectStore';
import { Select } from './component-library/Select';

export function parseCSV(csvString: string) {
  const csv = CSV.parse(csvString).data;
  const data: Array<{ [k: string]: any }> = [];
  csv.forEach((row: Array<string>, i: number) => {
    // First row is header
    if (i === 0) {
      return;
    }

    const rowData: { [k: string]: any } = {};
    (csv[0] as Array<string>).forEach(
      (headerName: string, position: number) => {
        rowData[headerName] = row[position];
      }
    );
    data.push(rowData);
  });

  return data;
}

export async function evalHTTPPanel(panel: HTTPPanelInfo) {
  const res = await window.fetch(panel.content);
  const body = await res.text();
  const http = panel.http;
  switch (http.type) {
    case 'csv':
      return parseCSV(body);
    case 'json':
      return JSON.parse(body);
  }

  throw new Error(`Unknown HTTP type: '${http.type}'`);
}

export function HTTPPanelDetails({
  panel,
  updatePanel,
}: {
  panel: HTTPPanelInfo;
  updatePanel: (d: HTTPPanelInfo) => void;
}) {
  return (
    <React.Fragment>
      <div>
        <Select
          value={panel.http.type}
          onChange={(value: string) => {
            switch (value) {
              case 'json':
                panel.http.type = 'json';
                break;
              case 'csv':
                panel.http.type = 'csv';
                break;
              default:
                throw new Error(`Unknown HTTP type: ${value}`);
            }
            updatePanel(panel);
          }}
        >
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </Select>
      </div>
    </React.Fragment>
  );
}
