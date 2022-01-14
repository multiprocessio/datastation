import { preview } from 'preview';
import * as React from 'react';
import { shape } from 'shape';
import { MODE, MODE_FEATURES } from '../../shared/constants';
import { request } from '../../shared/http';
import {
  ContentTypeInfo,
  HTTPConnectorInfoMethod,
  HTTPPanelInfo,
} from '../../shared/state';
import { panelRPC } from '../asyncRPC';
import { Button } from '../components/Button';
import { ContentTypePicker } from '../components/ContentTypePicker';
import { FormGroup } from '../components/FormGroup';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { ServerPicker } from '../components/ServerPicker';
import { ProjectContext } from '../ProjectStore';
import { PanelDetailsProps, PanelUIDetails } from './types';

export async function evalHTTPPanel(panel: HTTPPanelInfo) {
  if (MODE === 'browser') {
    const { value, contentType } = await request(
      (window as any).fetch,
      panel.http.http.method,
      panel.http.http.url,
      panel.http.http.contentTypeInfo,
      panel.http.http.headers,
      panel.content
    );
    const s = shape(value);
    return {
      value,
      size: JSON.stringify(value).length,
      arrayCount: s.kind === 'array' ? (value || []).length : null,
      contentType,
      preview: preview(value),
      shape: s,
      stdout: '',
    };
  }

  return await panelRPC('eval', panel.id);
}

export function HTTPPanelDetails({
  panel,
  updatePanel,
}: PanelDetailsProps<HTTPPanelInfo>) {
  const { servers } = React.useContext(ProjectContext).state;
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
            <div className="form-row form-row--collapse vertical-align-center">
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

export function HTTPInfo() {
  return (
    <React.Fragment>
      {MODE_FEATURES.corsOnly && (
        <React.Fragment>
          Since this runs in the browser, the server you are talking to must set
          CORS headers otherwise the request will not work.
          <br />
          <br />
        </React.Fragment>
      )}
      Use the textarea to supply a HTTP request body. This will be ignored for{' '}
      <code>GET</code> and <code>HEAD</code> requests.
    </React.Fragment>
  );
}

export const httpPanel: PanelUIDetails<HTTPPanelInfo> = {
  icon: 'http',
  eval: evalHTTPPanel,
  id: 'http',
  label: 'HTTP',
  details: HTTPPanelDetails,
  body: null,
  previewable: true,
  factory: () => new HTTPPanelInfo(),
  info: HTTPInfo,
  hasStdout: false,
};
