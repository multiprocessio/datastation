import * as CSV from 'papaparse';
import * as XLSX from 'xlsx';
import log from './log';

export type Parsers = { [type: string]: (a: ArrayBuffer) => Promise<any> };

export interface ContentTypeInfoPlusParsers {
  additionalParsers?: Parsers;
  type: string;
  customLineRegexp?: string;
}

const APACHE2_ACCESS_RE =
  /^(?<host>[^ ]*) [^ ]* (?<user>[^ ]*) \[(?<time>[^\]]*)\] "(?<method>\S+)(?: +(?<path>(?:[^\"]|\\.)*?)(?: +\S*)?)?" (?<code>[^ ]*) (?<size>[^ ]*)(?: "(?<referer>(?:[^\"]|\\.)*)" "(?<agent>(?:[^\"]|\\.)*)")?$/;
const APACHE2_ERROR_RE =
  /^\[[^ ]* (?<time>[^\]]*)\] \[(?<level>[^\]]*)\](?: \[pid (?<pid>[^\]]*)\])? \[client (?<client>[^\]]*)\] (?<message>.*)$/;
const NGINX_ACCESS_RE =
  /^(?<remote>[^ ]*) (?<host>[^ ]*) (?<user>[^ ]*) \[(?<time>[^\]]*)\] "(?<method>\S+)(?: +(?<path>[^\"]*?)(?: +\S*)?)?" (?<code>[^ ]*) (?<size>[^ ]*)(?: "(?<referer>[^\"]*)" "(?<agent>[^\"]*)"(?:\s+(?<http_x_forwarded_for>[^ ]+))?)?$/;
const SYSLOG_RFC3164_RE =
  /^\<(?<pri>[0-9]+)\>(?<time>[^ ]* {1,2}[^ ]* [^ ]*) (?<host>[^ ]*) (?<ident>[^ :\[]*)(?:\[(?<pid>[0-9]+)\])?(?:[^\:]*\:)? *(?<message>.*)$/;
const SYSLOG_RFC5424_RE =
  /\A\<(?<pri>[0-9]{1,3})\>[1-9]\d{0,2} (?<time>[^ ]+) (?<host>[!-~]{1,255}) (?<ident>[!-~]{1,48}) (?<pid>[!-~]{1,128}) (?<msgid>[!-~]{1,32}) (?<extradata>(?:\-|(?:\[.*?(?<!\\)\])+))(?: (?<message>.+))?\z/;

export function parseWithRegex(body: string, re: RegExp) {
  return body
    .split('\n')
    .filter(Boolean)
    .map((line) => re.exec(line).groups);
}

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

export const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function parseArrayBuffer(
  { type, additionalParsers, customLineRegexp }: ContentTypeInfoPlusParsers,
  fileName: string,
  body: ArrayBuffer
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
      xls: XLSX_MIME_TYPE,
      xlsx: XLSX_MIME_TYPE,
    };
    if (builtinTypes[fileExtension]) {
      realType = builtinTypes[fileExtension];
    }

    if (additionalParsers && additionalParsers[fileExtension]) {
      realType = fileExtension;
    }
  }

  log.info(
    `Assumed '${realType}' from '${type}' given '${fileName}' when parsing array buffer`
  );

  if (additionalParsers && additionalParsers[realType]) {
    return await additionalParsers[realType](body);
  }

  switch (realType) {
    case 'text/regexplines':
      return parseWithRegex(bodyAsString(), new RegExp(customLineRegexp));
    case 'text/syslogrfc3164':
      return parseWithRegex(bodyAsString(), SYSLOG_RFC3164_RE);
    case 'text/syslogrfc5424':
      return parseWithRegex(bodyAsString(), SYSLOG_RFC5424_RE);
    case 'text/apache2error':
      return parseWithRegex(bodyAsString(), APACHE2_ERROR_RE);
    case 'text/apache2access':
      return parseWithRegex(bodyAsString(), APACHE2_ACCESS_RE);
    case 'text/nginxaccess':
      return parseWithRegex(bodyAsString(), NGINX_ACCESS_RE);
    case 'text/csv':
      return parseCSV(bodyAsString());
    case 'application/json':
      return JSON.parse(bodyAsString());
    case 'application/jsonlines':
      return bodyAsString()
        .split('\n')
        .filter(Boolean)
        .map((l) => {
          try {
            return JSON.parse(l);
          } catch (e) {
            log.error(e, l);
          }
        });
    case 'application/vnd.ms-excel':
    case XLSX_MIME_TYPE: {
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

  return bodyAsString();
}

export function columnsFromData(value: any, columns: Array<string>) {
  if (value && !Array.isArray(value)) {
    throw new Error(
      `Expected array input to graph, got (${typeof value}): ` + preview(value)
    );
  }
  return (valueWithRequestedColumns = (value || []).map((row: any) => {
    // If none specified, select all
    if (!columns.length) {
      return row;
    }

    if (!row) {
      return null;
    }

    const cells: Record<string, any> = [];
    (columns || []).forEach((name) => {
      cells[name] = row[name];
    });
    return cells;
  }));
}
