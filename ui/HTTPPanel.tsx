import * as React from 'react';
import { MODE } from '../shared/constants';
import { request } from '../shared/http';
import { previewObject } from '../shared/preview';
import {
  ContentTypeInfo,
  HTTPConnectorInfo,
  HTTPConnectorInfoMethod,
  HTTPPanelInfo,
  Proxy,
  ServerInfo,
} from '../shared/state';
import { asyncRPC } from './asyncRPC';
import { Button } from './component-library/Button';
import { Input } from './component-library/Input';
import { Select } from './component-library/Select';
import { ContentTypePicker } from './ContentTypePicker';
import { ProjectContext } from './ProjectStore';
import { ServerPicker } from './ServerPicker';

export async function evalHTTPPanel(
  panel: HTTPPanelInfo,
  _: any,
  servers: Array<ServerInfo>
) {
  if (MODE === 'browser') {
    const value = await request(
      (window as any).fetch,
      panel.http.http.method,
      panel.http.http.url,
      panel.http.http.contentTypeInfo,
      panel.http.http.headers,
      panel.content
    );
    return { value, preview: previewObject(value) };
  }

  const connector = panel.http as Proxy<HTTPConnectorInfo>;
  connector.server = servers.find(
    (s) => s.id === (panel.serverId || connector.serverId)
  );
  return await asyncRPC<
    Proxy<HTTPConnectorInfo>,
    string,
    { value: any; preview: string }
  >('evalHTTP', panel.content, connector);
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
          type="url"
          autoWidth={true}
        />
      </div>
      <div className="form-row">
        <label>Headers</label>
        {panel.http.http.headers.map(
          (header: { value: string; name: string }, headerIndex: number) => (
            <div className="form-row">
              <Button
                icon
                onClick={() => {
                  panel.http.http.headers.splice(headerIndex, 1);
                  updatePanel(panel);
                }}
              >
                delete
              </Button>
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
        <ContentTypePicker
          inMemoryEval={MODE !== 'browser'}
          value={panel.http.http.contentTypeInfo}
          onChange={(type: ContentTypeInfo) => {
            panel.http.http.contentTypeInfo = type;
            updatePanel(panel);
          }}
        />
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
