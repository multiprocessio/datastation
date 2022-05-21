package runner

import (
	"fmt"
	// "context"
	"database/sql"

	"github.com/multiprocessio/go-json"

	"github.com/jmoiron/sqlx"
	sqlite3 "github.com/mattn/go-sqlite3"
	"github.com/multiprocessio/go-sqlite3-stdlib"
)

var sqlite_idResultsFileMap map[string]string
var sqlite_idShapeMap map[string]Shape

func init() {
	sql.Register("sqlite3_extended",
		&sqlite3.SQLiteDriver{
			ConnectHook: func (conn *sqlite3.SQLiteConn) error {
				conn.CreateModule("DM_getPanel", &dmGetPanel_Module{})
				return stdlib.ConnectHook(conn)
			},
		})
}

var SQLITE_PRAGMAS = []string{
	"journal_mode = WAL",
	"synchronous = normal",
	"temp_store = memory",
	"mmap_size = 30000000000",
}

type dmGetPanel_Module struct{
	idResultsFileMap map[string]string
	idShapeMap map[string]Shape
}

func (m *dmGetPanel_Module) EponymousOnlyModule() {}

func (m *dmGetPanel_Module) Create(c *sqlite3.SQLiteConn, args []string) (sqlite3.VTab, error) {
	fmt.Println("CFREATING", args[0])
	err := c.DeclareVTab(fmt.Sprintf(`
		CREATE TABLE %s (something int, panelNameOrId HIDDEN, path HIDDEN)`, args[0]))
	if err != nil {
		return nil, err
	}
	return &dmGetPanel_Table{m.idResultsFileMap, m.idShapeMap}, nil
}

func (m *dmGetPanel_Module) Connect(c *sqlite3.SQLiteConn, args []string) (sqlite3.VTab, error) {
	fmt.Println("CONNECTING")
	return m.Create(c, args)
}

func (m *dmGetPanel_Module) DestroyModule() {}

type dmGetPanel_Table struct {
	idResultsFileMap map[string]string
	idShapeMap map[string]Shape
}

func (v *dmGetPanel_Table) Open() (sqlite3.VTabCursor, error) {
	fmt.Println("OPENING")
	return &dmGetPanel_Cursor{
		v.idResultsFileMap,
		v.idShapeMap,
		0,
		"",
		nil,
		nil,
		false,
		nil,
	}, nil
}

func (v *dmGetPanel_Table) BestIndex(csts []sqlite3.InfoConstraint, ob []sqlite3.InfoOrderBy) (*sqlite3.IndexResult, error) {
	used := make([]bool, len(csts))
	for c, cst := range csts {
		if cst.Usable && cst.Op == sqlite3.OpEQ {
			used[c] = true
		}
	}

	return &sqlite3.IndexResult{
		IdxNum: 0,
		IdxStr: "default",
		Used:   used,
	}, nil
}

func (v *dmGetPanel_Table) Disconnect() error { fmt.Println("DISCONNECTING"); return nil }
func (v *dmGetPanel_Table) Destroy() error    { fmt.Println("DESTROYING"); return nil }

type dmGetPanel_Cursor struct {
	idResultsFileMap map[string]string
	idShapeMap map[string]Shape
	rowId int64
	path string
	row map[string]any
	columns []string
	eof bool
	reader chan map[string]any
}

func (vc *dmGetPanel_Cursor) Column(c *sqlite3.SQLiteContext, col int) error {
	v := vc.row[vc.columns[col]]
	var vs string
	switch t := v.(type) {
	case string:
		vs = t
	default:
		vs = fmt.Sprintf("%v", v)
	}
	c.ResultText(vs)
	return nil
}

