import * as React from 'react';

import { FilePanelInfo } from '../shared/state';
import { parseArrayBuffer } from '../shared/text';
import { FileInput } from './component-library/FileInput';

export async function evalFilePanel(panel: FilePanelInfo) {
  const fileSplit = panel.file.name.split('.');
  const fileType = fileSplit[fileSplit.length - 1];
  const type = {
    csv: 'text/csv',
    json: 'application/json',
    parquet: 'parquet',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }[fileType];

  return await parseArrayBuffer(type, panel.file.content);
}

export function FilePanelDetails({
  panel,
  updatePanel,
}: {
  panel: FilePanelInfo;
  updatePanel: (d: FilePanelInfo) => void;
}) {
  return (
    <React.Fragment>
      <div>
        <FileInput
          label="File"
          onChange={(files: Array<File>) => {
            const fr = new FileReader();
            fr.onload = function () {
              panel.file.content = fr.result as ArrayBuffer;
              updatePanel(panel);
            };
            fr.readAsArrayBuffer(files[0]);
          }}
        />
      </div>
    </React.Fragment>
  );
}
