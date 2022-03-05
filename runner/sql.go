package runner

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
		if childShape.Kind == ScalarKind {
			if childShape.ScalarShape.Name != NullScalar {
				columnType = JSON_SQL_TYPE_MAP[string(childShape.ScalarShape.Name)]
			}
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

		if (childShape.Kind == ScalarKind || childShape.Kind == VariedKind) && columnType == "" {
			// Otherwise just fall back to being TEXT
			columnType = "TEXT"
		}

		if childShape.Kind == ObjectKind {
			childColumns := sqlColumnsAndTypesFromShape(*childShape.ObjectShape)
			for _, c := range childColumns {
				columns = append(columns, column{
					name: strings.ReplaceAll(key, ".", "\\.") + "." + c.name,
					kind: c.kind,
				})
			}
		} else {
			// Ignore nested arrays
			columns = append(columns, column{
				name: key,
				kind: columnType,
			})
		}
	}

	return columns
}

type panelToImport struct {
	id        string
	columns   []column
	tableName string
	path      string
}

var dmGetPanelRe = regexp.MustCompile(`(DM_getPanel\((?P<number>[0-9]+)(((,\s*(?P<numbersinglepath>"(?:[^"\\]|\\.)*\"))?)|(,\s*(?P<numberdoublepath>'(?:[^'\\]|\\.)*\'))?)\))|(DM_getPanel\((?P<singlequote>'(?:[^'\\]|\\.)*\'(,\s*(?P<singlepath>'(?:[^'\\]|\\.)*\'))?)\))|(DM_getPanel\((?P<doublequote>"(?:[^"\\]|\\.)*\"(,\s*(?P<doublepath>"(?:[^"\\]|\\.)*\"))?)\))`)

func transformDM_getPanelCalls(
	query string,
	idShapeMap map[string]Shape,
	idMap map[string]string,
	getPanelCallsAllowed bool,
	qt quoteType,
) ([]panelToImport, string, error) {
	var panelsToImport []panelToImport

	var insideErr error
	query = dmGetPanelRe.ReplaceAllStringFunc(query, func(m string) string {
		matchForSubexps := dmGetPanelRe.FindStringSubmatch(m)
		nameOrIndex := ""
		path := ""
		for i, name := range dmGetPanelRe.SubexpNames() {
			if matchForSubexps[i] == "" {
				continue
			}

			switch name {
			case "number":
				nameOrIndex = matchForSubexps[i]
			case "numberdoublepath", "numbersinglepath", "singlepath", "doublepath":
				path = matchForSubexps[i]

				// Remove quotes
				if path != "" {
					path = path[1 : len(path)-1]
				}
			case "singlequote", "doublequote":
				nameOrIndex = matchForSubexps[i]

				// Remove quotes
				if nameOrIndex != "" {
					nameOrIndex = nameOrIndex[1 : len(nameOrIndex)-1]
				}
			}
		}

		s, ok := idShapeMap[nameOrIndex]
		if !ok {
			insideErr = makeErrNotAnArrayOfObjects(nameOrIndex)
			return ""
		}

		sp, err := shapeAtPath(s, path)
		if err != nil {
			insideErr = err
			return ""
		}

		ok = ShapeIsObjectArray(*sp)
		if err != nil {
			insideErr = err
			return ""
		}

		if !ok {
			insideErr = makeErrNotAnArrayOfObjects(nameOrIndex)
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

		rowShape := sp.ArrayShape.Children
		columns := sqlColumnsAndTypesFromShape(*rowShape.ObjectShape)
		if path != "" {
			for i := range columns {
				columns[i].name = path + "." + columns[i].name
			}
		}
		panelsToImport = append(panelsToImport, panelToImport{
			id:        id,
			columns:   columns,
			tableName: tableName,
		})

		return quote(tableName, qt.identifier)
	})

	if insideErr != nil {
		return nil, "", insideErr
	}

	if len(panelsToImport) > 0 && !getPanelCallsAllowed {
		return nil, "", makeErrUnsupported("DM_getPanel() is not yet supported by this connector.")
	}

	return panelsToImport, query, nil
}

func getObjectAtPath(obj map[string]interface{}, path string) interface{} {
	if val, ok := obj[path]; ok {
		return val
	}

	next := obj
	part := []rune{}
	for _, c := range path {
		// Split on . not preceded by \
		if c == '.' && len(part) > 0 {
			if part[len(part)-1] == '\\' {
				part[len(part)-1] = '.'
				continue
			}

			n, ok := next[string(part)]
			if !ok {
				// Should not be possible
				panic(fmt.Sprintf("Bad path (%s) at part (%s)", path, string(part)))
			}
			if next, ok = n.(map[string]interface{}); !ok {
				// Should not be possible
				panic(fmt.Sprintf("Path (%s) enters non-object at part (%s)", path, string(part)))
			}

			part = nil
			continue
		}

		part = append(part, c)
	}

	if len(part) > 0 {
		n, ok := next[string(part)]
		if !ok {
			// Should not be possible
			panic(fmt.Sprintf("Bad path (%s) at part (%s)", path, string(part)))
		}

		return n
	}

	return next
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

			values = append(values, getObjectAtPath(dataRow, col.name))
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

func chunk(c chan map[string]interface{}, size int) chan []map[string]interface{} {
	var chunk []map[string]interface{}

	out := make(chan []map[string]interface{}, 1)

	go func() {
		defer close(out)

	outer:
		for {
			select {
			case next, ok := <-c:
				if !ok {
					break outer
				}
				chunk = append(chunk, next)
			}

			if len(chunk) == size {
				out <- chunk
				chunk = nil
			}
		}

		if len(chunk) > 0 {
			out <- chunk
		}
	}()

	return out
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
	panelResultLoader func(string, string) (chan map[string]interface{}, error),
) ([]map[string]interface{}, error) {
	rowsIngested := 0
	for _, panel := range panelsToImport {
		var ddlColumns []string
		for _, c := range panel.columns {
			ddlColumns = append(ddlColumns, quote(c.name, qt.identifier)+" "+c.kind)
		}

		Logln("Creating temp table " + panel.tableName)
		createQuery := fmt.Sprintf("CREATE TEMPORARY TABLE %s (%s);",
			quote(panel.tableName, qt.identifier),
			strings.Join(ddlColumns, ", "))
		err := createTable(createQuery)
		if err != nil {
			return nil, err
		}

		c, err := panelResultLoader(projectId, panel.id)
		if err != nil {
			return nil, err
		}

		for resChunk := range chunk(c, 10) {
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
		Logln(
			"Ingested %d rows in %d tables.\n",
			rowsIngested,
			len(panelsToImport))
	}

	return makeQuery(query)
}
