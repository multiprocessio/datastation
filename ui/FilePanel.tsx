import * as React from 'react';

import { FilePanelInfo } from '../shared/state';
import { parseArrayBuffer } from '../shared/text';
import { MODE } from '../shared/constants';

import { asyncRPC } from './asyncRPC';
import { FileInput } from './component-library/FileInput';

export async function evalFilePanel(panel: FilePanelInfo) {
  if (MODE === 'browser') {
    return await parseArrayBuffer(panel.file.type, panel.file.content);
  }

  return await asyncRPC<{ name: string; type: string }, string, Array<object>>(
    'evalFile',
    panel.content,
    panel.file
  );
}

const SUPPORTED_FILE_TYPES: { [k: string]: string } = {
  csv: 'text/csv',
  json: 'application/json',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
if (MODE !== 'browser') {
  SUPPORTED_FILE_TYPES['parquet'] = 'parquet';
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
          accept={Object.keys(SUPPORTED_FILE_TYPES)
            .map((p: string) => `.${p}`)
            .join(',')}
          onChange={(files: Array<File>) => {
            const fr = new FileReader();

            if (MODE === 'browser') {
              fr.onload = function () {
                panel.file.content = fr.result as ArrayBuffer;
                updatePanel(panel);
              };

              fr.readAsArrayBuffer(files[0]);
            }

            panel.file.name = files[0].name;
            const fileSplit = panel.file.name.split('.');
            const fileType = fileSplit[fileSplit.length - 1];
            panel.file.type = SUPPORTED_FILE_TYPES[fileType];
            updatePanel(panel);
          }}
        />
      </div>
    </React.Fragment>
  );
}
