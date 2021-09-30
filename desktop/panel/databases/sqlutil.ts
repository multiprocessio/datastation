import {
  ArrayShape,
  ObjectShape,
  ScalarShape,
  Shape,
  VariedShape,
} from 'shape';
import { chunk } from '../../../shared/array';
import {
  NotAnArrayOfObjectsError,
  UnsupportedError,
} from '../../../shared/errors';
import log from '../../../shared/log';
import { quote, QuoteType } from '../../../shared/sql';
import { Dispatch } from '../../rpc';
import { getPanelResult } from '../shared';

const JSON_SQL_TYPE_MAP: Record<ScalarShape['name'], string> = {
  number: 'REAL',
  string: 'TEXT',
  boolean: 'BOOLEAN',
  bigint: 'BIGINT',
  null: 'TEXT',
};

function sqlColumnsAndTypesFromShape(rowShape: ObjectShape) {
  return Object.keys(rowShape.children).map((key) => {
    const childShape = rowShape.children[key];
    let columnType: null | string = null;

    // Look for simple type: X
    if (childShape.kind === 'scalar') {
      columnType = JSON_SQL_TYPE_MAP[childShape.name];
    }

    // Look for type: null | X
    if (childShape.kind == 'varied') {
      const vs = childShape as VariedShape;
      if (
        vs.children.length === 2 &&
        vs.children.every((c) => c.kind === 'scalar') &&
        vs.children.filter((c) => (c as ScalarShape).name === 'null').length
      ) {
        const nonNullChild = (vs.children as Array<ScalarShape>).filter(
          (c) => c.name !== 'null'
        )[0];
        columnType = JSON_SQL_TYPE_MAP[nonNullChild.name];
      }
    }

    // Otherwise just fall back to being TEXT
    return { name: key, type: columnType || 'TEXT' };
  });
}

export interface PanelToImport {
  id: string;
  columns: Array<{ name: string; type: string }>;
  tableName: string;
}

export function transformDM_getPanelCalls(
  query: string,
  indexShapeMap: Array<Shape>,
  indexIdMap: Array<string>,
  getPanelCallsAllowed: boolean
): { panelsToImport: Array<PanelToImport>; query: string } {
  const panelsToImport: Array<PanelToImport> = [];
  query = query.replace(
    /DM_getPanel\(([0-9]+)\)/g,
    function (_: string, panelSource: string) {
      const s = indexShapeMap[+panelSource];
      if (!s || s.kind !== 'array') {
        throw new NotAnArrayOfObjectsError(+panelSource);
      }

      const rowShape = (s as ArrayShape).children as ObjectShape;
      if (rowShape.kind !== 'object') {
        throw new NotAnArrayOfObjectsError(+panelSource);
      }

      const id = indexIdMap[+panelSource];
      if (panelsToImport.filter((p) => id === p.id).length) {
        // Don't import the same panel twice.
        return;
      }

      const tableName = `t${panelSource}`;
      const columns = sqlColumnsAndTypesFromShape(rowShape);
      panelsToImport.push({
        id,
        columns,
        tableName,
      });
      return tableName;
    }
  );

  if (panelsToImport.length && !getPanelCallsAllowed) {
    throw new UnsupportedError(
      'DM_getPanel() is not yet supported by this connector.'
    );
  }

  return { panelsToImport, query };
}

export function formatImportQueryAndRows(
  tableName: string,
  columns: Array<{ name: string }>,
  data: Array<any>,
  quoteType: QuoteType
): [string, Array<any>] {
  const columnsDDL = columns
    .map((c) => quote(c.name, quoteType.identifier))
    .join(', ');
  const values = data
    .map((row) => '(' + columns.map((c) => '?').join(', ') + ')')
    .join(', ');
  const query = `INSERT INTO ${quote(
    tableName,
    quoteType.identifier
  )} (${columnsDDL}) VALUES ${values};`;
  const rows = data.map((row) => columns.map((c) => row[c.name])).flat();
  return [query, rows];
}

export async function importAndRun(
  dispatch: Dispatch,
  db: {
    createTable: (stmt: string) => Promise<unknown>;
    insert: (stmt: string, values: any[]) => Promise<unknown>;
    query: (stmt: string) => Promise<any>;
  },
  projectId: string,
  query: string,
  panelsToImport: Array<PanelToImport>,
  quoteType: QuoteType,
  // Postgres uses $1, mysql/sqlite use ?
  mangleInsert?: (stmt: string) => string
) {
  let rowsIngested = 0;
  for (const panel of panelsToImport) {
    const ddlColumns = panel.columns
      .map((c) => `${quote(c.name, quoteType.identifier)} ${c.type}`)
      .join(', ');
    log.info('Creating temp table ' + panel.tableName);
    await db.createTable(
      `CREATE TEMPORARY TABLE ${quote(
        panel.tableName,
        quoteType.identifier
      )} (${ddlColumns});`
    );

    const res = await getPanelResult(dispatch, projectId, panel.id);
    const { value } = res;

    for (const data of chunk(value, 1000)) {
      const [query, rows] = formatImportQueryAndRows(
        panel.tableName,
        panel.columns,
        data,
        quoteType
      );
      await db.insert(mangleInsert ? mangleInsert(query) : query, rows);
      rowsIngested += data.length;
    }
  }

  if (panelsToImport.length) {
    log.info(
      `Ingested ${rowsIngested} rows in ${panelsToImport.length} tables.`
    );
  }

  return db.query(query);
}
