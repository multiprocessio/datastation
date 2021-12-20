package main

import (
	"fmt"
	"regexp"
	"sort"
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
	string     string
}

var ansiSQLQuote = quoteType{
	identifier: `"`,
	string:     `'`,
}

var mysqlQuote = quoteType{
	identifier: "`",
	string:     `"`,
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

	var keys []string
	for key := range rowShape.Children {
		keys = append(keys, key)
	}

	sort.Strings(keys)

	for _, key := range keys {
		childShape := rowShape.Children[key]
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

var dmGetPanelRe = regexp.MustCompile(`(DM_getPanel\((?P<number>[0-9]+)\))|(DM_getPanel\((?P<singlequote>'(?:[^'\\]|\\.)*\')\))|(DM_getPanel\((?P<doublequote>"(?:[^"\\]|\\.)*\")\))`)

func transformDM_getPanelCalls(
	query string,
	idShapeMap map[string]Shape,
	idMap map[string]string,
	getPanelCallsAllowed bool,
	qt quoteType,
) ([]panelToImport, string, error) {
	var panelsToImport []panelToImport

	var err error
	query = dmGetPanelRe.ReplaceAllStringFunc(query, func(m string) string {
		matchForSubexps := dmGetPanelRe.FindStringSubmatch(m)
		nameOrIndex := ""
		for i, name := range dmGetPanelRe.SubexpNames() {
			switch name {
			case "number":
				nameOrIndex = matchForSubexps[i]
			case "singlequote", "doublequote":
				nameOrIndex = matchForSubexps[i]

				// Remove quotes
				if nameOrIndex != "" {
					nameOrIndex = nameOrIndex[1 : len(nameOrIndex)-1]
				}
			}

			if nameOrIndex != "" {
				break
			}
		}

		s, ok := idShapeMap[nameOrIndex]
		if !ok || s.Kind != ArrayKind {
			err = makeErrNotAnArrayOfObjects(nameOrIndex)
			return ""
		}

		rowShape := s.ArrayShape.Children
		if rowShape.Kind != ObjectKind {
			err = makeErrNotAnArrayOfObjects(nameOrIndex)
			return ""
		}

		id := idMap[nameOrIndex]
		tableName := "t_" + nameOrIndex
		for _, p := range panelsToImport {
			if p.id == id {
				// Don't import the same panel twice.
				return quote(tableName, qt.identifier)
			}
		}

		columns := sqlColumnsAndTypesFromShape(*rowShape.ObjectShape)
		panelsToImport = append(panelsToImport, panelToImport{
			id:        id,
			columns:   columns,
			tableName: tableName,
		})

		return quote(tableName, qt.identifier)
	})

	if err != nil {
		return nil, "", err
	}

	if len(panelsToImport) > 0 && !getPanelCallsAllowed {
		return nil, "", makeErrUnsupported("DM_getPanel() is not yet supported by this connector.")
	}

	return panelsToImport, query, nil
}

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

func postgresMangleInsert(stmt string) string {
	r := regexp.MustCompile("\\?")
	counter := 0
	return r.ReplaceAllStringFunc(stmt, func(m string) string {
		counter += 1
		return fmt.Sprintf("$%d", counter)
	})
}

func defaultMangleInsert(stmt string) string {
	return stmt
}

func chunk(a []map[string]interface{}, size int) [][]map[string]interface{} {
	var chunks [][]map[string]interface{}
	for i := 0; i < len(a); i += size {
		end := i + size

		if end > len(a) {
			end = len(a)
		}

		chunks = append(chunks, a[i:end])
	}

	return chunks
}

func importAndRun(
	createTable func(string) error,
	insert func(string, []interface{}) error,
	makeQuery func(string) ([]map[string]interface{}, error),
	projectId string,
	query string,
	panelsToImport []panelToImport,
	qt quoteType,
	// Postgres uses $1, mysql/sqlite use ?
	mangleInsert func(string) string,
) ([]map[string]interface{}, error) {
	rowsIngested := 0
	for _, panel := range panelsToImport {
		var ddlColumns []string
		for _, c := range panel.columns {
			ddlColumns = append(ddlColumns, quote(c.name, qt.identifier)+" "+c.kind)
		}

		logln("Creating temp table " + panel.tableName)
		createQuery := fmt.Sprintf("CREATE TEMPORARY TABLE %s (%s);",
			quote(panel.tableName, qt.identifier),
			strings.Join(ddlColumns, ", "))
		err := createTable(createQuery)
		if err != nil {
			return nil, err
		}

		var res []map[string]interface{}
		err = readJSONFileInto(getPanelResultsFile(projectId, panel.id), &res)

		for _, resChunk := range chunk(res, 1000) {
			query, values := formatImportQueryAndRows(
				panel.tableName,
				panel.columns,
				resChunk,
				qt)
			err = insert(mangleInsert(query), values)
			if err != nil {
				return nil, err
			}
			rowsIngested += len(resChunk)
		}
	}

	if len(panelsToImport) > 0 {
		logln(
			"Ingested %d rows in %d tables.\n",
			rowsIngested,
			len(panelsToImport))
	}

	return makeQuery(query)
}
