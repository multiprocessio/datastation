import { preview } from 'preview';
import * as React from 'react';
import { shape } from 'shape';
import { MODE } from '../../shared/constants';
import { FilePanelInfo, PanelResult } from '../../shared/state';
import { parseArrayBuffer } from '../../shared/text';
import { panelRPC } from '../asyncRPC';
import { ContentTypePicker } from '../components/ContentTypePicker';
import { FileInput } from '../components/FileInput';
import { FormGroup } from '../components/FormGroup';
import { ServerPicker } from '../components/ServerPicker';
import { ProjectContext } from '../state';
import { PanelDetailsProps, PanelUIDetails } from './types';

export async function evalFilePanel(
  panel: FilePanelInfo
): Promise<PanelResult> {
  if (MODE === 'browser') {
    const { value, contentType } = await parseArrayBuffer(
      panel.file.contentTypeInfo,
      panel.file.name,
      panel.file.content
    );
    const s = shape(value);
    return {
      value,
      preview: preview(value),
      shape: s,
      stdout: '',
      arrayCount: s.kind === 'array' ? (value || []).length : null,
      size: panel.file.content.byteLength,
      contentType,
    };
  }

  return await panelRPC('eval', panel.id);
}

export function FilePanelDetails({
  panel,
  updatePanel,
}: PanelDetailsProps<FilePanelInfo>) {
  const { servers } = React.useContext(ProjectContext).state;
  return (
    <div className="FilePanel">
      <FormGroup>
        <div className="form-row">
          <FileInput
            label="File"
            value={panel.file.name}
            allowManualEntry={MODE !== 'browser'}
            allowFilePicker={!panel.serverId}
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
          inMemoryEval={MODE === 'browser'}
          value={panel.file.contentTypeInfo}
          onChange={(cti: { type: string; customLineRegexp: string }) => {
            panel.file.contentTypeInfo = cti;
            updatePanel(panel);
          }}
        />
      </FormGroup>
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

export const filePanel: PanelUIDetails<FilePanelInfo> = {
  icon: 'description',
  eval: evalFilePanel,
  id: 'file',
  label: 'File',
  details: FilePanelDetails,
  body: null,
  previewable: true,
  factory: (pageId: string) => new FilePanelInfo(pageId),
  hasStdout: false,
  info: null,
};
