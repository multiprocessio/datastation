import * as XLSX from 'xlsx';
import * as parquet from 'parquetjs-lite';
import * as CSV from 'papaparse';

export function parseCSV(csvString: string) {
  const csv = CSV.parse(csvString).data;
  const data: Array<{ [k: string]: any }> = [];
  csv.forEach((row: Array<string>, i: number) => {
    // First row is header
    if (i === 0) {
      return;
    }

    const rowData: { [k: string]: any } = {};
    (csv[0] as Array<string>).forEach(
      (headerName: string, position: number) => {
        rowData[headerName] = row[position];
      }
    );
    data.push(rowData);
  });

  return data;
}

async function parseParquet(body: ArrayBuffer) {
  const rows: Array<{ [k: string]: any }> = [];
  const reader = await parquet.ParquetReader.openBuffer(body);
  const cursor = reader.getCursor();
  let record;
  while ((record = await cursor.next())) {
    rows.push(record);
  }
  return rows;
}

export async function parseArrayBuffer(type: string, body: ArrayBuffer) {
  const bodyAsString = () => new TextDecoder('utf-8').decode(body);
  switch (type.split(';')[0]) {
    case 'text/csv':
      return parseCSV(bodyAsString());
    case 'application/json':
      return JSON.parse(bodyAsString());
    case 'parquet':
      return await parseParquet(body);
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
      const wb = XLSX.read(body, { type: 'array' });
      return XLSX.utils.sheet_to_json(wb);
    }
  }

  throw new Error(`Unknown HTTP type: '${type}'`);
}
