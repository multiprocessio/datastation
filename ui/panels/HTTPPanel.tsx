import { IconTrash } from '@tabler/icons';
import { preview } from 'preview';
import * as React from 'react';
import { shape } from 'shape';
import { MODE, MODE_FEATURES } from '../../shared/constants';
import { request } from '../../shared/http';
import { newId } from '../../shared/object';
import {
  ContentTypeInfo,
  HTTPConnectorInfoMethod,
  HTTPPanelInfo,
} from '../../shared/state';
import { panelRPC } from '../asyncRPC';
import { Button } from '../components/Button';
import { CodeEditor } from '../components/CodeEditor';
import { ContentTypePicker } from '../components/ContentTypePicker';
import { FormGroup } from '../components/FormGroup';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { ServerPicker } from '../components/ServerPicker';
import { ProjectContext } from '../state';
import { PanelBodyProps, PanelDetailsProps, PanelUIDetails } from './types';

export async function evalHTTPPanel(panel: HTTPPanelInfo) {
  if (MODE === 'browser') {
    const lastRun = new Date();
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
      loading: false,
      lastRun,
      elapsed: new Date().valueOf() - lastRun.valueOf(),
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
      <FormGroup>
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
          label="Response Content Type"
          inMemoryEval={MODE === 'browser'}
          value={panel.http.http.contentTypeInfo}
          onChange={(type: ContentTypeInfo) => {
            panel.http.http.contentTypeInfo = type;
            updatePanel(panel);
          }}
        />
      </FormGroup>

      <FormGroup>
        {panel.http.http.headers.map(
          (
            header: { value: string; name: string; id: string },
            headerIndex: number
          ) => (
            <div
              key={header.id}
              className="form-row form-row--multi vertical-align-center"
            >
              <Input
                label="Header"
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
                icon
                onClick={() => {
                  panel.http.http.headers.splice(headerIndex, 1);
                  updatePanel(panel);
                }}
                type="outline"
              >
                <IconTrash />
              </Button>
            </div>
          )
        )}
        <Button
          onClick={() => {
            panel.http.http.headers.push({ name: '', value: '', id: newId() });
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
      Use the textarea to supply a HTTP request body.
    </React.Fragment>
  );
}

export function HTTPPanelBody({
  updatePanel,
  panel,
  keyboardShortcuts,
}: PanelBodyProps<HTTPPanelInfo>) {
  return (
    <CodeEditor
      id={'editor-' + panel.id}
      onKeyDown={keyboardShortcuts}
      value={panel.content}
      onChange={(value: string) => {
        panel.content = value;
        updatePanel(panel);
      }}
      language="javascript"
      className="editor"
    />
  );
}

export const httpPanel: PanelUIDetails<HTTPPanelInfo> = {
  icon: 'http',
  eval: evalHTTPPanel,
  id: 'http',
  label: 'HTTP',
  details: HTTPPanelDetails,
  hideBody: (panel: HTTPPanelInfo) =>
    !['PUT', 'POST', 'PATCH'].includes(panel.http.http.method.toUpperCase()),
  body: HTTPPanelBody,
  previewable: true,
  factory: (pageId: string, name: string) => {
    const p = new HTTPPanelInfo(pageId);
    p.name = name;
    return p;
  },
  info: HTTPInfo,
  hasStdout: false,
};
