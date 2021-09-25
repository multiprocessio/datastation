import { preview } from 'preview';
import * as React from 'react';
import { shape } from 'shape';
import { MODE } from '../../shared/constants';
import { FilePanelInfo, PanelResult } from '../../shared/state';
import { parseArrayBuffer } from '../../shared/text';
import { asyncRPC } from '../asyncRPC';
import { ContentTypePicker } from '../component-library/ContentTypePicker';
import { FileInput } from '../component-library/FileInput';
import { FormGroup } from '../component-library/FormGroup';
import { ServerPicker } from '../component-library/ServerPicker';
import { ProjectContext } from '../ProjectStore';

export async function evalFilePanel(
  panel: FilePanelInfo
): Promise<PanelResult> {
  if (MODE === 'browser') {
    const { value, contentType } = await parseArrayBuffer(
      panel.file.contentTypeInfo,
      panel.file.name,
      panel.file.content
    );
    return {
      value,
      preview: preview(value),
      shape: shape(value),
      stdout: '',
      size: panel.file.content.byteLength,
      contentType,
    };
  }

  return await asyncRPC<FilePanelInfo, void, PanelResult>(
    'evalFile',
    null,
    panel
  );
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
      <FormGroup label="General">
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
          inMemoryEval={MODE !== 'browser'}
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

export const filePanel: PanelUIDetails = {
  icon: 'description',
  eval: evalFilePanel,
  id: 'file',
  label: 'File',
  details: FilePanelDetails,
  body: null,
  alwaysOpen: false,
  previewable: true,
  factory: () => new FilePanelInfo(),
};
