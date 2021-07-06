import * as React from 'react';

import {
  Proxy,
  ServerInfo,
  HTTPPanelInfo,
  HTTPConnectorInfo,
  HTTPConnectorInfoMethod,
} from '../shared/state';
import { MODE } from '../shared/constants';
import { request } from '../shared/http';

import { asyncRPC } from './asyncRPC';
import { ProjectContext } from './ProjectStore';
import { ServerPicker } from './ServerPicker';
import { Button } from './component-library/Button';
import { Input } from './component-library/Input';
import { Select } from './component-library/Select';

export async function evalHTTPPanel(
  panel: HTTPPanelInfo,
  _: any,
  servers: Array<ServerInfo>
) {
  if (MODE === 'browser') {
    return await request(
      (window as any).fetch,
      panel.http.http.method,
      panel.http.http.url,
      panel.http.http.headers,
      panel.content
    );
  }

  const connector = panel.http as Proxy<HTTPConnectorInfo>;
  connector.server = servers.find(
    (s) => s.id === (panel.serverId || connector.serverId)
  );
  return await asyncRPC<Proxy<HTTPConnectorInfo>, string, Array<object>>(
    'evalHTTP',
    panel.content,
    connector
  );
}

export function HTTPPanelDetails({
  panel,
  updatePanel,
}: {
  panel: HTTPPanelInfo;
  updatePanel: (d: HTTPPanelInfo) => void;
}) {
  const { servers } = React.useContext(ProjectContext);
  return (
    <React.Fragment>
      <div className="form-row">
        <Select
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
      </div>
      <div className="form-row">
        <Input
          label="URL"
          value={panel.http.http.url}
          onChange={(value: string) => {
            panel.http.http.url = value;
            updatePanel(panel);
          }}
        />
      </div>
      <div className="form-row">
        <label>Headers</label>
        {panel.http.http.headers.map(
          (header: { value: string; name: string }, headerIndex: number) => (
            <div className="form-row">
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
              <Button
                onClick={() => {
                  panel.http.http.headers.splice(headerIndex, 1);
                  updatePanel(panel);
                }}
              >
                Remove
              </Button>
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
        <ServerPicker
          servers={servers}
          serverId={panel.serverId}
          onChange={(serverId: string) => {
            panel.serverId = serverId;
            updatePanel(panel);
          }}
        />
      </div>
    </React.Fragment>
  );
}
