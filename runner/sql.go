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

		if columnType == "" {
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

func getObjectAtPath(obj map[string]any, path string) any {
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

			n := next[string(part)]
			if n == nil {
				// Some objects may have this path, some may not
				return nil
			}
			var ok bool
			if next, ok = n.(map[string]any); !ok {
				// Some objects may have this path, some may not
				return nil
			}

			part = nil
			continue
		}

		part = append(part, c)
	}

	if len(part) > 0 {
		return next[string(part)]
	}

	return next
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

func chunk(c chan map[string]any, size int) chan []map[string]any {
	var chunk []map[string]any

	out := make(chan []map[string]any)

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

func makePreparedStatement(tname string, nColumns, chunkSize int) string {
	var values []string

	for i := 0; i < chunkSize; i++ {
		row := "("
		for j := 0; j < nColumns; j++ {
			if j > 0 {
				row += ","
			}

			row += "?"
		}
		row += ")"
		values = append(values, row)
	}

	return fmt.Sprintf("INSERT INTO %s VALUES %s", tname, strings.Join(values, ", "))
}

func IsScalar(v any) bool {
	switch v.(type) {
	case bool, byte, complex64, complex128, error, float32, float64,
		int, int8, int16, int32, int64,
		uint, uint16, uint32, uint64, uintptr, string:
		return true
	default:
		return false
	}
}

func importPanel(
	createTable func(string) error,
	prepare func(string) (func([]any) error, func(), error),
	makeQuery func(string) ([]map[string]any, error),
	projectId string,
	query string,
	panel panelToImport,
	qt quoteType,
	panelResultLoader func(string, string) (chan map[string]any, error),
	cacheMode *bool,
) error {
	var ddlColumns []string
	for _, c := range panel.columns {
		ddlColumns = append(ddlColumns, quote(c.name, qt.identifier)+" "+c.kind)
	}

	tableType := "TEMPORARY TABLE"
	if cacheMode != nil {
		tableType = "TABLE"
	}
	tname := quote(panel.tableName, qt.identifier)
	Logln("Creating table " + panel.tableName)
	createQuery := fmt.Sprintf("CREATE %s %s (%s);",
		tableType,
		tname,
		strings.Join(ddlColumns, ", "))
	err := createTable(createQuery)
	if err != nil {
		return err
	}

	c, err := panelResultLoader(projectId, panel.id)
	if err != nil {
		return err
	}

	// Preallocated this makes a 4s difference.
	chunkSize := 10
	toinsert := make([]any, chunkSize*len(ddlColumns))

	chunks := chunk(c, chunkSize)
newprepare:
	for {
		nWritten := 0
		preparedStatement := makePreparedStatement(tname, len(ddlColumns), chunkSize)
		inserter, closer, err := prepare(preparedStatement)
		if err != nil {
			return err
		}

		nLeftovers := 0
		for rows := range chunks {
			nWritten += len(rows)

			for i, row := range rows {
				for j, col := range panel.columns {
					v := getObjectAtPath(row, col.name)
					// Non-scalars get JSON
					// encoded. This can basically
					// only be arrays because
					// nested objects are
					// supported.
					if v != nil && !IsScalar(v) {
						if col.kind == "TEXT" {
							v, _ = jsonMarshal(v)
						} else {
							// SQL won't be happy to put a string in a REAL column for example
							v = nil
						}
					}
					toinsert[i*len(ddlColumns)+j] = v
				}
			}

			// This likely only happens at the end where the last chunk won't always be chunkSize.
			if len(rows) < chunkSize {
				nLeftovers = len(rows)
				break
			}

			err = inserter(toinsert)
			if err != nil {
				closer()
				return err
			}

			// Start a new prepared statement every so often
			if nWritten > 100_000 {
				closer()
				continue newprepare
			}
		}

		// Prepared statement must be closed whether or not there are leftovers
		// Must be closed before leftovers if there are leftovers
		closer()

		// Handle leftovers that are fewer than chunkSize
		if nLeftovers > 0 {
			stmt := makePreparedStatement(tname, len(ddlColumns), nLeftovers)
			inserter, closer, err = prepare(stmt)
			if err != nil {
				return err
			}

			defer closer()
			// Very important to slice since toinsert is preallocated it may have garbage at the end.
			return inserter(toinsert[:nLeftovers*len(ddlColumns)])
		}

		return nil
	}
}

func importAndRun(
	createTable func(string) error,
	prepare func(string) (func([]any) error, func(), error),
	makeQuery func(string) ([]map[string]any, error),
	projectId string,
	query string,
	panelsToImport []panelToImport,
	qt quoteType,
	// Postgres uses $1, mysql/sqlite use ?
	panelResultLoader func(string, string) (chan map[string]any, error),
	cacheMode *bool,
) ([]map[string]any, error) {
	if cacheMode != nil && *cacheMode {
		return makeQuery(query)
	}
	for _, panel := range panelsToImport {
		err := importPanel(createTable, prepare, makeQuery, projectId, query, panel, qt, panelResultLoader, cacheMode)
		if err != nil {
			return nil, err
		}
	}

	return makeQuery(query)
}
