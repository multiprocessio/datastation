import CSV from 'papaparse';
import * as React from 'react';

export function parseCSV(csvString: string) {
  const csv = CSV.parse(csvString).data;
  const data = [];
  csv.forEach((row: Array<string>, i: number) => {
    // First row is header
    if (i === 0) {
      return;
    }

    const rowData = {};
    csv[0].forEach((headerName: string, position: number) => {
      rowData[headerName] = row[position];
    });
    data.push(rowData);
  });

  return data;
}

export async function evalHTTPPanel(page: any, panelId: number) {
  const panel = page.panels[panelId];
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

interface HTTPData {
  content: string;
  http: {
    type: 'csv' | 'json';
  };
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
        <select
          value={panel.http.type}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            panel.http.type = e.target.value;
            updatePanel(panel);
          }}
        >
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
      </div>
    </React.Fragment>
  );
}
