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
import { guardPanel, PanelUIDetails } from './types';

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

export function FilePanelDetails({ panel, updatePanel }: PanelDetailProps) {
  const fp = guardPanel<FilePanelInfo>(panel, 'file');
  const { servers } = React.useContext(ProjectContext);
  return (
    <div className="FilePanel">
      <FormGroup label="General">
        <div className="form-row">
          <FileInput
            label="File"
            value={fp.file.name}
            allowManualEntry={MODE !== 'browser'}
            allowFilePicker={!fp.serverId}
            onRead={
              MODE !== 'desktop'
                ? (value: ArrayBuffer) => {
                    fp.file.content = value;
                    updatePanel(fp);
                  }
                : null
            }
            onChange={(fileName: string) => {
              fp.file.name = fileName;
              updatePanel(fp);
            }}
          />
        </div>
        <ContentTypePicker
          inMemoryEval={MODE !== 'browser'}
          value={fp.file.contentTypeInfo}
          onChange={(cti: { type: string; customLineRegexp: string }) => {
            fp.file.contentTypeInfo = cti;
            updatePanel(fp);
          }}
        />
      </FormGroup>
      <ServerPicker
        servers={servers}
        serverId={fp.serverId}
        onChange={(serverId: string) => {
          fp.serverId = serverId;
          updatePanel(fp);
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
  hasStdout: false,
  info: null,
  killable: true,
};
