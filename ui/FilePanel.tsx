import * as React from 'react';

import { FilePanelInfo } from '../shared/state';
import { parseArrayBuffer } from '../shared/text';
import { MODE } from '../shared/constants';

import { asyncRPC } from './asyncRPC';
import { FileInput } from './component-library/FileInput';

export async function evalFilePanel(panel: FilePanelInfo) {
  if (MODE === 'browser') {
    return await parseArrayBuffer(
      'text/plain',
      panel.file.name,
      panel.file.content
    );
  }

  return await asyncRPC<{ name: string }, string, Array<object>>(
    'evalFile',
    panel.content,
    panel.file
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
  return (
    <React.Fragment>
      <div>
        <FileInput
          label="File"
          accept={SUPPORTED_FILE_TYPES.map((p: string) => `.${p}`).join(',')}
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
            updatePanel(panel);
          }}
        />
      </div>
    </React.Fragment>
  );
}
