import { preview } from 'preview';
import * as React from 'react';
import { shape } from 'shape';
import { MODE } from '../shared/constants';
import { request } from '../shared/http';
import {
  ContentTypeInfo,
  HTTPConnectorInfo,
  HTTPConnectorInfoMethod,
  HTTPPanelInfo,
  PanelResult,
  Proxy,
  ServerInfo,
} from '../shared/state';
import { asyncRPC } from './asyncRPC';
import { Button } from './component-library/Button';
import { FormGroup } from './component-library/FormGroup';
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
    const { value, contentType } = await request(
      (window as any).fetch,
      panel.http.http.method,
      panel.http.http.url,
      panel.http.http.contentTypeInfo,
      panel.http.http.headers,
      panel.content
    );
    return {
      value,
      size: JSON.stringify(value).length,
      contentType,
      preview: preview(value),
      shape: shape(value),
      stdout: '',
    };
  }

  const connector = panel.http;
  return await asyncRPC<
    Proxy<HTTPPanelInfo, HTTPConnectorInfo>,
    string,
    PanelResult
  >('evalHTTP', panel.content, {
    ...panel,
    connector,
    server: servers.find(
      (s) => s.id === (panel.serverId || connector.serverId)
    ),
  });
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
      <FormGroup label="General">
        <div className="form-row">
          <Select
            label="Method"
            value={panel.http.http.method}
            onChange={(value: string) => {
              panel.http.http.method = value as HTTPConnectorInfoMethod;
              updatePanel(panel);
            }}
          >
            <option value="GET">Get</option>
            <option value="PUT">Put</option>
            <option value="POST">Post</option>
            <option value="DELETE">Delete</option>
            <option value="HEAD">Head</option>
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
        <ContentTypePicker
          inMemoryEval={MODE !== 'browser'}
          value={panel.http.http.contentTypeInfo}
          onChange={(type: ContentTypeInfo) => {
            panel.http.http.contentTypeInfo = type;
            updatePanel(panel);
          }}
        />
      </FormGroup>

      <FormGroup label="Headers">
        {panel.http.http.headers.map(
          (header: { value: string; name: string }, headerIndex: number) => (
            <div className="form-row vertical-align-center">
              <Button
                icon
                onClick={() => {
                  panel.http.http.headers.splice(headerIndex, 1);
                  updatePanel(panel);
                }}
                type="outline"
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
      </FormGroup>

      <ServerPicker
        servers={servers}
        serverId={panel.serverId}
        onChange={(serverId: string) => {
          panel.serverId = serverId;
          updatePanel(panel);
        }}
      />
    </React.Fragment>
  );
}
