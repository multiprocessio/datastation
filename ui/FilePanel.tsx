import * as React from 'react';
import { MODE } from '../shared/constants';
import { previewObject } from '../shared/preview';
import {
  ContentTypeInfo,
  FilePanelInfo,
  Proxy,
  ServerInfo,
} from '../shared/state';
import { parseArrayBuffer } from '../shared/text';
import { asyncRPC } from './asyncRPC';
import { FileInput } from './component-library/FileInput';
import { ContentTypePicker } from './ContentTypePicker';
import { ProjectContext } from './ProjectStore';
import { ServerPicker } from './ServerPicker';

export async function evalFilePanel(
  panel: FilePanelInfo,
  _: any,
  servers: Array<ServerInfo>
) {
  if (MODE === 'browser') {
    const value = await parseArrayBuffer(
      panel.file.contentTypeInfo,
      panel.file.name,
      panel.file.content
    );
    return { value, preview: previewObject(value) };
  }

  return await asyncRPC<
    Proxy<{ name: string; contentTypeInfo: ContentTypeInfo }>,
    void,
    { value: any; preview: string }
  >('evalFile', null, {
    ...panel.file,
    server: servers.find((s) => s.id === panel.serverId),
  });
}

export function FilePanelDetails({
  panel,
  updatePanel,
}: {
  panel: FilePanelInfo;
  updatePanel: (d: FilePanelInfo) => void;
}) {
  const { servers } = React.useContext(ProjectContext);
  return (
    <div className="FilePanel">
      <div className="form-row">
        <FileInput
          label="File"
          value={panel.file.name}
          allowManualEntry={MODE !== 'browser' ? true : false}
          allowFilePicker={!panel.serverId ? true : false}
          onRead={
            MODE !== 'desktop'
              ? (value: ArrayBuffer) => {
                  panel.file.content = value;
                  updatePanel(panel);
                }
              : null
          }
          onChange={(fileName: string) => {
            panel.file.name = fileName;
            updatePanel(panel);
          }}
        />
      </div>
      <ContentTypePicker
        inMemoryEval={MODE !== 'browser'}
        value={panel.file.contentTypeInfo}
        onChange={(cti: { type: string; customLineRegexp: string }) => {
          panel.file.contentTypeInfo = cti;
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
  );
}
