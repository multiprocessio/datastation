import * as CSV from 'papaparse';
import * as XLSX from 'xlsx';
import log from './log';

export type Parsers = {
  [type: string]: (a: ArrayBuffer | string) => Promise<any>;
};

export interface ContentTypeInfoPlusParsers {
  additionalParsers?: Parsers;
  type: string;
  customLineRegexp?: string;
}

const APACHE2_ACCESS_RE =
  /^(?<host>[^ ]*) [^ ]* (?<user>[^ ]*) \[(?<time>[^\]]*)\] "(?<method>\S+)(?: +(?<path>(?:[^\"]|\.)*?)(?: +\S*)?)?" (?<code>[^ ]*) (?<size>[^ ]*)(?: "(?<referer>(?:[^\"]|\.)*)" "(?<agent>(?:[^\"]|\.)*)")?$/;
const APACHE2_ERROR_RE =
  /^\[[^ ]* (?<time>[^\]]*)\] \[(?<level>[^\]]*)\](?: \[pid (?<pid>[^:\]]*)(:[^\]]+)*\])? \[client (?<client>[^\]]*)\] (?<message>.*)$/;
const NGINX_ACCESS_RE =
  /^(?<remote>[^ ]*) (?<host>[^ ]*) (?<user>[^ ]*) \[(?<time>[^\]]*)\] "(?<method>\S+)(?: +(?<path>[^\"]*?)(?: +\S*)?)?" (?<code>[^ ]*) (?<size>[^ ]*)(?: "(?<referer>[^\"]*)" "(?<agent>[^\"]*)"(?:\s+(?<http_x_forwarded_for>[^ ]+))?)?$/;

export function parseWithRegex(body: string, re: RegExp) {
  return body
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => re.exec(line)?.groups);
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

export function getMimeType(
  { type, additionalParsers }: ContentTypeInfoPlusParsers,
  fileName: string
): string {
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

  return realType;
}

export async function parseArrayBuffer(
  { type, additionalParsers, customLineRegexp }: ContentTypeInfoPlusParsers,
  fileName: string,
  body: ArrayBuffer | string
): Promise<{ value: any; contentType: string }> {
  if (
    !body ||
    (typeof body === 'string' && body.length === 0) ||
    (body instanceof ArrayBuffer && body.byteLength === 0)
  ) {
    return { value: null, contentType: 'unknown' };
  }

  const bodyAsString = () => {
    if (typeof body === 'string') {
      return body;
    }

    return new TextDecoder('utf-8').decode(body);
  };

  const realType = getMimeType({ type, additionalParsers }, fileName);

  log.info(
    `Assumed '${realType}' from '${type}' given '${fileName}' when parsing array buffer`
  );

  if (additionalParsers && additionalParsers[realType]) {
    const value = await additionalParsers[realType](body);
    return { value, contentType: realType };
  }

  switch (realType) {
    case 'text/regexplines':
      return {
        value: parseWithRegex(bodyAsString(), new RegExp(customLineRegexp)),
        contentType: realType,
      };
    case 'text/apache2error':
      return {
        value: parseWithRegex(bodyAsString(), APACHE2_ERROR_RE),
        contentType: realType,
      };
    case 'text/apache2access':
      return {
        value: parseWithRegex(bodyAsString(), APACHE2_ACCESS_RE),
        contentType: realType,
      };
    case 'text/nginxaccess':
      return {
        value: parseWithRegex(bodyAsString(), NGINX_ACCESS_RE),
        contentType: realType,
      };
    case 'text/csv':
      return { value: parseCSV(bodyAsString()), contentType: realType };
    case 'application/json':
      return { value: JSON.parse(bodyAsString()), contentType: realType };
    case 'application/jsonlines': {
      const value = bodyAsString()
        .split(/\r?\n/)
        .filter(Boolean)
        .map((l) => {
          try {
            return JSON.parse(l);
          } catch (e) {
            log.error(e, l);
          }
        });
      return { value, contentType: realType };
    }
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
        return { value: sheets[file.SheetNames[0]], contentType: realType };
      }

      return { value: sheets, contentType: realType };
    }
  }

  return { value: bodyAsString(), contentType: realType };
}

export function humanSize(n: number) {
  if (n < 1000) {
    return `${n}B`;
  }

  const kb = n / 1000;
  if (kb < 1000) {
    return `${kb.toFixed(2)}KB`;
  }

  const mb = kb / 1000;
  if (mb < 1000) {
    return `${mb.toFixed(2)}MB`;
  }

  const gb = mb / 1000;
  if (gb < 1000) {
    return `${gb.toFixed(2)}GB`;
  }

  const tb = gb / 1000;
  return `${tb.toFixed(2)}TB`;
}

export function title(s: string) {
  return s
    .split(/[_\-\ ]+/g)
    .map((match) => {
      const first = match.charAt(0).toUpperCase();
      const rest = match.slice(1).toLowerCase();
      return first + rest;
    })
    .join(' ');
}
