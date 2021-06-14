import * as React from 'react';

import {
  HTTPPanelInfo,
  HTTPConnectorInfo,
  HTTPConnectorInfoMethod,
} from '../shared/state';
import { MODE } from '../shared/constants';
import { parseArrayBuffer } from '../shared/text';

import { asyncRPC } from './asyncRPC';
import { Button } from './component-library/Button';
import { Input } from './component-library/Input';
import { Select } from './component-library/Select';

export async function evalHTTPPanel(panel: HTTPPanelInfo) {
  if (MODE === 'browser') {
    const headers: { [v: string]: string } = {};
    panel.http.http.headers.forEach((h: { value: string; name: string }) => {
      headers[h.name] = h.value;
    });
    const method = panel.http.http.method;
    const res = await window.fetch(panel.content, {
      headers,
      method,
      body: method !== 'GET' && method !== 'HEAD' ? panel.content : undefined,
    });
    const body = await res.arrayBuffer();
    const type = res.headers.get('content-type');
    return await parseArrayBuffer(type, body);
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
      <Select
        className="block"
        label="Method"
        value={panel.http.http.method}
        onChange={(value: string) => {
          panel.http.http.method = value as HTTPConnectorInfoMethod;
          updatePanel(panel);
        }}
      >
        <option value="GET">GET</option>
        <option value="PUT">PUT</option>
        <option value="POST">POST</option>
        <option value="DELETE">DELETE</option>
        <option value="HEAD">HEAD</option>
      </Select>
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
