import * as XLSX from 'xlsx';
import * as CSV from 'papaparse';

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

export type Parsers = { [type: string]: (a: ArrayBuffer) => Promise<any> };

export async function parseArrayBuffer(
  type: string,
  fileName: string,
  body: ArrayBuffer,
  additionalParsers?: Parsers
) {
  const bodyAsString = () => new TextDecoder('utf-8').decode(body);
  let realType = type.split(';')[0];
  if (realType === 'text/plain') {
    const fileBits = fileName.split('.');
    const fileExtension = fileBits[fileBits.length - 1];
    realType =
      {
        csv: 'text/csv',
        json: 'application/json',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }[fileExtension] || realType;
  }

  switch (realType) {
    case 'text/csv':
      return parseCSV(bodyAsString());
    case 'application/json':
      return JSON.parse(bodyAsString());
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
      return XLSX.read(body, { type: 'array' });
    }
  }

  if (additionalParsers && additionalParsers[type]) {
    return await additionalParsers[type](body);
  }

  console.error(`Unsupported file type: '${type}'`);
  return bodyAsString();
}
