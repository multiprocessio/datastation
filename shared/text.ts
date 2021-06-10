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
