import { IconCheck, IconDownload } from '@tabler/icons';
import circularSafeStringify from 'json-stringify-safe';
import React from 'react';
import { MODE } from '../shared/constants';
import log from '../shared/log';
import {
  PanelInfo,
  PanelResult,
  TableColumn,
  TablePanelInfo,
} from '../shared/state';
import { panelRPC } from './asyncRPC';
import { Button } from './components/Button';
import { Dropdown } from './components/Dropdown';
import { allFields, wellFormedGraphInput } from './components/FieldPicker';

const unsafeCSVCharRe = /[\s,"]/g;

function formatValue(v: any, escape = true) {
  const t = typeof v;
  if (t === 'string') {
    if (escape && v.match(unsafeCSVCharRe)) {
      return `"${v.replaceAll('"', '\\"')}"`;
    }

    return v;
  }

  if (
    v === null ||
    v === undefined ||
    t === 'undefined' ||
    t === 'number' ||
    t === 'bigint' ||
    t === 'boolean'
  ) {
    return String(v);
  }

  const s = circularSafeStringify(v);
  if (escape && s.match(unsafeCSVCharRe)) {
    return `"${s.replaceAll('"', '\\"')}"`;
  }

  return s;
}

export function csvFormat(value: any, orderedKeys: TableColumn[]) {
  const data = Array(value.length + 1);
  const rowData = Array(orderedKeys.length);
  for (let i = 0; i < orderedKeys.length; i++) {
    rowData[i] = formatValue(orderedKeys[i].label);
  }
  data[0] = rowData.join(',');

  let j = 0;
  for (const row of value) {
    j++;
    for (let i = 0; i < orderedKeys.length; i++) {
      rowData[i] = formatValue(row[orderedKeys[i].field]);
    }

    data[j] = rowData.join(',');
  }

  return {
    text: data.join('\n'),
    mimeType: 'text/csv',
    extension: 'csv',
  };
}

function jsonFormat(value: any) {
  return {
    text: circularSafeStringify(value),
    mimeType: 'application/json',
    extension: 'json',
  };
}

export function htmlTableFormat(value: any, orderedKeys: TableColumn[]) {
  const html = ['<table class="table">'];
  html.push('  <thead>');
  html.push('    <tr>');

  for (const column of orderedKeys) {
    html.push(`      <th>${column.label}</th>`);
  }
  html.push('    </tr>');
  html.push('  </thead>');
  html.push('  <tbody>');

  for (const row of value) {
    html.push('    <tr>');

    for (const column of orderedKeys) {
      html.push(`      <td>${formatValue(row[column.field], false)}</td>`);
    }

    html.push('    </tr>');
  }

  html.push('  </tbody>');
  html.push('</table>');

  return {
    text: html.join('\n'),
    mimeType: 'text/html',
    extension: 'html',
  };
}

export function markdownTableFormat(value: any, orderedKeys: TableColumn[]) {
  const maxLengthByField: Record<string, number> = {};
  for (const column of orderedKeys) {
    maxLengthByField[column.field] = column.label.length;
  }

  const formattedRows = [];
  for (const row of value) {
    const formattedRow = [];
    for (const column of orderedKeys) {
      const formatted = formatValue(row[column.field], false);
      if (formatted.length > maxLengthByField[column.field]) {
        maxLengthByField[column.field] = formatted.length;
      }

      formattedRow.push(formatted);
    }
    formattedRows.push(formattedRow);
  }

  const markdown = [];

  const row = [];
  for (const column of orderedKeys) {
    const padding = maxLengthByField[column.field];
    let s = column.label;
    if (padding < 100) {
      s = s.padEnd(padding);
    }

    row.push(s);
  }
  markdown.push('| ' + row.join(' | ') + ' |');

  for (let i = 0; i < orderedKeys.length; i++) {
    const padding = maxLengthByField[orderedKeys[i].field];
    row[i] = '---';
    if (padding < 100) {
      row[i] = '-'.padEnd(padding, '-');
    }
  }

  markdown.push('| ' + row.join(' | ') + ' |');

  for (const formattedRow of formattedRows) {
    for (let i = 0; i < orderedKeys.length; i++) {
      const padding = maxLengthByField[orderedKeys[i].field];
      let s = formattedRow[i];
      if (padding < 100) {
        s = s.padEnd(padding);
      }

      row[i] = s.replaceAll('\n', '\\\n');
    }

    markdown.push('| ' + row.join(' | ') + ' |');
  }

  return {
    text: markdown.join('\n'),
    mimeType: 'text/html',
    extension: 'html',
  };
}

type DataFormat = 'JSON' | 'CSV' | 'HTML Table' | 'Markdown Table';

const dataFormatters: {
  [k in DataFormat]: (
    value: any,
    orderedKeys: TableColumn[]
  ) => { extension: string; mimeType: string; text: string };
} = {
  JSON: jsonFormat,
  CSV: csvFormat,
  'HTML Table': htmlTableFormat,
  'Markdown Table': markdownTableFormat,
};

// SOURCE: https://stackoverflow.com/a/18197341/1507139
function download(filename: string, dataUrl: string) {
  const element = document.createElement('a');
  element.setAttribute('href', dataUrl);
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

async function resultsTo(
  panel: PanelInfo,
  panelRef: React.RefObject<HTMLCanvasElement>,
  results: PanelResult,
  orderedKeys: TableColumn[],
  type: DataFormat,
  output: 'clipboard' | 'file'
) {
  let value: any = results.value;
  if (MODE !== 'browser') {
    const res = await panelRPC('fetchResults', panel.id);
    value = res.value;
  }

  const filename = panel.name;
  value =
    panel.type === 'graph' ? panelRef.current.querySelector('canvas') : value;
  const isChart = panel.type === 'graph';

  let [dataURL, mimeType, extension] = ['', '', ''];
  if (isChart) {
    if (!value) {
      log.error('Invalid context ref');
      return;
    }
    mimeType = 'image/png';
    dataURL = (value as HTMLCanvasElement).toDataURL(mimeType, 1.0);
    extension = '.png';
  } else {
    ({
      text: dataURL,
      mimeType,
      extension,
    } = dataFormatters[type](value, orderedKeys));

    if (output === 'file') {
      dataURL = `data:${mimeType};charset=utf-8,` + encodeURIComponent(dataURL);
    }
  }

  if (output === 'file') {
    return download(filename + extension, dataURL);
  }

  return navigator.clipboard.writeText(dataURL);
}

export function DownloadPanel({
  panel,
  panelRef,
}: {
  panel: PanelInfo;
  panelRef: React.RefObject<HTMLCanvasElement>;
}) {
  const results = panel.resultMeta || new PanelResult();
  const tableType = wellFormedGraphInput(results.shape);
  let orderedKeys: TableColumn[] = [];
  if (panel.type === 'table') {
    orderedKeys = (panel as TablePanelInfo).table.columns;
  } else if (tableType) {
    orderedKeys = allFields(results.shape)
      .map(([path]) => path)
      .sort()
      .map((p) => ({ field: p, label: p }));
  }

  const [success, setSuccess] = React.useState('');
  const successTimeout = React.useRef<ReturnType<typeof setTimeout>>();
  React.useEffect(() => {
    if (success) {
      clearTimeout(successTimeout.current);
      successTimeout.current = setTimeout(() => setSuccess(''), 10_000);
    }
  }, [success, setSuccess]);

  // TODO: handle downloading/copying image

  const groups = [
    {
      name: 'To file',
      id: 'file',
      items: [
        ...(tableType ? ['CSV', 'HTML Table', 'Markdown Table'] : []),
        'JSON',
      ].map((type: DataFormat) =>
        Dropdown.makeItem(type + 'file', () => (
          <div className="vertical-align-center">
            <Button
              onClick={async () => {
                await resultsTo(
                  panel,
                  panelRef,
                  results,
                  orderedKeys,
                  type,
                  'file'
                );
                setSuccess(type + 'file');
              }}
            >
              {type}
            </Button>
            {success === type + 'file' ? <IconCheck className="text-success" /> : null}
          </div>
        ))
      ),
    },
    {
      name: 'To clipboard',
      id: 'file',
      items: [
        ...(tableType ? ['CSV', 'HTML Table', 'Markdown Table'] : []),
        'JSON',
      ].map((type: DataFormat) =>
        Dropdown.makeItem(type + 'clipboard', () => (
          <div className="vertical-align-center">
            <Button
              onClick={async () => {
                await resultsTo(
                  panel,
                  panelRef,
                  results,
                  orderedKeys,
                  type,
                  'clipboard'
                );
                setSuccess(type + 'clipboard');
              }}
            >
              {type}
            </Button>
            {success === type + 'clipboard' ? <IconCheck className="text-success" /> : null}
          </div>
        ))
      ),
    },
  ];

  return (
    <Dropdown
      className="download-panel"
      trigger={(open) => (
        <Button
          icon
          disabled={!results.lastRun}
          onClick={(e) => {
            e.preventDefault();
            open();
          }}
        >
          <IconDownload />
        </Button>
      )}
      groups={groups}
    />
  );
}