func (vc *dmGetPanel_Cursor) Filter(idxNum int, idxStr string, vals []interface{}) error {
	fmt.Println("HEYYYYY PHILL!!!!!!")
	vc.eof = false
	vc.rowId = 0

	if len(vals) < 1 {
		return fmt.Errorf("Missing required parameter: panel id or name (e.g. DM_getPanel('HTTP results'))")
	}

	var panelIdOrName string
	switch t := vals[0].(type) {
	case int, int64:
		panelIdOrName = fmt.Sprintf("%d", vals[0])
	case string:
		panelIdOrName = t
	default:
		return fmt.Errorf("First parameter must be string: panel id or name (e.g. DM_getPanel('HTTP results'))")
	}

	var ok bool
	vc.path = ""
	if len(vals) == 2 {
		vc.path, ok = vals[1].(string)
		if !ok {
			vc.path = ""
		}
	}

	rowShape := sqlite_idShapeMap[panelIdOrName].ArrayShape.Children
	columns := sqlColumnsAndTypesFromShape(*rowShape.ObjectShape)
	vc.columns = nil
	for _, c := range columns {
		vc.columns = append(vc.columns, c.name)
	}

	var err error
	fmt.Println(panelIdOrName, "HERE PHIL")
	vc.reader, err = loadJSONArrayFile(sqlite_idResultsFileMap[panelIdOrName])
	if err != nil {
		return err
	}

	if vc.reader == nil {
		vc.eof = true
		return nil
	}

	// TODO: what happens when there are zero results?
	select {
	case vc.row, ok = <- vc.reader:
		if !ok {
			vc.eof = true
			return nil
		}
	}
	return nil
}

func (vc *dmGetPanel_Cursor) Next() error {
	vc.rowId++
	var ok bool
	select {
	case vc.row, ok = <- vc.reader:
		if ! ok {
			vc.eof = true
			return nil
		}
	}

	return nil
}

func (vc *dmGetPanel_Cursor) EOF() bool {
	fmt.Println("HEYYYYY PHILL!!!!!!")
	return vc.eof
}

func (vc *dmGetPanel_Cursor) Rowid() (int64, error) {
	return int64(vc.rowId), nil
}

func (vc *dmGetPanel_Cursor) Close() error {
	fmt.Println("HERE!!!!!???")
	return nil
}

func (ec *EvalContext) evalSQLite(dbInfo DatabaseConnectorInfoDatabase, projectId, panelId, query string, db *sqlx.DB, idMap map[string]string, idShapeMap map[string]Shape) error { 
	for _, pragma := range SQLITE_PRAGMAS {
		_, err := db.Exec("PRAGMA " + pragma)
		if err != nil {
			return err
		}
	}

	idResultsFileMap := map[string]string{}
	for name, panelId := range idMap {
		idResultsFileMap[name] = ec.GetPanelResultsFile(projectId, panelId)
	}
	sqlite_idResultsFileMap = idResultsFileMap
	sqlite_idShapeMap = idShapeMap

	// wrapperConn, err := db.Conn(context.Background())
	// if err != nil {
	// 	return edsef("Could not get conn: %s", err)
	// }

	// wrapperConn.Raw(func (c any) error {
	// 	conn, ok := c.(*sqlite3.SQLiteConn)
	// 	if !ok {
	// 		return edsef("Bad path")
	// 	}
		
	// 	conn.CreateModule("DM_getPanel", &dmGetPanel_Module{idResultsFileMap, idShapeMap})
	// 	return nil
	// })

	out := ec.GetPanelResultsFile(projectId, panelId)
	w, closeFile, err := openTruncateBufio(out)
	if err != nil {
		return err
	}
	defer closeFile()
	defer w.Flush()

	wroteFirstRow := false
	return withJSONArrayOutWriterFile(w, func(w *jsonutil.StreamEncoder) error {
		rows, err := db.Queryx(query)
		if err != nil {
			return err
		}

		defer rows.Close()

		for rows.Next() {
			err := writeRowFromDatabase(dbInfo, w, rows, wroteFirstRow)
			if err != nil {
				return err
			}

			wroteFirstRow = true
		}

		return rows.Err()
		
	})
}
