import { preview } from 'preview';
import * as React from 'react';
import { shape } from 'shape';
import { MODE, MODE_FEATURES } from '../../shared/constants';
import { request } from '../../shared/http';
import {
  ContentTypeInfo,
  HTTPConnectorInfoMethod,
  HTTPPanelInfo,
  PanelResult,
} from '../../shared/state';
import { asyncRPC } from '../asyncRPC';
import { Button } from '../component-library/Button';
import { ContentTypePicker } from '../component-library/ContentTypePicker';
import { FormGroup } from '../component-library/FormGroup';
import { Input } from '../component-library/Input';
import { Select } from '../component-library/Select';
import { ServerPicker } from '../component-library/ServerPicker';
import { ProjectContext } from '../ProjectStore';
import { guardPanel, PanelDetailsProps, PanelUIDetails } from './types';

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
  return await asyncRPC<HTTPPanelInfo, string, PanelResult>(
    'evalHTTP',
    panel.content,
    {
      ...panel,
      serverId: panel.serverId || connector.serverId,
    }
  );
}

export function HTTPPanelDetails({ panel, updatePanel }: PanelDetailsProps) {
  const hp = guardPanel<HTTPPanelInfo>(panel, 'http');

  const { servers } = React.useContext(ProjectContext);
  return (
    <React.Fragment>
      <FormGroup label="General">
        <div className="form-row">
          <Select
            label="Method"
            value={hp.http.http.method}
            onChange={(value: string) => {
              hp.http.http.method = value as HTTPConnectorInfoMethod;
              updatePanel(hp);
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
            value={hp.http.http.url}
            onChange={(value: string) => {
              hp.http.http.url = value;
              updatePanel(hp);
            }}
            type="url"
            autoWidth={true}
          />
        </div>
        <ContentTypePicker
          inMemoryEval={MODE !== 'browser'}
          value={hp.http.http.contentTypeInfo}
          onChange={(type: ContentTypeInfo) => {
            hp.http.http.contentTypeInfo = type;
            updatePanel(hp);
          }}
        />
      </FormGroup>

      <FormGroup label="Headers">
        {hp.http.http.headers.map(
          (header: { value: string; name: string }, headerIndex: number) => (
            <div className="form-row vertical-align-center">
              <Button
                icon
                onClick={() => {
                  hp.http.http.headers.splice(headerIndex, 1);
                  updatePanel(hp);
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
                  updatePanel(hp);
                }}
              />
              <Input
                label="Value"
                value={header.value}
                onChange={(value: string) => {
                  header.value = value;
                  updatePanel(hp);
                }}
              />
            </div>
          )
        )}
        <Button
          onClick={() => {
            hp.http.http.headers.push({ name: '', value: '' });
            updatePanel(hp);
          }}
        >
          Add Header
        </Button>
      </FormGroup>

      <ServerPicker
        servers={servers}
        serverId={hp.serverId}
        onChange={(serverId: string) => {
          hp.serverId = serverId;
          updatePanel(hp);
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

export const httpPanel: PanelUIDetails = {
  icon: 'http',
  eval: evalHTTPPanel,
  id: 'http',
  label: 'HTTP',
  details: HTTPPanelDetails,
  body: null,
  alwaysOpen: true,
  previewable: true,
  factory: () => new HTTPPanelInfo(),
  info: HTTPInfo,
  hasStdout: false,
};
