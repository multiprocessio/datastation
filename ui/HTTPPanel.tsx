import * as React from 'react';

import { HTTPPanelInfo, HTTPConnectorInfo } from '../shared/state';
import { MODE } from '../shared/constants';
import { parseCSV } from '../shared/text';

import { asyncRPC } from './asyncRPC';
import { Button } from './component-library/Button';
import { Input } from './component-library/Input';

export async function evalHTTPPanel(panel: HTTPPanelInfo) {
  if (MODE === 'demo') {
    const headers: { [v: string]: string } = {};
    panel.http.http.headers.forEach((h: { value: string; name: string }) => {
      headers[h.name] = h.value;
    });
    const res = await window.fetch(panel.content, {
      headers,
      body: panel.content,
    });
    const body = await res.text();
    const type = res.headers.get('content-type');
    switch (type) {
      case 'text/csv':
        return parseCSV(body);
      case 'application/json':
        return JSON.parse(body);
    }
    throw new Error(`Unknown HTTP type: '${type}'`);
  }

  return await asyncRPC<HTTPConnectorInfo, string, Array<object>>(
    'evalHTTP',
    panel.content,
    panel.http
  );
}

export function HTTPPanelDetails({
  panel,
  updatePanel,
}: {
  panel: HTTPPanelInfo;
  updatePanel: (d: HTTPPanelInfo) => void;
}) {
  return (
    <div>
      <Input
        className="block"
        label="URL"
        value={panel.http.http.url}
        onChange={(value: string) => {
          panel.http.http.url = value;
          updatePanel(panel);
        }}
      />
      <div>
        <label>Headers</label>
        {panel.http.http.headers.map(
          (header: { value: string; name: string }) => (
            <div>
              <Input
                label="Name"
                value={header.name}
                onChange={(value: string) => {
                  header.name = value;
                  updatePanel(panel);
                }}
              />
              <Input
                label="Value"
                value={header.value}
                onChange={(value: string) => {
                  header.value = value;
                  updatePanel(panel);
                }}
              />
            </div>
          )
        )}
        <Button
          onClick={() => {
            panel.http.http.headers.push({ name: '', value: '' });
            updatePanel(panel);
          }}
        >
          Add Header
        </Button>
      </div>
    </div>
  );
}
