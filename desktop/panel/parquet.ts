import * as parquet from '@dsnp/parquetjs';

export const additionalParsers = {
  parquet: parseParquet,
};

export async function parseParquet(body: ArrayBuffer) {
  const rows: Array<{ [k: string]: any }> = [];
  const reader = await parquet.ParquetReader.openBuffer(body);
  const cursor = reader.getCursor();
  let record;
  while ((record = await cursor.next())) {
    rows.push(record);
  }
  return rows;
}
