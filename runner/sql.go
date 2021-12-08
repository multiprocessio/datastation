package main

import (
	"fmt"
	"strings"
)

var JSON_SQL_TYPE_MAP = map[string]string{
	"number":  "REAL",
	"string":  "TEXT",
	"boolean": "BOOLEAN",
	"bigint":  "BIGINT",
	"null":    "TEXT",
}

type quoteType struct {
	identifier string
}

func quote(value string, quoteChar string) string {
	return quoteChar + strings.ReplaceAll(value, quoteChar, quoteChar+quoteChar) + quoteChar
}

type column struct {
	name string
	kind string
}

func sqlColumnsAndTypesFromShape(rowShape ObjectShape) []column {
	var columns []column

	for key, childShape := range rowShape.Children {
		columnType := ""

		// Look for simple type: X
		if childShape.Kind == ScalarKind && childShape.ScalarShape.Name != NullScalar {
			columnType = JSON_SQL_TYPE_MAP[string(childShape.ScalarShape.Name)]
		}

		// Look for type: null | X
		if childShape.Kind == VariedKind {
			vs := childShape.VariedShape
			if len(vs.Children) == 2 {
				nullChild := vs.Children[0]
				otherChild := vs.Children[1]
				if !(nullChild.Kind == ScalarKind && nullChild.ScalarShape.Name == NullScalar) {
					nullChild = vs.Children[1]
					otherChild = vs.Children[0]
				}

				if nullChild.Kind == ScalarKind && nullChild.ScalarShape.Name == NullScalar &&
					otherChild.Kind == ScalarKind && otherChild.ScalarShape.Name != NullScalar {
					columnType = JSON_SQL_TYPE_MAP[string(otherChild.ScalarShape.Name)]
				}
			}
		}

		// Otherwise just fall back to being TEXT
		kind := "TEXT"
		if columnType != "" {
			kind = columnType
		}
		columns = append(columns, column{
			name: key,
			kind: kind,
		})
	}

	return columns
}

type panelToImport struct {
	id        string
	columns   []column
	tableName string
}

/*

func transformDM_getPanelCalls(
  query: string,
  idShapeMap: Record<string | number, Shape>,
  idMap: Record<string | number, string>,
  getPanelCallsAllowed: boolean,
  quoteType: QuoteType
): { panelsToImport: Array<panelToImport>; query: string } {
  panelsToImport: Array<panelToImport> = [];
  query = query.replace(
    /(DM_getPanel\((?<id>[0-9]+)\))|(DM_getPanel\((?<name>'(?:[^'\\]|\\.)*\')\))/g,
    func (...args) {
      match = args.pop();
      let nameOrIndex: number | string = '';
      if (match.Name) {
        nameOrIndex = match.Name.substring(1, match.Name.length - 1);
      } else {
        nameOrIndex = +match.id;
      }
      s = idShapeMap[nameOrIndex];
      if (!s || s.Kind != 'array') {
        throw new NotAnArrayOfObjectsError(nameOrIndex);
      }

      rowShape = (s as ArrayShape).Children as ObjectShape;
      if (rowShape.Kind != 'object') {
        throw new NotAnArrayOfObjectsError(nameOrIndex);
      }

      id = idMap[nameOrIndex];
      if (panelsToImport.filter((p) => id == p.id).length) {
        // Don't import the same panel twice.
        return;
      }

      tableName = `t_${nameOrIndex}`;
      columns = sqlColumnsAndTypesFromShape(rowShape);
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
*/

func formatImportQueryAndRows(
	tableName string,
	columns []column,
	data []map[string]interface{},
	qt quoteType,
) (string, []interface{}) {
	var columnsDDL []string
	for _, c := range columns {
		columnsDDL = append(columnsDDL, quote(c.name, qt.identifier))
	}

	var placeholders []string
	var values []interface{}
	for _, dataRow := range data {
		var row []string
		for _, col := range columns {
			row = append(row, "?")

			values = append(values, dataRow[col.name])
		}

		placeholders = append(placeholders, "("+strings.Join(row, ",")+")")
	}

	t := quote(tableName, qt.identifier)

	query := fmt.Sprintf("INSERT INTO %s (%s) VALUES %s;",
		t,
		strings.Join(columnsDDL, ", "),
		strings.Join(placeholders, ", "))

	return query, values
}

/*
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
  for (panel of panelsToImport) {
    ddlColumns = panel.columns
      .map((c) => `${quote(c.Name, quoteType.identifier)} ${c.type}`)
      .join(', ');
    log.info('Creating temp table ' + panel.tableName);
    await db.createTable(
      `CREATE TEMPORARY TABLE ${quote(
        panel.tableName,
        quoteType.identifier
      )} (${ddlColumns});`
    );

    res = await getPanelResult(dispatch, projectId, panel.id);
    { value } = res;

    for (data of chunk(value, 1000)) {
      [query, rows] = formatImportQueryAndRows(
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
