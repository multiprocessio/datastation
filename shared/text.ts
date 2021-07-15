import * as XLSX from 'xlsx';
import * as CSV from 'papaparse';

import log from './log';

export function parseCSV(csvString: string) {
  const csvWhole = CSV.parse(csvString);
  const csv = csvWhole.data;
  const data: Array<{ [k: string]: any }> = [];
  csv.forEach((row: Array<string>, i: number) => {
    // First row is header
    if (i === 0) {
      return;
    }

    function cleanCell(cell: string): string {
      if (!cell) {
        return '';
      }

      cell = cell.trim();
      if (cell[0] === '"') {
        cell = cell.substring(1, cell.length - 1);
      }
      return cell;
    }

    const rowData: { [k: string]: any } = {};
    (csv[0] as Array<string>).forEach(
      (headerName: string, position: number) => {
        rowData[cleanCell(headerName)] = cleanCell(row[position]);
      }
    );
    data.push(rowData);
  });

  return data;
}

// SOURCE: https://github.com/SheetJS/sheetjs/issues/1529#issuecomment-544705184
function trimExcelHeaders(ws: XLSX.WorkSheet) {
  if (!ws || !ws['!ref']) return;
  const ref = XLSX.utils.decode_range(ws['!ref']);
  for (let C = ref.s.c; C <= ref.e.c; ++C) {
    const cell = ws[XLSX.utils.encode_cell({ r: ref.s.r, c: C })];
    if (cell.t === 's') {
      cell.v = cell.v.trim();
      if (cell.w) {
        cell.w = cell.w.trim();
      }
    }
  }
}

export type Parsers = { [type: string]: (a: ArrayBuffer) => Promise<any> };

export async function parseArrayBuffer(
  type: string,
  fileName: string,
  body: ArrayBuffer,
  additionalParsers?: Parsers
) {
  // I'm not sure body is actually always an arraybuffer.
  if (!body || (body as any).length === 0 || body.byteLength === 0) {
    return null;
  }

  const bodyAsString = () => new TextDecoder('utf-8').decode(body);
  let realType = type.split(';')[0];
  if (realType === '') {
    const fileBits = fileName.split('.');
    const fileExtension = fileBits[fileBits.length - 1];
    const builtinTypes: Record<string, string> = {
      csv: 'text/csv',
      json: 'application/json',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    if (builtinTypes[fileExtension]) {
      realType = builtinTypes[fileExtension];
    }

    if (additionalParsers[fileExtension]) {
      realType = fileExtension;
    }
  }

  if (additionalParsers && additionalParsers[realType]) {
    return await additionalParsers[realType](body);
  }

  switch (realType) {
    case 'text/csv':
      return parseCSV(bodyAsString());
    case 'application/json':
      return JSON.parse(bodyAsString());
    case 'application/vnd.ms-excel':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
      const file = XLSX.read(body, { type: 'array' });
      const sheets: Record<string, any> = {};

      file.SheetNames.forEach((name: string) => {
        trimExcelHeaders(file.Sheets[name]);
        sheets[name] = XLSX.utils.sheet_to_json(file.Sheets[name]);
      });

      // Make flat when there's only one sheet
      if (file.SheetNames.length === 1) {
        return sheets[file.SheetNames[0]];
      }

      return sheets;
    }
  }

  log.info(`Unsupported file type: '${realType}'`);
  return bodyAsString();
}
