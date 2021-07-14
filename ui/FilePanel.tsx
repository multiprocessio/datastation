import * as React from 'react';

import { Proxy, ServerInfo, FilePanelInfo } from '../shared/state';
import { parseArrayBuffer } from '../shared/text';
import { MODE } from '../shared/constants';

import { ProjectContext } from './ProjectStore';
import { asyncRPC } from './asyncRPC';
import { ServerPicker } from './ServerPicker';
import { FileInput } from './component-library/FileInput';
import { Input } from './component-library/Input';

export async function evalFilePanel(
  panel: FilePanelInfo,
  _: any,
  servers: Array<ServerInfo>
) {
  if (MODE === 'browser') {
    return await parseArrayBuffer(
      'text/plain',
      panel.file.name,
      panel.file.content
    );
  }

  return await asyncRPC<Proxy<{ name: string }>, string, Array<object>>(
    'evalFile',
    panel.content,
    { ...panel.file, server: servers.find((s) => s.id === panel.serverId) }
  );
}

// This is kind of duplicated
const SUPPORTED_FILE_TYPES = ['csv', 'json', 'xlsx'];
if (MODE !== 'browser') {
  SUPPORTED_FILE_TYPES.push('parquet');
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
          accept={SUPPORTED_FILE_TYPES.map((p: string) => `.${p}`).join(',')}
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
