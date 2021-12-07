package main

var JSON_SQL_TYPE_MAP = map[string]string{
	"number":  "REAL",
	"string":  "TEXT",
	"boolean": "BOOLEAN",
	"bigint":  "BIGINT",
	"null":    "TEXT",
}

/*
func sqlColumnsAndTypesFromShape(rowShape: ObjectShape) {
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

type panelToImport struct {
	id string
	columns []struct{
		name string
		kind string
	}
	tableName string
}

func transformDM_getPanelCalls(
  query: string,
  idShapeMap: Record<string | number, Shape>,
  idMap: Record<string | number, string>,
  getPanelCallsAllowed: boolean,
  quoteType: QuoteType
): { panelsToImport: Array<panelToImport>; query: string } {
  const panelsToImport: Array<panelToImport> = [];
  query = query.replace(
    /(DM_getPanel\((?<id>[0-9]+)\))|(DM_getPanel\((?<name>'(?:[^'\\]|\\.)*\')\))/g,
    func (...args) {
      const match = args.pop();
      let nameOrIndex: number | string = '';
      if (match.name) {
        nameOrIndex = match.name.substring(1, match.name.length - 1);
      } else {
        nameOrIndex = +match.id;
      }
      const s = idShapeMap[nameOrIndex];
      if (!s || s.kind !== 'array') {
        throw new NotAnArrayOfObjectsError(nameOrIndex);
      }

      const rowShape = (s as ArrayShape).children as ObjectShape;
      if (rowShape.kind !== 'object') {
        throw new NotAnArrayOfObjectsError(nameOrIndex);
      }

      const id = idMap[nameOrIndex];
      if (panelsToImport.filter((p) => id === p.id).length) {
        // Don't import the same panel twice.
        return;
      }

      const tableName = `t_${nameOrIndex}`;
      const columns = sqlColumnsAndTypesFromShape(rowShape);
      panelsToImport.push({
        id,
        columns,
        tableName,
      });
      return quote(tableName, quoteType.identifier);
    }
  );

  if (panelsToImport.length && !getPanelCallsAllowed) {
    throw new UnsupportedError(
      'DM_getPanel() is not yet supported by this connector.'
    );
  }

  return { panelsToImport, query };
}

func formatImportQueryAndRows(
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

func importAndRun(
  dispatch: Dispatch,
  db: {
    createTable: (stmt: string) => Promise<unknown>;
    insert: (stmt: string, values: any[]) => Promise<unknown>;
    query: (stmt: string) => Promise<any>;
  },
  projectId: string,
  query: string,
  panelsToImport: Array<panelToImport>,
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
*/
