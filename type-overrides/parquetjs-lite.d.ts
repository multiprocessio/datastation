declare module 'parquetjs-lite' {
  export class ParquetCursor {
    next(): Promise<object>;
  }

  export class ParquetReader {
    getCursor(): ParquetCursor;
    static openBuffer(a: ArrayBuffer): ParquetReader;
  }
}
